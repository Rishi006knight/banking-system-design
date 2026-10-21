package com.banking.baseline.db;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import java.io.File;
import java.sql.*;
import java.util.*;

@Component
public class BaselineDatabase {

    @Value("${baseline.db-path:./data/baseline.db}")
    private String dbPath;

    private Connection connection;

    @PostConstruct
    public void init() {
        try {
            File file = new File(dbPath);
            if (!file.isAbsolute() && !file.exists() && new File("..", dbPath).exists()) {
                file = new File("..", dbPath);
            }
            if (file.getParentFile() != null && !file.getParentFile().exists()) {
                file.getParentFile().mkdirs();
            }

            String url = "jdbc:sqlite:" + file.getAbsolutePath();
            connection = DriverManager.getConnection(url);

            try (Statement stmt = connection.createStatement()) {
                stmt.execute("PRAGMA journal_mode = WAL;");
                stmt.execute("PRAGMA synchronous = NORMAL;");

                stmt.execute("""
                    CREATE TABLE IF NOT EXISTS customers (
                        customer_id TEXT PRIMARY KEY,
                        username TEXT UNIQUE NOT NULL,
                        password_hash TEXT NOT NULL,
                        email TEXT NOT NULL,
                        full_name TEXT NOT NULL,
                        created_at INTEGER NOT NULL
                    );
                """);

                stmt.execute("""
                    CREATE TABLE IF NOT EXISTS accounts (
                        account_id TEXT PRIMARY KEY,
                        customer_id TEXT NOT NULL,
                        account_number TEXT UNIQUE NOT NULL,
                        balance_cents INTEGER NOT NULL DEFAULT 0,
                        currency TEXT NOT NULL DEFAULT 'INR',
                        status TEXT NOT NULL DEFAULT 'ACTIVE',
                        created_at INTEGER NOT NULL,
                        updated_at INTEGER NOT NULL,
                        FOREIGN KEY (customer_id) REFERENCES customers(customer_id)
                    );
                """);

                stmt.execute("""
                    CREATE TABLE IF NOT EXISTS transactions (
                        transaction_id TEXT PRIMARY KEY,
                        account_id TEXT NOT NULL,
                        type TEXT NOT NULL,
                        amount_cents INTEGER NOT NULL,
                        balance_after_cents INTEGER NOT NULL,
                        description TEXT,
                        created_at INTEGER NOT NULL,
                        FOREIGN KEY (account_id) REFERENCES accounts(account_id)
                    );
                """);

                stmt.execute("""
                    CREATE TABLE IF NOT EXISTS transfers (
                        transfer_id TEXT PRIMARY KEY,
                        source_account_id TEXT NOT NULL,
                        dest_account_id TEXT NOT NULL,
                        amount_cents INTEGER NOT NULL,
                        status TEXT NOT NULL,
                        idempotency_key TEXT,
                        created_at INTEGER NOT NULL
                    );
                """);

                stmt.execute("""
                    CREATE TABLE IF NOT EXISTS bills (
                        bill_id TEXT PRIMARY KEY,
                        customer_id TEXT NOT NULL,
                        biller_name TEXT NOT NULL,
                        amount_cents INTEGER NOT NULL,
                        status TEXT NOT NULL DEFAULT 'UNPAID',
                        created_at INTEGER NOT NULL
                    );
                """);
            }
        } catch (SQLException e) {
            throw new RuntimeException("Failed to initialize baseline database", e);
        }
    }

    public synchronized List<Map<String, Object>> query(String sql, Object... params) {
        try (PreparedStatement pstmt = connection.prepareStatement(sql)) {
            for (int i = 0; i < params.length; i++) {
                pstmt.setObject(i + 1, params[i]);
            }
            try (ResultSet rs = pstmt.executeQuery()) {
                ResultSetMetaData meta = rs.getMetaData();
                int cols = meta.getColumnCount();
                List<Map<String, Object>> list = new ArrayList<>();
                while (rs.next()) {
                    Map<String, Object> map = new LinkedHashMap<>();
                    for (int i = 1; i <= cols; i++) {
                        map.put(meta.getColumnLabel(i), rs.getObject(i));
                    }
                    list.add(map);
                }
                return list;
            }
        } catch (SQLException e) {
            throw new RuntimeException("Baseline query failed: " + sql, e);
        }
    }

    public synchronized int update(String sql, Object... params) {
        try (PreparedStatement pstmt = connection.prepareStatement(sql)) {
            for (int i = 0; i < params.length; i++) {
                pstmt.setObject(i + 1, params[i]);
            }
            return pstmt.executeUpdate();
        } catch (SQLException e) {
            throw new RuntimeException("Baseline update failed: " + sql, e);
        }
    }

    public synchronized void inTransaction(TxCallback callback) {
        try {
            boolean ac = connection.getAutoCommit();
            connection.setAutoCommit(false);
            try {
                callback.run();
                connection.commit();
            } catch (Exception e) {
                connection.rollback();
                throw new RuntimeException("Baseline transaction rolled back", e);
            } finally {
                connection.setAutoCommit(ac);
            }
        } catch (SQLException e) {
            throw new RuntimeException("Baseline transaction failed", e);
        }
    }

    @PreDestroy
    public synchronized void close() {
        if (connection != null) {
            try {
                connection.close();
            } catch (SQLException ignored) {}
        }
    }

    @FunctionalInterface
    public interface TxCallback {
        void run() throws Exception;
    }
}
