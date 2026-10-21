package com.banking.common.kvstore;

import java.util.concurrent.atomic.AtomicLong;

/**
 * Thread-safe metrics tracker for the Key-Value Cache.
 */
public class KeyValueStoreMetrics {

    private final AtomicLong totalGets = new AtomicLong(0);
    private final AtomicLong hits = new AtomicLong(0);
    private final AtomicLong misses = new AtomicLong(0);
    private final AtomicLong totalPuts = new AtomicLong(0);
    private final AtomicLong totalEvictions = new AtomicLong(0);
    private final AtomicLong totalGetLatencyNanos = new AtomicLong(0);

    public void recordGet(boolean hit, long latencyNanos) {
        totalGets.incrementAndGet();
        if (hit) {
            hits.incrementAndGet();
        } else {
            misses.incrementAndGet();
        }
        totalGetLatencyNanos.addAndGet(latencyNanos);
    }

    public void recordPut() {
        totalPuts.incrementAndGet();
    }

    public void recordEviction() {
        totalEvictions.incrementAndGet();
    }

    public void recordEvictions(long count) {
        totalEvictions.addAndGet(count);
    }

    public long getTotalGets() {
        return totalGets.get();
    }

    public long getHits() {
        return hits.get();
    }

    public long getMisses() {
        return misses.get();
    }

    public long getTotalPuts() {
        return totalPuts.get();
    }

    public long getTotalEvictions() {
        return totalEvictions.get();
    }

    public double getHitRatio() {
        long total = totalGets.get();
        if (total == 0) return 0.0;
        return (double) hits.get() * 100.0 / (double) total;
    }

    public double getAverageGetLatencyNanos() {
        long total = totalGets.get();
        if (total == 0) return 0.0;
        return (double) totalGetLatencyNanos.get() / (double) total;
    }

    public void reset() {
        totalGets.set(0);
        hits.set(0);
        misses.set(0);
        totalPuts.set(0);
        totalEvictions.set(0);
        totalGetLatencyNanos.set(0);
    }

    @Override
    public String toString() {
        return String.format(
                "KeyValueStoreMetrics{gets=%d, hits=%d, misses=%d, hitRatio=%.2f%%, puts=%d, evictions=%d, avgLatency=%.2fns}",
                totalGets.get(), hits.get(), misses.get(), getHitRatio(),
                totalPuts.get(), totalEvictions.get(), getAverageGetLatencyNanos()
        );
    }
}
