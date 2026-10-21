package com.banking.common.ratelimit;

import java.time.Duration;

/**
 * Configuration for a Token Bucket rate limit rule.
 * Defines bucket capacity and token replenishment rate.
 */
public class RateLimitConfig {

    private final String name;
    private final long capacity;
    private final long refillTokens;
    private final long refillPeriodMillis;

    public RateLimitConfig(String name, long capacity, long refillTokens, long refillPeriodMillis) {
        if (capacity <= 0) {
            throw new IllegalArgumentException("Capacity must be positive");
        }
        if (refillTokens <= 0) {
            throw new IllegalArgumentException("Refill tokens must be positive");
        }
        if (refillPeriodMillis <= 0) {
            throw new IllegalArgumentException("Refill period must be positive");
        }
        this.name = name;
        this.capacity = capacity;
        this.refillTokens = refillTokens;
        this.refillPeriodMillis = refillPeriodMillis;
    }

    /**
     * Helper to create rate limit: capacity tokens per duration.
     */
    public static RateLimitConfig of(String name, long capacity, Duration period) {
        return new RateLimitConfig(name, capacity, capacity, period.toMillis());
    }

    /**
     * Strict rule: 5 requests per minute (used for Login / Auth to prevent brute force).
     */
    public static RateLimitConfig strictLogin() {
        return new RateLimitConfig("LOGIN_STRICT", 5, 5, 60_000);
    }

    /**
     * Moderate rule: 30 requests per minute (used for Transfers & Bill Payments).
     */
    public static RateLimitConfig moderateTransfer() {
        return new RateLimitConfig("TRANSFER_MODERATE", 30, 30, 60_000);
    }

    /**
     * Lenient rule: 120 requests per minute (used for Balance & History Enquiries).
     */
    public static RateLimitConfig lenientEnquiry() {
        return new RateLimitConfig("ENQUIRY_LENIENT", 120, 120, 60_000);
    }

    public String getName() {
        return name;
    }

    public long getCapacity() {
        return capacity;
    }

    public long getRefillTokens() {
        return refillTokens;
    }

    public long getRefillPeriodMillis() {
        return refillPeriodMillis;
    }

    /**
     * Rate in tokens per millisecond.
     */
    public double getTokensPerMillis() {
        return (double) refillTokens / (double) refillPeriodMillis;
    }
}
