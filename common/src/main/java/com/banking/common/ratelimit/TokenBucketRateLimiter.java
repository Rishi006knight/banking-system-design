package com.banking.common.ratelimit;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

/**
 * High-performance, thread-safe Token Bucket Rate Limiter.
 *
 * Implements:
 * 1. Token bucket per key (user ID, IP, or endpoint) in ConcurrentHashMap.
 * 2. Lazy token refill based on elapsed wall-clock time.
 * 3. Lock-per-bucket concurrency: Requests for different keys execute in parallel
 *    with zero cross-key contention.
 * 4. Stale bucket eviction via background sweeper thread and explicit cleanup.
 * 5. Full metrics instrumentation (requests, allowed, rejected, rejection rate).
 */
public class TokenBucketRateLimiter implements RateLimiter {

    private final ConcurrentHashMap<String, TokenBucket> buckets = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<String, RateLimiterMetrics> ruleMetrics = new ConcurrentHashMap<>();
    private final RateLimiterMetrics globalMetrics = new RateLimiterMetrics();
    private final ScheduledExecutorService cleanupExecutor;
    private final long defaultMaxIdleMillis;

    public TokenBucketRateLimiter() {
        this(5 * 60 * 1000L); // 5 minutes default idle time
    }

    public TokenBucketRateLimiter(long defaultMaxIdleMillis) {
        this.defaultMaxIdleMillis = defaultMaxIdleMillis;
        this.cleanupExecutor = Executors.newSingleThreadScheduledExecutor(r -> {
            Thread t = new Thread(r, "rate-limiter-cleaner");
            t.setDaemon(true);
            return t;
        });
        // Run periodic stale bucket cleanup every 30 seconds
        this.cleanupExecutor.scheduleWithFixedDelay(
                () -> cleanupStaleBuckets(this.defaultMaxIdleMillis),
                30, 30, TimeUnit.SECONDS
        );
    }

    @Override
    public RateLimitResult tryAcquire(String key, RateLimitConfig config, long requestedTokens) {
        if (key == null || key.isBlank()) {
            key = "anonymous";
        }
        if (config == null) {
            throw new IllegalArgumentException("RateLimitConfig cannot be null");
        }
        if (requestedTokens <= 0) {
            throw new IllegalArgumentException("Requested tokens must be positive");
        }

        String compositeKey = config.getName() + ":" + key;
        TokenBucket bucket = buckets.computeIfAbsent(
                compositeKey,
                k -> new TokenBucket(config.getCapacity(), System.currentTimeMillis())
        );

        RateLimiterMetrics ruleMetric = ruleMetrics.computeIfAbsent(
                config.getName(),
                k -> new RateLimiterMetrics()
        );

        long now = System.currentTimeMillis();
        synchronized (bucket) {
            bucket.lastAccessMillis = now;

            // 1. Lazy refill based on elapsed time
            long elapsedMillis = Math.max(0, now - bucket.lastRefillMillis);
            if (elapsedMillis > 0) {
                double tokensToAdd = elapsedMillis * config.getTokensPerMillis();
                bucket.tokens = Math.min(config.getCapacity(), bucket.tokens + tokensToAdd);
                bucket.lastRefillMillis = now;
            }

            // 2. Evaluate token availability
            if (bucket.tokens >= requestedTokens) {
                bucket.tokens -= requestedTokens;
                globalMetrics.recordAllowed();
                ruleMetric.recordAllowed();
                return RateLimitResult.allow((long) bucket.tokens, config.getName());
            } else {
                double needed = requestedTokens - bucket.tokens;
                long retryAfterMillis = Math.max(1, (long) Math.ceil(needed / config.getTokensPerMillis()));
                globalMetrics.recordRejected();
                ruleMetric.recordRejected();
                return RateLimitResult.reject(retryAfterMillis, config.getName());
            }
        }
    }

    @Override
    public RateLimiterMetrics getGlobalMetrics() {
        return globalMetrics;
    }

    @Override
    public RateLimiterMetrics getMetrics(String ruleName) {
        return ruleMetrics.getOrDefault(ruleName, new RateLimiterMetrics());
    }

    public Map<String, RateLimiterMetrics> getAllRuleMetrics() {
        return Map.copyOf(ruleMetrics);
    }

    @Override
    public int getActiveBucketCount() {
        return buckets.size();
    }

    @Override
    public int cleanupStaleBuckets(long maxIdleMillis) {
        long cutoff = System.currentTimeMillis() - maxIdleMillis;
        int removedCount = 0;
        for (Map.Entry<String, TokenBucket> entry : buckets.entrySet()) {
            TokenBucket bucket = entry.getValue();
            if (bucket.lastAccessMillis < cutoff) {
                if (buckets.remove(entry.getKey(), bucket)) {
                    removedCount++;
                }
            }
        }
        return removedCount;
    }

    @Override
    public void shutdown() {
        cleanupExecutor.shutdownNow();
    }

    /**
     * Internal state representation of a single token bucket.
     */
    private static class TokenBucket {
        private double tokens;
        private long lastRefillMillis;
        private volatile long lastAccessMillis;

        TokenBucket(double initialTokens, long now) {
            this.tokens = initialTokens;
            this.lastRefillMillis = now;
            this.lastAccessMillis = now;
        }
    }
}
