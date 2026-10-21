package com.banking.datatools;

import com.banking.common.sharding.LocalSqliteShardConnection;
import com.banking.common.sharding.QueryResult;
import com.banking.common.sharding.Shard;
import com.banking.common.sharding.ShardRouter;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

class SyntheticDataGeneratorTest {

    private ShardRouter router;
    private Shard shard0;
    private Shard shard1;
    private Shard shard2;

    @BeforeEach
    void setUp() {
        router = new ShardRouter(150);
        shard0 = new Shard("bank-shard-0", "Shard 0", new LocalSqliteShardConnection("jdbc:sqlite::memory:"));
        shard1 = new Shard("bank-shard-1", "Shard 1", new LocalSqliteShardConnection("jdbc:sqlite::memory:"));
        shard2 = new Shard("bank-shard-2", "Shard 2", new LocalSqliteShardConnection("jdbc:sqlite::memory:"));
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
    @DisplayName("Test Synthetic Seeding and Routing Integrity")
    void testSyntheticSeeding() {
        SyntheticDataGenerator generator = new SyntheticDataGenerator(router);
        SyntheticDataGenerator.GenerationSummary summary = generator.generate(50, 100, 300);

        assertEquals(50, summary.customersCreated());
        assertEquals(100, summary.accountsCreated());
        assertTrue(summary.transactionsCreated() > 0);
        assertTrue(summary.totalBalanceCents() > 0);

        // Verify that accounts are located ONLY on their assigned shard
        for (int i = 1; i <= 100; i++) {
            String accId = "ACC-" + String.format("%07d", i);
            Shard assignedShard = router.getShard(accId);

            QueryResult qr = assignedShard.getConnection().executeQuery(
                    "SELECT * FROM accounts WHERE account_id = ?", accId
            );
            assertFalse(qr.isEmpty(), "Account " + accId + " must exist on assigned shard " + assignedShard.getShardId());

            // Must NOT exist on any other shard
            for (Shard other : router.getAllShards()) {
                if (!other.equals(assignedShard)) {
                    QueryResult otherQr = other.getConnection().executeQuery(
                            "SELECT * FROM accounts WHERE account_id = ?", accId
                    );
                    assertTrue(otherQr.isEmpty(), "Account " + accId + " must NOT exist on other shard " + other.getShardId());
                }
            }
        }

        System.out.println("Row distribution across shards: " + summary.rowsPerShard());
        for (long count : summary.rowsPerShard().values()) {
            assertTrue(count > 0, "Each shard must receive a balanced share of data");
        }
    }
}
