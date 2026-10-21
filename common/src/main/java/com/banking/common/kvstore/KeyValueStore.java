package com.banking.common.kvstore;

/**
 * Interface for the Redis-equivalent high-performance in-memory key-value store.
 */
public interface KeyValueStore<V> {

    /**
     * Retrieves value by key. Returns null if not found or expired.
     */
    V get(String key);

    /**
     * Stores value with no expiration.
     */
    void put(String key, V value);

    /**
     * Stores value with a time-to-live (TTL) in milliseconds.
     */
    void put(String key, V value, long ttlMillis);

    /**
     * Stores value with TTL only if key does not exist or is expired.
     * Useful for distributed locking, idempotency keys, and OTP reservation.
     */
    boolean putIfAbsent(String key, V value, long ttlMillis);

    /**
     * Removes an entry by key.
     */
    boolean remove(String key);

    /**
     * Checks if key exists and has not expired.
     */
    boolean exists(String key);

    /**
     * Clears all entries from the store.
     */
    void clear();

    /**
     * Current count of active entries.
     */
    int size();

    /**
     * Proactively evicts all currently expired entries.
     * @return count of keys evicted
     */
    int sweepExpired();

    /**
     * Metrics snapshot for performance monitoring.
     */
    KeyValueStoreMetrics getMetrics();

    /**
     * Releases background sweeper threads.
     */
    void shutdown();
}
