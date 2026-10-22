package com.banking.datatools;

import com.banking.common.hashing.ConsistentHashRing;
import com.banking.common.hashing.HashFunction;

import java.io.File;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.Statement;
import java.util.*;

/**
 * RebalanceToRing
 * 
 * Rebalances seeded accounts, customers, bills, beneficiaries, and transactions across
 * the 3 bank database shards (bank-shard-0.db, bank-shard-1.db, bank-shard-2.db)
 * so that account keys align 100% with the Gateway's Consistent Hash Ring.
 * 
 * Gateway Ring Physical Nodes:
 * - node-8081 (http://localhost:8081) -> maps to data/bank-shard-0.db
 * - node-8082 (http://localhost:8082) -> maps to data/bank-shard-1.db
 * - node-8083 (http://localhost:8083) -> maps to data/bank-shard-2.db
 */
public class RebalanceToRing {

    public static void main(String[] args) throws Exception {
        String dataDir = args.length > 0 ? args[0] : "./data";
        File dir = new File(dataDir);
        File baseFile = new File(dir, "baseline.db");
        if (!baseFile.exists()) {
            System.err.println("Baseline DB not found at " + baseFile.getAbsolutePath());
            System.exit(1);
        }

        System.out.println("==========================================================");
        System.out.println("   REBALANCE TO RING: ALIGNING ACCOUNTS WITH GATEWAY      ");
        System.out.println("==========================================================");

        // 1. Initialize Canonical Consistent Hash Ring
        ConsistentHashRing<String> ring = new ConsistentHashRing<>(150, HashFunction.MURMUR3);
        String s1 = "bank-shard-0";
        String s2 = "bank-shard-1";
        String s3 = "bank-shard-2";
        ring.addNode(s1);
        ring.addNode(s2);
        ring.addNode(s3);

        Map<String, String> nodeToShard = new HashMap<>();
        nodeToShard.put(s1, "bank-shard-0");
        nodeToShard.put(s2, "bank-shard-1");
        nodeToShard.put(s3, "bank-shard-2");

        // 2. Clear existing records in the 3 shards
        Map<String, Connection> shardConns = new HashMap<>();
        for (int s = 0; s < 3; s++) {
            String shardName = "bank-shard-" + s;
            File dbFile = new File(dir, shardName + ".db");
            Connection c = DriverManager.getConnection("jdbc:sqlite:" + dbFile.getAbsolutePath());
            try (Statement st = c.createStatement()) {
                st.execute("DELETE FROM transactions");
                st.execute("DELETE FROM bills");
                st.execute("DELETE FROM beneficiaries");
                st.execute("DELETE FROM accounts");
                st.execute("DELETE FROM customers");
            }
            shardConns.put(shardName, c);
        }

        // 3. Read all data from baseline.db and route by accountId
        Connection baseConn = DriverManager.getConnection("jdbc:sqlite:" + baseFile.getAbsolutePath());
        
        // Load customers map: customer_id -> row data
        Map<String, List<Object>> customers = new HashMap<>();
        try (Statement st = baseConn.createStatement();
             ResultSet rs = st.executeQuery("SELECT customer_id, username, password_hash, email, full_name, created_at FROM customers")) {
            while (rs.next()) {
                List<Object> row = Arrays.asList(
                    rs.getString(1), rs.getString(2), rs.getString(3),
                    rs.getString(4), rs.getString(5), rs.getLong(6)
                );
                customers.put(rs.getString(1), row);
            }
        }

        // Load and partition accounts
        Map<String, String> accountToShard = new HashMap<>();
        Map<String, List<List<Object>>> accountsByShard = new HashMap<>();
        accountsByShard.put("bank-shard-0", new ArrayList<>());
        accountsByShard.put("bank-shard-1", new ArrayList<>());
        accountsByShard.put("bank-shard-2", new ArrayList<>());

        Set<String> allAccountIds = new HashSet<>();
        try (Statement st = baseConn.createStatement();
             ResultSet rs = st.executeQuery("SELECT account_id, customer_id, account_number, balance_cents, currency, status, created_at, updated_at FROM accounts")) {
            while (rs.next()) {
                String accId = rs.getString(1);
                String custId = rs.getString(2);
                String assignedNode = ring.getNode(accId);
                String shardName = nodeToShard.get(assignedNode);
                accountToShard.put(accId, shardName);
                allAccountIds.add(accId);

                List<Object> row = Arrays.asList(
                    accId, custId, rs.getString(3), rs.getLong(4),
                    rs.getString(5), rs.getString(6), rs.getLong(7), rs.getLong(8)
                );
                accountsByShard.get(shardName).add(row);
            }
        }

        System.out.printf("Total Accounts: %d%n", allAccountIds.size());
        for (int s = 0; s < 3; s++) {
            String sn = "bank-shard-" + s;
            System.out.printf("  %s: %d accounts (%.1f%%)%n", sn, accountsByShard.get(sn).size(), (accountsByShard.get(sn).size() * 100.0) / allAccountIds.size());
        }

        // Write Customers and Accounts to each shard
        for (String sn : shardConns.keySet()) {
            Connection c = shardConns.get(sn);
            c.setAutoCommit(false);
            
            // Replicate all Customers across shards so any node can authenticate any user
            try (PreparedStatement ps = c.prepareStatement(
                    "INSERT OR IGNORE INTO customers (customer_id, username, password_hash, email, full_name, created_at) VALUES (?, ?, ?, ?, ?, ?)")) {
                for (List<Object> custRow : customers.values()) {
                    for (int i = 0; i < custRow.size(); i++) {
                        ps.setObject(i + 1, custRow.get(i));
                    }
                    ps.addBatch();
                }
                ps.executeBatch();
            }

            // Insert Accounts
            try (PreparedStatement ps = c.prepareStatement(
                    "INSERT INTO accounts (account_id, customer_id, account_number, balance_cents, currency, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")) {
                for (List<Object> accRow : accountsByShard.get(sn)) {
                    for (int i = 0; i < accRow.size(); i++) {
                        ps.setObject(i + 1, accRow.get(i));
                    }
                    ps.addBatch();
                }
                ps.executeBatch();
            }
            c.commit();
        }

        // Partition and insert Beneficiaries
        try (Statement st = baseConn.createStatement();
             ResultSet rs = st.executeQuery("SELECT beneficiary_id, customer_id, name, account_number, bank_code, created_at FROM beneficiaries")) {
            while (rs.next()) {
                String custId = rs.getString(2);
                for (String sn : shardConns.keySet()) {
                    Connection c = shardConns.get(sn);
                    try (PreparedStatement checkPs = c.prepareStatement("SELECT 1 FROM customers WHERE customer_id = ?");
                         PreparedStatement insPs = c.prepareStatement(
                             "INSERT OR IGNORE INTO beneficiaries (beneficiary_id, customer_id, name, account_number, bank_code, created_at) VALUES (?, ?, ?, ?, ?, ?)")) {
                        checkPs.setString(1, custId);
                        try (ResultSet crs = checkPs.executeQuery()) {
                            if (crs.next()) {
                                for (int i = 1; i <= 6; i++) {
                                    insPs.setObject(i, rs.getObject(i));
                                }
                                insPs.executeUpdate();
                            }
                        }
                    }
                }
            }
        }

        // Partition and insert Bills
        try (Statement st = baseConn.createStatement();
             ResultSet rs = st.executeQuery("SELECT bill_id, customer_id, biller_code, biller_name, amount_cents, status, created_at FROM bills")) {
            while (rs.next()) {
                String custId = rs.getString(2);
                for (String sn : shardConns.keySet()) {
                    Connection c = shardConns.get(sn);
                    try (PreparedStatement checkPs = c.prepareStatement("SELECT 1 FROM customers WHERE customer_id = ?");
                         PreparedStatement insPs = c.prepareStatement(
                             "INSERT OR IGNORE INTO bills (bill_id, customer_id, biller_code, biller_name, amount_cents, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)")) {
                        checkPs.setString(1, custId);
                        try (ResultSet crs = checkPs.executeQuery()) {
                            if (crs.next()) {
                                for (int i = 1; i <= 7; i++) {
                                    insPs.setObject(i, rs.getObject(i));
                                }
                                insPs.executeUpdate();
                            }
                        }
                    }
                }
            }
        }

        // Partition and insert Transactions
        try (Statement st = baseConn.createStatement();
             ResultSet rs = st.executeQuery("SELECT transaction_id, account_id, type, amount_cents, balance_after_cents, description, idempotency_key, created_at FROM transactions")) {
            while (rs.next()) {
                String accId = rs.getString(2);
                String targetShard = accountToShard.get(accId);
                if (targetShard != null) {
                    Connection c = shardConns.get(targetShard);
                    try (PreparedStatement insPs = c.prepareStatement(
                            "INSERT OR IGNORE INTO transactions (transaction_id, account_id, type, amount_cents, balance_after_cents, description, idempotency_key, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")) {
                        for (int i = 1; i <= 8; i++) {
                            insPs.setObject(i, rs.getObject(i));
                        }
                        insPs.executeUpdate();
                    }
                }
            }
        }

        // Close connections
        baseConn.close();
        for (Connection c : shardConns.values()) {
            c.close();
        }

        System.out.println("\n[SUCCESS] RebalanceToRing completed! All accounts, customers, bills, and txns aligned with Gateway Hash Ring.");
    }
}
