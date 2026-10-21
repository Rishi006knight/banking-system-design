package com.banking.common.snowflake;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicLong;

import static org.junit.jupiter.api.Assertions.*;

class SnowflakeIdGeneratorTest {

    @Test
    @DisplayName("Test Monotonicity and Field Extraction")
    void testMonotonicityAndFieldExtraction() {
        long nodeId = 5;
        SnowflakeIdGenerator generator = new SnowflakeIdGenerator(nodeId);

        long id1 = generator.nextId();
        long id2 = generator.nextId();
        long id3 = generator.nextId();

        assertTrue(id1 < id2, "ID 1 must be strictly less than ID 2");
        assertTrue(id2 < id3, "ID 2 must be strictly less than ID 3");

        assertEquals(nodeId, generator.extractNodeId(id1));
        assertEquals(nodeId, generator.extractNodeId(id2));

        long ts = generator.extractTimestamp(id1);
        long now = System.currentTimeMillis();
        assertTrue(Math.abs(now - ts) < 5000, "Extracted timestamp should match current time");

        System.out.println("Formatted ID: " + generator.format(id1));
    }

    @Test
    @DisplayName("Test Multi-Node Independence (Node 1, Node 2, Node 3)")
    void testMultiNodeUniqueness() {
        SnowflakeIdGenerator gen1 = new SnowflakeIdGenerator(1);
        SnowflakeIdGenerator gen2 = new SnowflakeIdGenerator(2);
        SnowflakeIdGenerator gen3 = new SnowflakeIdGenerator(3);

        long id1 = gen1.nextId();
        long id2 = gen2.nextId();
        long id3 = gen3.nextId();

        assertNotEquals(id1, id2);
        assertNotEquals(id2, id3);
        assertNotEquals(id1, id3);

        assertEquals(1, gen1.extractNodeId(id1));
        assertEquals(2, gen2.extractNodeId(id2));
        assertEquals(3, gen3.extractNodeId(id3));
    }

    @Test
    @DisplayName("Massive Concurrency and Collision Test Across 3 Simulated App Nodes")
    void testMassiveConcurrencyAndZeroCollisions() throws InterruptedException {
        int threadsPerNode = 6;
        int idsPerThread = 10_000;
        int totalExpectedIds = 3 * threadsPerNode * idsPerThread; // 180,000 IDs

        SnowflakeIdGenerator node1 = new SnowflakeIdGenerator(1);
        SnowflakeIdGenerator node2 = new SnowflakeIdGenerator(2);
        SnowflakeIdGenerator node3 = new SnowflakeIdGenerator(3);

        SnowflakeIdGenerator[] generators = new SnowflakeIdGenerator[]{node1, node2, node3};

        // Use a concurrent set to detect any duplicate IDs
        Set<Long> uniqueIds = ConcurrentHashMap.newKeySet(totalExpectedIds);
        ExecutorService executor = Executors.newFixedThreadPool(threadsPerNode * 3);
        CountDownLatch latch = new CountDownLatch(threadsPerNode * 3);
        long startTime = System.currentTimeMillis();

        for (int n = 0; n < 3; n++) {
            SnowflakeIdGenerator gen = generators[n];
            for (int t = 0; t < threadsPerNode; t++) {
                executor.submit(() -> {
                    try {
                        for (int i = 0; i < idsPerThread; i++) {
                            long id = gen.nextId();
                            uniqueIds.add(id);
                        }
                    } finally {
                        latch.countDown();
                    }
                });
            }
        }

        assertTrue(latch.await(15, TimeUnit.SECONDS));
        long duration = System.currentTimeMillis() - startTime;
        executor.shutdown();

        double throughput = (double) uniqueIds.size() * 1000.0 / (double) Math.max(1, duration);

        System.out.println("==================================================================");
        System.out.printf("SNOWFLAKE CONCURRENCY BENCHMARK RESULTS:%n");
        System.out.printf("Total IDs Generated: %d%n", uniqueIds.size());
        System.out.printf("Expected IDs:        %d%n", totalExpectedIds);
        System.out.printf("Collision Count:     %d%n", totalExpectedIds - uniqueIds.size());
        System.out.printf("Duration:            %d ms%n", duration);
        System.out.printf("Generation Rate:     %,.0f IDs/sec%n", throughput);
        System.out.println("==================================================================");

        // Verification: 0 collisions
        assertEquals(totalExpectedIds, uniqueIds.size(), "Collision count MUST be zero across all nodes and threads");
        assertTrue(throughput > 50_000, "Throughput should exceed 50,000 IDs/sec");
    }

    @Test
    @DisplayName("Test Clock-Regression Handling")
    void testClockRegressionHandling() {
        AtomicLong simulatedClock = new AtomicLong(1767225600000L + 100_000L);

        // Test generator with controllable clock
        SnowflakeIdGenerator generator = new SnowflakeIdGenerator(1, SnowflakeIdGenerator.DEFAULT_CUSTOM_EPOCH, 10L) {
            @Override
            protected long currentTime() {
                return simulatedClock.get();
            }
        };

        long id1 = generator.nextId();
        assertNotNull(id1);

        // 1. Small regression within tolerance (5ms < 10ms tolerance)
        simulatedClock.addAndGet(-5);
        // Advance clock after short delay so spin wait exits
        Executors.newSingleThreadScheduledExecutor().schedule(() -> {
            simulatedClock.addAndGet(10);
        }, 5, TimeUnit.MILLISECONDS);

        long id2 = generator.nextId();
        assertTrue(id2 > id1, "Should successfully generate next ID after clock catches up");

        // 2. Large regression exceeding tolerance (5000ms > 10ms tolerance)
        simulatedClock.addAndGet(-5000);
        assertThrows(ClockRegressionException.class, generator::nextId,
                "Must throw ClockRegressionException when clock moves backwards beyond threshold");
    }
}
