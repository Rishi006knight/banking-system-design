package com.banking.common.ratelimit;

/**
 * Result returned by a rate limiter check.
 * Maps cleanly to HTTP 429 response headers:
 * - Retry-After (seconds)
 * - X-RateLimit-Remaining
 */
public class RateLimitResult {

    private final boolean allowed;
    private final long remainingTokens;
    private final long retryAfterMillis;
    private final String ruleName;

    public RateLimitResult(boolean allowed, long remainingTokens, long retryAfterMillis, String ruleName) {
        this.allowed = allowed;
        this.remainingTokens = Math.max(0, remainingTokens);
        this.retryAfterMillis = Math.max(0, retryAfterMillis);
        this.ruleName = ruleName;
    }

    public static RateLimitResult allow(long remainingTokens, String ruleName) {
        return new RateLimitResult(true, remainingTokens, 0, ruleName);
    }

    public static RateLimitResult reject(long retryAfterMillis, String ruleName) {
        return new RateLimitResult(false, 0, retryAfterMillis, ruleName);
    }

    public boolean isAllowed() {
        return allowed;
    }

    public long getRemainingTokens() {
        return remainingTokens;
    }

    public long getRetryAfterMillis() {
        return retryAfterMillis;
    }

    /**
     * Retry-After header value in seconds (rounded up to nearest whole second).
     */
    public long getRetryAfterSeconds() {
        return (retryAfterMillis + 999) / 1000;
    }

    public String getRuleName() {
        return ruleName;
    }

    @Override
    public String toString() {
        return "RateLimitResult{" +
                "allowed=" + allowed +
                ", remainingTokens=" + remainingTokens +
                ", retryAfterMillis=" + retryAfterMillis +
                ", ruleName='" + ruleName + '\'' +
                '}';
    }
}
