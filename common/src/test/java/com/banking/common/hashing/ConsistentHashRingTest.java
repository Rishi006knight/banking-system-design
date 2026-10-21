package com.banking.common.hashing;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.*;
import java.util.concurrent.*;

import static org.junit.jupiter.api.Assertions.*;

class ConsistentHashRingTest {

    @Test
    @DisplayName("Test Ring Basic Routing and Node Removal")
    void testBasicRoutingAndRemoval() {
        ConsistentHashRing<String> ring = new ConsistentHashRing<>(150);
        ring.addNode("server-8081");
        ring.addNode("server-8082");
        ring.addNode("server-8083");

        assertEquals(3, ring.getNodeCount());
        assertEquals(450, ring.getVirtualNodeCount());

        String node1 = ring.getNode("ACC-10001");
        String node2 = ring.getNode("ACC-10002");
        assertNotNull(node1);
        assertNotNull(node2);

        // Deterministic routing
        assertEquals(node1, ring.getNode("ACC-10001"));

        // Remove node1 and verify re-routing
        ring.removeNode(node1);
        assertEquals(2, ring.getNodeCount());
        String newDestination = ring.getNode("ACC-10001");
        assertNotNull(newDestination);
        assertNotEquals(node1, newDestination);
    }

    @Test
    @DisplayName("Compare Virtual Nodes Distribution Efficacy (1 vnode vs 150 vnodes)")
    void testVirtualNodesDistribution() {
        int keyCount = 10_000;
        List<String> keys = new ArrayList<>(keyCount);
        for (int i = 0; i < keyCount; i++) {
            keys.add("account-" + UUID.randomUUID());
        }

        // Ring with only 1 virtual node per physical node
        ConsistentHashRing<String> poorRing = new ConsistentHashRing<>(1);
        poorRing.addNode("node-A");
        poorRing.addNode("node-B");
        poorRing.addNode("node-C");
        Map<String, Integer> poorLoad = poorRing.getNodeLoad(keys);
        double poorStdDev = ConsistentHashMetrics.calculateStandardDeviation(poorLoad);

        // Ring with 150 virtual nodes per physical node
        ConsistentHashRing<String> goodRing = new ConsistentHashRing<>(150);
        goodRing.addNode("node-A");
        goodRing.addNode("node-B");
        goodRing.addNode("node-C");
        Map<String, Integer> goodLoad = goodRing.getNodeLoad(keys);
        double goodStdDev = ConsistentHashMetrics.calculateStandardDeviation(goodLoad);

        System.out.printf("Load Distribution with 1 VNode: %s (StdDev: %.2f)%n", poorLoad, poorStdDev);
        System.out.printf("Load Distribution with 150 VNodes: %s (StdDev: %.2f)%n", goodLoad, goodStdDev);

        // Standard deviation with 150 virtual nodes must be significantly lower than with 1 vnode
        assertTrue(goodStdDev < poorStdDev, "150 VNodes must yield significantly lower standard deviation than 1 VNode");
    }

    @Test
    @DisplayName("Key Remapping Comparison: Consistent Hashing vs Naive Modulo")
    void testRemapComparison() {
        int keyCount = 10_000;
        List<String> keys = new ArrayList<>(keyCount);
        for (int i = 0; i < keyCount; i++) {
            keys.add("key-" + i);
        }

        // 1. Consistent Hash Ring with 3 initial nodes
        ConsistentHashRing<String> ring = new ConsistentHashRing<>(150);
        ring.addNode("server-1");
        ring.addNode("server-2");
        ring.addNode("server-3");

        double ringRemapPct = ConsistentHashMetrics.calculateRingRemapPercentageOnAdd(ring, "server-4", keys);

        // 2. Naive Modulo Router with 3 initial nodes
        NaiveModuloRouter<String> moduloRouter = new NaiveModuloRouter<>();
        moduloRouter.addNode("server-1");
        moduloRouter.addNode("server-2");
        moduloRouter.addNode("server-3");

        double moduloRemapPct = ConsistentHashMetrics.calculateModuloRemapPercentageOnAdd(moduloRouter, "server-4", keys);

        System.out.println("==================================================================");
        System.out.printf("CONSISTENT HASHING REMAP (3 -> 4 nodes): %.2f%%%n", ringRemapPct);
        System.out.printf("NAIVE MODULO HASHING REMAP (3 -> 4 nodes): %.2f%%%n", moduloRemapPct);
        System.out.println("==================================================================");

        // Theoretical expectation:
        // Ring remap should be close to 1/(3+1) = 25% (tolerance: 18% to 32%)
        // Modulo remap is typically ~75% (3 out of 4 keys remapped)
        assertTrue(ringRemapPct < 35.0, "Ring remap should be around 25%");
        assertTrue(moduloRemapPct > 70.0, "Modulo remap should be > 70%");
        assertTrue(ringRemapPct < moduloRemapPct, "Consistent Hashing must remap drastically fewer keys than Modulo");
    }

    @Test
    @DisplayName("Concurrency Test: Concurrent Ring Readers and Node Modifiers")
    void testConcurrentAccess() throws InterruptedException {
        ConsistentHashRing<String> ring = new ConsistentHashRing<>(50);
        ring.addNode("node-1");
        ring.addNode("node-2");

        int readers = 10;
        ExecutorService executor = Executors.newFixedThreadPool(readers + 2);
        CountDownLatch latch = new CountDownLatch(readers);

        // Readers
        for (int i = 0; i < readers; i++) {
            executor.submit(() -> {
                try {
                    for (int j = 0; j < 5000; j++) {
                        String node = ring.getNode("key-" + j);
                        assertNotNull(node);
                    }
                } finally {
                    latch.countDown();
                }
            });
        }

        // Concurrent node mutator
        executor.submit(() -> {
            try {
                Thread.sleep(10);
                ring.addNode("node-3");
                Thread.sleep(10);
                ring.removeNode("node-1");
            } catch (InterruptedException ignored) {}
        });

        assertTrue(latch.await(5, TimeUnit.SECONDS));
        executor.shutdown();
    }
}
