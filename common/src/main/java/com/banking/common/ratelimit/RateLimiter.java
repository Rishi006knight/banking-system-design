package com.banking.common.ratelimit;

/**
 * Core interface for rate limiting incoming requests.
 */
public interface RateLimiter {

    /**
     * Attempts to acquire 1 token for the specified key using the given rule configuration.
     *
     * @param key unique identifier (e.g., client IP or customer ID)
     * @param config rate limiting rules
     * @return result indicating if allowed, remaining tokens, or retry-after wait time
     */
    default RateLimitResult tryAcquire(String key, RateLimitConfig config) {
        return tryAcquire(key, config, 1);
    }

    /**
     * Attempts to acquire specified number of tokens.
     */
    RateLimitResult tryAcquire(String key, RateLimitConfig config, long tokens);

    /**
     * Global metrics for this rate limiter.
     */
    RateLimiterMetrics getGlobalMetrics();

    /**
     * Metrics partitioned by rule/endpoint name.
     */
    RateLimiterMetrics getMetrics(String ruleName);

    /**
     * Number of currently tracked buckets in memory.
     */
    int getActiveBucketCount();

    /**
     * Evicts buckets that haven't been touched in maxIdleMillis.
     */
    int cleanupStaleBuckets(long maxIdleMillis);

    /**
     * Releases any background resources/timers.
     */
    void shutdown();
}
