package com.banking.common.sharding;

import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;

/**
 * Tracks performance and storage metrics per shard:
 * - Query count & execution latency
 * - Table row counts
 */
public class ShardMetrics {

    private final String shardId;
    private final AtomicLong totalQueries = new AtomicLong(0);
    private final AtomicLong totalExecutionTimeNanos = new AtomicLong(0);
    private final ConcurrentHashMap<String, Long> tableRowCounts = new ConcurrentHashMap<>();

    public ShardMetrics(String shardId) {
        this.shardId = shardId;
    }

    public void recordQuery(long durationNanos) {
        totalQueries.incrementAndGet();
        totalExecutionTimeNanos.addAndGet(durationNanos);
    }

    public void updateRowCount(String table, long count) {
        tableRowCounts.put(table, count);
    }

    public String getShardId() {
        return shardId;
    }

    public long getTotalQueries() {
        return totalQueries.get();
    }

    public double getAverageLatencyMillis() {
        long count = totalQueries.get();
        if (count == 0) return 0.0;
        return (double) totalExecutionTimeNanos.get() / (count * 1_000_000.0);
    }

    public Map<String, Long> getTableRowCounts() {
        return Collections.unmodifiableMap(tableRowCounts);
    }

    public long getTotalRows() {
        return tableRowCounts.values().stream().mapToLong(Long::longValue).sum();
    }

    @Override
    public String toString() {
        return String.format(
                "ShardMetrics{shard='%s', queries=%d, avgLatency=%.3fms, totalRows=%d}",
                shardId, totalQueries.get(), getAverageLatencyMillis(), getTotalRows()
        );
    }
}
