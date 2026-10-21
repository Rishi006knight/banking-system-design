package com.banking.common.hashing;

import java.util.*;

/**
 * Metric calculations for Consistent Hashing vs Naive Modulo routing:
 * - Load distribution across nodes
 * - Standard deviation of load (measures balancing efficacy)
 * - Remapping percentage upon node scale-out/scale-in
 */
public class ConsistentHashMetrics {

    /**
     * Calculates the standard deviation of key distribution across nodes.
     * Lower standard deviation means a more uniform, balanced distribution.
     */
    public static <T> double calculateStandardDeviation(Map<T, Integer> loadDistribution) {
        if (loadDistribution == null || loadDistribution.isEmpty()) {
            return 0.0;
        }
        double sum = 0.0;
        for (int count : loadDistribution.values()) {
            sum += count;
        }
        double mean = sum / loadDistribution.size();

        double varianceSum = 0.0;
        for (int count : loadDistribution.values()) {
            varianceSum += Math.pow(count - mean, 2);
        }
        return Math.sqrt(varianceSum / loadDistribution.size());
    }

    /**
     * Measures the percentage of keys remapped on a ConsistentHashRing when a new node is added.
     * Theoretical expectation: approximately 1 / (N + 1) * 100%.
     *
     * @param initialRing ring with N nodes
     * @param newNode node to be added (N+1)
     * @param testKeys list of sample keys
     * @return percentage of keys whose designated node changed (0.0 to 100.0)
     */
    public static <T> double calculateRingRemapPercentageOnAdd(
            ConsistentHashRing<T> initialRing,
            T newNode,
            List<String> testKeys) {

        if (testKeys == null || testKeys.isEmpty()) {
            return 0.0;
        }

        // 1. Record original placements
        Map<String, T> originalPlacements = new HashMap<>(testKeys.size());
        for (String key : testKeys) {
            originalPlacements.put(key, initialRing.getNode(key));
        }

        // 2. Add node
        initialRing.addNode(newNode);

        // 3. Count remapped keys
        int remappedCount = 0;
        for (String key : testKeys) {
            T newPlacement = initialRing.getNode(key);
            T oldPlacement = originalPlacements.get(key);
            if (!Objects.equals(oldPlacement, newPlacement)) {
                remappedCount++;
            }
        }

        return (double) remappedCount * 100.0 / (double) testKeys.size();
    }

    /**
     * Measures the percentage of keys remapped on a NaiveModuloRouter when a new node is added.
     * Theoretical expectation: approximately N / (N + 1) * 100% (often 75% - 90%).
     */
    public static <T> double calculateModuloRemapPercentageOnAdd(
            NaiveModuloRouter<T> initialRouter,
            T newNode,
            List<String> testKeys) {

        if (testKeys == null || testKeys.isEmpty()) {
            return 0.0;
        }

        // 1. Record original placements
        Map<String, T> originalPlacements = new HashMap<>(testKeys.size());
        for (String key : testKeys) {
            originalPlacements.put(key, initialRouter.getNode(key));
        }

        // 2. Add node
        initialRouter.addNode(newNode);

        // 3. Count remapped keys
        int remappedCount = 0;
        for (String key : testKeys) {
            T newPlacement = initialRouter.getNode(key);
            T oldPlacement = originalPlacements.get(key);
            if (!Objects.equals(oldPlacement, newPlacement)) {
                remappedCount++;
            }
        }

        return (double) remappedCount * 100.0 / (double) testKeys.size();
    }
}
