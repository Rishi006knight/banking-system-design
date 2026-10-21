package com.banking.common.ratelimit;

import java.util.concurrent.atomic.AtomicLong;

/**
 * Thread-safe metrics snapshot for Rate Limiter monitoring.
 */
public class RateLimiterMetrics {

    private final AtomicLong totalRequests = new AtomicLong(0);
    private final AtomicLong allowedRequests = new AtomicLong(0);
    private final AtomicLong rejectedRequests = new AtomicLong(0);

    public void recordAllowed() {
        totalRequests.incrementAndGet();
        allowedRequests.incrementAndGet();
    }

    public void recordRejected() {
        totalRequests.incrementAndGet();
        rejectedRequests.incrementAndGet();
    }

    public long getTotalRequests() {
        return totalRequests.get();
    }

    public long getAllowedRequests() {
        return allowedRequests.get();
    }

    public long getRejectedRequests() {
        return rejectedRequests.get();
    }

    /**
     * Percentage of requests rejected (0.0 to 100.0).
     */
    public double getRejectionRate() {
        long total = totalRequests.get();
        if (total == 0) {
            return 0.0;
        }
        return (double) rejectedRequests.get() * 100.0 / (double) total;
    }

    public void reset() {
        totalRequests.set(0);
        allowedRequests.set(0);
        rejectedRequests.set(0);
    }

    @Override
    public String toString() {
        return String.format(
                "RateLimiterMetrics{total=%d, allowed=%d, rejected=%d, rejectionRate=%.2f%%}",
                totalRequests.get(), allowedRequests.get(), rejectedRequests.get(), getRejectionRate()
        );
    }
}
