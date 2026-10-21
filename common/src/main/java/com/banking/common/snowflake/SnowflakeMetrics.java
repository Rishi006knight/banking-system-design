package com.banking.common.snowflake;

import java.util.concurrent.atomic.AtomicLong;

/**
 * Tracks generation throughput and performance metrics for the Snowflake ID generator.
 */
public class SnowflakeMetrics {

    private final AtomicLong generatedCount = new AtomicLong(0);
    private final long startTimeMillis = System.currentTimeMillis();

    public void recordGenerated() {
        generatedCount.incrementAndGet();
    }

    public void recordGenerated(long count) {
        generatedCount.addAndGet(count);
    }

    public long getGeneratedCount() {
        return generatedCount.get();
    }

    public double getGenerationRatePerSecond() {
        long duration = Math.max(1, System.currentTimeMillis() - startTimeMillis);
        return (double) generatedCount.get() * 1000.0 / (double) duration;
    }

    @Override
    public String toString() {
        return String.format(
                "SnowflakeMetrics{totalGenerated=%d, rate=%.2f IDs/sec}",
                generatedCount.get(), getGenerationRatePerSecond()
        );
    }
}
