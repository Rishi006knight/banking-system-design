package com.banking.common.sharding;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.*;

import static org.junit.jupiter.api.Assertions.*;

class ShardingTest {

    private Shard shard0;
    private Shard shard1;
    private Shard shard2;
    private ShardRouter router;

    @BeforeEach
    void setUp() {
        shard0 = new Shard("bank-shard-0", "Shard 0", new LocalSqliteShardConnection("jdbc:sqlite::memory:"));
        shard1 = new Shard("bank-shard-1", "Shard 1", new LocalSqliteShardConnection("jdbc:sqlite::memory:"));
        shard2 = new Shard("bank-shard-2", "Shard 2", new LocalSqliteShardConnection("jdbc:sqlite::memory:"));

        ShardSchema.initializeSchema(shard0.getConnection());
        ShardSchema.initializeSchema(shard1.getConnection());
        ShardSchema.initializeSchema(shard2.getConnection());

        router = new ShardRouter(150);
        router.addShard(shard0);
        router.addShard(shard1);
        router.addShard(shard2);
    }

    @AfterEach
    void tearDown() {
        shard0.getConnection().close();
        shard1.getConnection().close();
        shard2.getConnection().close();
    }

    @Test
    @DisplayName("Test Shard Routing Consistency")
    void testShardRouting() {
        assertEquals(3, router.getShardCount());

        Shard s1 = router.getShard("ACC-001");
        Shard s2 = router.getShard("ACC-002");
        Shard s1Repeat = router.getShard("ACC-001");

        assertNotNull(s1);
        assertNotNull(s2);
        assertEquals(s1, s1Repeat, "Routing must be deterministic");
    }

    @Test
    @DisplayName("Test ShardConnection CRUD and Atomic Transactions")
    void testCrudAndTransactions() {
        ShardConnection conn = shard0.getConnection();

        // 1. Insert customer
        int rows = conn.executeUpdate(
                "INSERT INTO customers (customer_id, username, password_hash, email, full_name, created_at) " +
                        "VALUES (?, ?, ?, ?, ?, ?)",
                "CUST-001", "alice", "$2a$10$hashedpass", "alice@example.com", "Alice Smith", System.currentTimeMillis()
        );
        assertEquals(1, rows);

        // 2. Query customer
        QueryResult qr = conn.executeQuery("SELECT * FROM customers WHERE customer_id = ?", "CUST-001");
        assertFalse(qr.isEmpty());
        assertEquals("alice", qr.firstRow().get("username"));

        // 3. Atomic Transaction Rollback test
        assertThrows(RuntimeException.class, () -> {
            conn.executeInTransaction(tx -> {
                tx.executeUpdate("INSERT INTO accounts (account_id, customer_id, account_number, balance_cents, created_at, updated_at) " +
                        "VALUES (?, ?, ?, ?, ?, ?)", "ACC-ROLLBACK", "CUST-001", "ACCNUM-001", 1000, 0, 0);

                // Intentionally trigger failure
                throw new RuntimeException("Simulated error inside transaction");
            });
        });

        // Verify account was NOT persisted due to rollback
        QueryResult check = conn.executeQuery("SELECT * FROM accounts WHERE account_id = ?", "ACC-ROLLBACK");
        assertTrue(check.isEmpty(), "Account must be rolled back on error");
    }

    @Test
    @DisplayName("Test Dynamic Shard Scale-Out and Key Migration with Balance Conservation")
    void testDynamicShardMigration() {
        // Populate 100 accounts across the 3 initial shards
        List<String> accountIds = new ArrayList<>();
        long totalInitialBalance = 0;

        for (int i = 0; i < 100; i++) {
            String accId = "ACC-" + String.format("%04d", i);
            String custId = "CUST-" + i;
            accountIds.add(accId);

            long balance = 10_000 + (i * 100); // 100 to 200 INR
            totalInitialBalance += balance;

            Shard target = router.getShard(accId);
            // Insert customer first to satisfy foreign key constraint
            target.getConnection().executeUpdate(
                    "INSERT INTO customers (customer_id, username, password_hash, email, full_name, created_at) " +
                            "VALUES (?, ?, ?, ?, ?, ?)",
                    custId, "user_" + i, "hash_" + i, "user" + i + "@bank.com", "Customer " + i, System.currentTimeMillis()
            );

            target.getConnection().executeUpdate(
                    "INSERT INTO accounts (account_id, customer_id, account_number, balance_cents, created_at, updated_at) " +
                            "VALUES (?, ?, ?, ?, ?, ?)",
                    accId, custId, "NUM-" + i, balance, System.currentTimeMillis(), System.currentTimeMillis()
            );
        }

        // Add 4th shard and perform migration
        Shard shard3 = new Shard("bank-shard-3", "Shard 3", new LocalSqliteShardConnection("jdbc:sqlite::memory:"));
        ShardMigrationService migrationService = new ShardMigrationService(router);

        ShardMigrationService.MigrationResult result = migrationService.addShardAndMigrate(shard3, accountIds);

        System.out.printf("Dynamic Shard Migration: Accounts Migrated=%d / %d (%.2f%%), Rows Moved=%d, Duration=%dms%n",
                result.accountsMigrated(), result.totalAccountsChecked(),
                (result.accountsMigrated() * 100.0 / result.totalAccountsChecked()),
                result.rowsMigrated(), result.durationMillis());

        // Consistent hashing property: ~25% of keys should be migrated to the 4th shard
        assertTrue(result.accountsMigrated() > 10 && result.accountsMigrated() < 40,
                "Expected approximately ~25% accounts to migrate to 4th shard");

        // Verify INVARIANT: Sum of all balances across all 4 shards must equal totalInitialBalance
        long finalBalanceSum = 0;
        for (Shard s : router.getAllShards()) {
            QueryResult qr = s.getConnection().executeQuery("SELECT SUM(balance_cents) as total FROM accounts");
            if (!qr.isEmpty() && qr.firstRow().get("total") != null) {
                finalBalanceSum += ((Number) qr.firstRow().get("total")).longValue();
            }
        }

        System.out.println("Initial Balance Across Shards: " + totalInitialBalance);
        System.out.println("Final Balance Across Shards:   " + finalBalanceSum);
        assertEquals(totalInitialBalance, finalBalanceSum, "Total financial balance across all shards MUST be conserved");

        shard3.getConnection().close();
    }
}
