package com.banking.common.kvstore;

/**
 * Wrapper holding cached value, expiration timestamp, and access tracking for LRU.
 */
public class CacheEntry<V> {

    private final V value;
    private final long expireAtMillis; // -1 if no expiration
    private volatile long lastAccessTimeMillis;

    public CacheEntry(V value, long expireAtMillis) {
        this.value = value;
        this.expireAtMillis = expireAtMillis;
        this.lastAccessTimeMillis = System.currentTimeMillis();
    }

    public V getValue() {
        return value;
    }

    public long getExpireAtMillis() {
        return expireAtMillis;
    }

    public long getLastAccessTimeMillis() {
        return lastAccessTimeMillis;
    }

    public void touch() {
        this.lastAccessTimeMillis = System.currentTimeMillis();
    }

    public boolean isExpired(long now) {
        return expireAtMillis > 0 && now >= expireAtMillis;
    }
}
