package com.banking.common.sharding;

import java.util.*;

/**
 * Service to migrate accounts when shards are added or removed dynamically.
 * Leverages consistent hashing: only ~1/N keys are moved to a newly added shard.
 */
public class ShardMigrationService {

    private final ShardRouter router;

    public ShardMigrationService(ShardRouter router) {
        this.router = router;
    }

    /**
     * Migration summary result.
     */
    public record MigrationResult(
            Shard targetShard,
            int totalAccountsChecked,
            int accountsMigrated,
            int rowsMigrated,
            long durationMillis
    ) {}

    /**
     * Dynamically adds a new shard to the cluster and migrates keys that are remapped to it.
     */
    public MigrationResult addShardAndMigrate(Shard newShard, List<String> allAccountIds) {
        long startTime = System.currentTimeMillis();

        // 1. Snapshot previous shard placement for each account
        Map<String, Shard> oldPlacements = new HashMap<>(allAccountIds.size());
        for (String accountId : allAccountIds) {
            oldPlacements.put(accountId, router.getShard(accountId));
        }

        // 2. Add new shard to the router ring
        router.addShard(newShard);

        // Ensure new shard has database schema created
        ShardSchema.initializeSchema(newShard.getConnection());

        // 3. Find and migrate only the remapped accounts
        int accountsMigrated = 0;
        int rowsMigrated = 0;

        for (String accountId : allAccountIds) {
            Shard newPlacement = router.getShard(accountId);
            Shard oldPlacement = oldPlacements.get(accountId);

            if (newPlacement.equals(newShard) && !oldPlacement.equals(newShard)) {
                // Account was remapped to new shard! Migrate data across shards.
                int migratedRows = migrateSingleAccount(accountId, oldPlacement, newShard);
                accountsMigrated++;
                rowsMigrated += migratedRows;
            }
        }

        long duration = System.currentTimeMillis() - startTime;
        return new MigrationResult(newShard, allAccountIds.size(), accountsMigrated, rowsMigrated, duration);
    }

    private int migrateSingleAccount(String accountId, Shard sourceShard, Shard targetShard) {
        int rows = 0;

        // Fetch account from source shard
        QueryResult qr = sourceShard.getConnection().executeQuery(
                "SELECT * FROM accounts WHERE account_id = ?", accountId
        );
        if (qr.isEmpty()) {
            return 0;
        }

        Map<String, Object> accountRow = qr.firstRow();

        // 1. Migrate customer row first if not already on target shard (satisfies foreign key)
        String customerId = (String) accountRow.get("customer_id");
        QueryResult custQr = sourceShard.getConnection().executeQuery(
                "SELECT * FROM customers WHERE customer_id = ?", customerId
        );
        if (!custQr.isEmpty()) {
            Map<String, Object> custRow = custQr.firstRow();
            targetShard.getConnection().executeUpdate(
                    "INSERT OR IGNORE INTO customers (customer_id, username, password_hash, email, full_name, created_at) " +
                            "VALUES (?, ?, ?, ?, ?, ?)",
                    custRow.get("customer_id"),
                    custRow.get("username"),
                    custRow.get("password_hash"),
                    custRow.get("email"),
                    custRow.get("full_name"),
                    custRow.get("created_at")
            );
            rows++;
        }

        // 2. Atomic transaction on target shard to insert account
        targetShard.getConnection().executeInTransaction(tx -> {
            tx.executeUpdate(
                    "INSERT OR REPLACE INTO accounts (account_id, customer_id, account_number, balance_cents, currency, status, created_at, updated_at) " +
                            "VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                    accountRow.get("account_id"),
                    accountRow.get("customer_id"),
                    accountRow.get("account_number"),
                    accountRow.get("balance_cents"),
                    accountRow.get("currency"),
                    accountRow.get("status"),
                    accountRow.get("created_at"),
                    accountRow.get("updated_at")
            );
        });
        rows++;

        // Migrate transactions
        QueryResult txQr = sourceShard.getConnection().executeQuery(
                "SELECT * FROM transactions WHERE account_id = ?", accountId
        );
        for (Map<String, Object> txRow : txQr.getRows()) {
            targetShard.getConnection().executeUpdate(
                    "INSERT OR REPLACE INTO transactions (transaction_id, account_id, type, amount_cents, balance_after_cents, description, idempotency_key, created_at) " +
                            "VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                    txRow.get("transaction_id"),
                    txRow.get("account_id"),
                    txRow.get("type"),
                    txRow.get("amount_cents"),
                    txRow.get("balance_after_cents"),
                    txRow.get("description"),
                    txRow.get("idempotency_key"),
                    txRow.get("created_at")
            );
            rows++;
        }

        // Delete from source shard to maintain single-source-of-truth
        sourceShard.getConnection().executeUpdate("DELETE FROM transactions WHERE account_id = ?", accountId);
        sourceShard.getConnection().executeUpdate("DELETE FROM accounts WHERE account_id = ?", accountId);

        return rows;
    }
}
