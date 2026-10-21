package com.banking.common.kvstore;

import java.util.*;
import java.util.concurrent.*;

/**
 * High-performance In-Memory Key-Value Store with TTL and LRU Eviction.
 *
 * Implements:
 * 1. ConcurrentHashMap for lock-free read access.
 * 2. Lazy TTL expiry on read/check operations.
 * 3. Proactive background daemon sweeper for timed cleanup.
 * 4. Optional LRU capacity capping to prevent out-of-memory under high loads.
 * 5. Full metrics instrumentation (get/put latency, hit ratio, eviction counts).
 *
 * @param <V> Type of stored values
 */
public class InMemoryTtlKeyValueStore<V> implements KeyValueStore<V> {

    private final ConcurrentHashMap<String, CacheEntry<V>> store = new ConcurrentHashMap<>();
    private final KeyValueStoreMetrics metrics = new KeyValueStoreMetrics();
    private final ScheduledExecutorService sweeper;
    private final int maxCapacity;

    public InMemoryTtlKeyValueStore() {
        this(0, 1000); // Unbounded capacity, 1 sec sweeper interval
    }

    public InMemoryTtlKeyValueStore(int maxCapacity) {
        this(maxCapacity, 1000);
    }

    public InMemoryTtlKeyValueStore(int maxCapacity, long sweepIntervalMillis) {
        this.maxCapacity = maxCapacity;
        this.sweeper = Executors.newSingleThreadScheduledExecutor(r -> {
            Thread t = new Thread(r, "kv-sweeper");
            t.setDaemon(true);
            return t;
        });

        if (sweepIntervalMillis > 0) {
            this.sweeper.scheduleWithFixedDelay(
                    this::sweepExpired,
                    sweepIntervalMillis, sweepIntervalMillis, TimeUnit.MILLISECONDS
            );
        }
    }

    @Override
    public V get(String key) {
        if (key == null) return null;
        long start = System.nanoTime();
        CacheEntry<V> entry = store.get(key);
        long now = System.currentTimeMillis();

        if (entry == null) {
            metrics.recordGet(false, System.nanoTime() - start);
            return null;
        }

        if (entry.isExpired(now)) {
            // Lazy eviction
            if (store.remove(key, entry)) {
                metrics.recordEviction();
            }
            metrics.recordGet(false, System.nanoTime() - start);
            return null;
        }

        entry.touch();
        metrics.recordGet(true, System.nanoTime() - start);
        return entry.getValue();
    }

    @Override
    public void put(String key, V value) {
        put(key, value, -1);
    }

    @Override
    public void put(String key, V value, long ttlMillis) {
        if (key == null || value == null) return;
        ensureCapacity();

        long expireAt = (ttlMillis > 0) ? (System.currentTimeMillis() + ttlMillis) : -1;
        store.put(key, new CacheEntry<>(value, expireAt));
        metrics.recordPut();
    }

    @Override
    public boolean putIfAbsent(String key, V value, long ttlMillis) {
        if (key == null || value == null) return false;

        long now = System.currentTimeMillis();
        CacheEntry<V> existing = store.get(key);
        if (existing != null && !existing.isExpired(now)) {
            return false;
        }

        // If existing is expired, remove it first
        if (existing != null && existing.isExpired(now)) {
            store.remove(key, existing);
            metrics.recordEviction();
        }

        ensureCapacity();
        long expireAt = (ttlMillis > 0) ? (now + ttlMillis) : -1;
        CacheEntry<V> newEntry = new CacheEntry<>(value, expireAt);
        CacheEntry<V> prev = store.putIfAbsent(key, newEntry);

        if (prev == null || prev.isExpired(now)) {
            metrics.recordPut();
            return true;
        }
        return false;
    }

    @Override
    public boolean remove(String key) {
        if (key == null) return false;
        CacheEntry<V> removed = store.remove(key);
        return removed != null && !removed.isExpired(System.currentTimeMillis());
    }

    @Override
    public boolean exists(String key) {
        return get(key) != null;
    }

    @Override
    public void clear() {
        store.clear();
    }

    @Override
    public int size() {
        return store.size();
    }

    @Override
    public int sweepExpired() {
        long now = System.currentTimeMillis();
        int evicted = 0;
        for (Map.Entry<String, CacheEntry<V>> entry : store.entrySet()) {
            if (entry.getValue().isExpired(now)) {
                if (store.remove(entry.getKey(), entry.getValue())) {
                    evicted++;
                }
            }
        }
        if (evicted > 0) {
            metrics.recordEvictions(evicted);
        }
        return evicted;
    }

    @Override
    public KeyValueStoreMetrics getMetrics() {
        return metrics;
    }

    @Override
    public void shutdown() {
        sweeper.shutdownNow();
    }

    private void ensureCapacity() {
        if (maxCapacity <= 0 || store.size() < maxCapacity) {
            return;
        }

        // 1. Try to evict expired items first
        if (sweepExpired() > 0 && store.size() < maxCapacity) {
            return;
        }

        // 2. Perform LRU eviction: find and remove the entry with the oldest lastAccessTimeMillis
        String oldestKey = null;
        long oldestTime = Long.MAX_VALUE;

        // Sample a batch of entries to keep eviction O(1) probabilistic LRU under high load
        int sampled = 0;
        for (Map.Entry<String, CacheEntry<V>> entry : store.entrySet()) {
            if (entry.getValue().getLastAccessTimeMillis() < oldestTime) {
                oldestTime = entry.getValue().getLastAccessTimeMillis();
                oldestKey = entry.getKey();
            }
            if (++sampled >= 20) {
                break;
            }
        }

        if (oldestKey != null) {
            if (store.remove(oldestKey) != null) {
                metrics.recordEviction();
            }
        }
    }
}
