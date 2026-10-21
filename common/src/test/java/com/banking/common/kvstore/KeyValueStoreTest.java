package com.banking.common.kvstore;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.jupiter.api.Assertions.*;

class KeyValueStoreTest {

    private InMemoryTtlKeyValueStore<String> store;

    @BeforeEach
    void setUp() {
        store = new InMemoryTtlKeyValueStore<>(1000, 100); // 100ms sweep interval
    }

    @AfterEach
    void tearDown() {
        store.shutdown();
    }

    @Test
    @DisplayName("Test Basic Get/Put/Remove and Exists")
    void testBasicOperations() {
        store.put("token:alice", "session-token-1234");
        assertTrue(store.exists("token:alice"));
        assertEquals("session-token-1234", store.get("token:alice"));

        assertTrue(store.remove("token:alice"));
        assertNull(store.get("token:alice"));
        assertFalse(store.exists("token:alice"));
    }

    @Test
    @DisplayName("Test TTL Expiration (Lazy and Active Sweeper)")
    void testTtlExpiration() throws InterruptedException {
        // Put with short TTL of 150ms
        store.put("otp:bob", "482910", 150);
        assertEquals("482910", store.get("otp:bob"));

        // Wait for expiration
        Thread.sleep(250);

        // Lazy check
        assertNull(store.get("otp:bob"));
        assertFalse(store.exists("otp:bob"));

        // Put another key and let active sweeper clean it
        store.put("temp:key", "val", 100);
        assertEquals(1, store.size());
        Thread.sleep(250);
        store.sweepExpired();
        assertEquals(0, store.size());
    }

    @Test
    @DisplayName("Test PutIfAbsent for Idempotency Keys")
    void testPutIfAbsentIdempotency() {
        String idemKey = "idempotency:tx-999";
        assertTrue(store.putIfAbsent(idemKey, "COMPLETED", 5000));

        // Duplicate attempt must fail
        assertFalse(store.putIfAbsent(idemKey, "DUPLICATE", 5000));
        assertEquals("COMPLETED", store.get(idemKey));
    }

    @Test
    @DisplayName("Test LRU Capacity Eviction")
    void testLruCapacityEviction() {
        // Store with max capacity of 3
        InMemoryTtlKeyValueStore<String> smallStore = new InMemoryTtlKeyValueStore<>(3, 0);

        smallStore.put("k1", "v1");
        smallStore.put("k2", "v2");
        smallStore.put("k3", "v3");
        assertEquals(3, smallStore.size());

        // Access k1 to make it most recently used
        smallStore.get("k1");

        // Insert 4th item; must trigger LRU eviction
        smallStore.put("k4", "v4");
        assertTrue(smallStore.size() <= 3);

        smallStore.shutdown();
    }

    @Test
    @DisplayName("Concurrency Test: High Parallel Read/Write Operations")
    void testConcurrencyAndMetrics() throws InterruptedException {
        int threads = 16;
        int operationsPerThread = 2000;
        ExecutorService executor = Executors.newFixedThreadPool(threads);
        CountDownLatch latch = new CountDownLatch(threads);
        AtomicInteger hitCount = new AtomicInteger(0);

        // Pre-populate some keys
        for (int i = 0; i < 100; i++) {
            store.put("balance:ACC-" + i, "1000.00");
        }

        for (int t = 0; t < threads; t++) {
            final int threadId = t;
            executor.submit(() -> {
                try {
                    for (int i = 0; i < operationsPerThread; i++) {
                        String key = "balance:ACC-" + (i % 120); // 0-99 will hit, 100-119 will miss
                        if (i % 5 == 0) {
                            store.put(key, "1500.00", 60_000);
                        } else {
                            String val = store.get(key);
                            if (val != null) {
                                hitCount.incrementAndGet();
                            }
                        }
                    }
                } finally {
                    latch.countDown();
                }
            });
        }

        assertTrue(latch.await(10, TimeUnit.SECONDS));
        executor.shutdown();

        KeyValueStoreMetrics metrics = store.getMetrics();
        System.out.println("==================================================================");
        System.out.println("KV STORE CONCURRENCY METRICS:");
        System.out.printf("Total Gets: %d, Hits: %d, Misses: %d, Hit Ratio: %.2f%%%n",
                metrics.getTotalGets(), metrics.getHits(), metrics.getMisses(), metrics.getHitRatio());
        System.out.printf("Total Puts: %d, Evictions: %d, Avg Latency: %.2f ns%n",
                metrics.getTotalPuts(), metrics.getTotalEvictions(), metrics.getAverageGetLatencyNanos());
        System.out.println("==================================================================");

        assertTrue(metrics.getTotalGets() > 0);
        assertTrue(metrics.getHits() > 0);
        assertTrue(metrics.getHitRatio() > 50.0);
    }
}
