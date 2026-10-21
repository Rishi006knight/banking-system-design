package com.banking.common.snowflake;

import java.time.Instant;

/**
 * 64-bit Twitter Snowflake-style unique ID generator.
 *
 * Bit allocation:
 * +-------------------------------------------------------------------------+
 * | 1 Bit Unused | 41 Bit Timestamp | 10 Bit Node ID | 12 Bit Sequence Num |
 * +-------------------------------------------------------------------------+
 *
 * Properties:
 * 1. Monotonically increasing 64-bit integers (fits inside Java long and SQLite INTEGER).
 * 2. Generates up to 4,096 IDs per millisecond per node (~4.09 million IDs/sec).
 * 3. Supports up to 1,024 independent server nodes with zero inter-node coordination.
 * 4. Resilient to clock-regression up to configurable tolerance (default 10ms).
 */
public class SnowflakeIdGenerator implements IdGenerator {

    // Custom epoch: 2026-01-01T00:00:00Z (1767225600000L)
    public static final long DEFAULT_CUSTOM_EPOCH = 1767225600000L;

    public static final long NODE_ID_BITS = 10L;
    public static final long SEQUENCE_BITS = 12L;

    public static final long MAX_NODE_ID = ~(-1L << NODE_ID_BITS);       // 1023
    public static final long MAX_SEQUENCE = ~(-1L << SEQUENCE_BITS);     // 4095

    public static final long NODE_ID_SHIFT = SEQUENCE_BITS;              // 12
    public static final long TIMESTAMP_SHIFT = SEQUENCE_BITS + NODE_ID_BITS; // 22

    private final long customEpoch;
    private final long nodeId;
    private final long maxToleranceMillis;
    private final SnowflakeMetrics metrics = new SnowflakeMetrics();

    private long lastTimestamp = -1L;
    private long sequence = 0L;

    public SnowflakeIdGenerator(long nodeId) {
        this(nodeId, DEFAULT_CUSTOM_EPOCH, 10L);
    }

    public SnowflakeIdGenerator(long nodeId, long customEpoch, long maxToleranceMillis) {
        if (nodeId < 0 || nodeId > MAX_NODE_ID) {
            throw new IllegalArgumentException(String.format("nodeId must be between 0 and %d", MAX_NODE_ID));
        }
        if (customEpoch <= 0) {
            throw new IllegalArgumentException("customEpoch must be positive");
        }
        this.nodeId = nodeId;
        this.customEpoch = customEpoch;
        this.maxToleranceMillis = maxToleranceMillis;
    }

    @Override
    public synchronized long nextId() {
        long currentTimestamp = currentTime();

        if (currentTimestamp < lastTimestamp) {
            long regression = lastTimestamp - currentTimestamp;
            if (regression <= maxToleranceMillis) {
                // Clock drift within tolerance: spin-wait until clock catches up
                currentTimestamp = waitTillNextMillis(lastTimestamp);
            } else {
                throw new ClockRegressionException(
                        String.format("Clock moved backwards by %d ms. Refusing to generate ID.", regression),
                        regression
                );
            }
        }

        if (currentTimestamp == lastTimestamp) {
            sequence = (sequence + 1) & MAX_SEQUENCE;
            if (sequence == 0) {
                // Exhausted 4096 IDs in this millisecond; wait for next millisecond
                currentTimestamp = waitTillNextMillis(lastTimestamp);
            }
        } else {
            sequence = 0L;
        }

        lastTimestamp = currentTimestamp;
        metrics.recordGenerated();

        return ((currentTimestamp - customEpoch) << TIMESTAMP_SHIFT)
                | (nodeId << NODE_ID_SHIFT)
                | sequence;
    }

    @Override
    public SnowflakeMetrics getMetrics() {
        return metrics;
    }

    public long getNodeId() {
        return nodeId;
    }

    public long getCustomEpoch() {
        return customEpoch;
    }

    /**
     * Extracts absolute timestamp millis from a generated ID.
     */
    public long extractTimestamp(long id) {
        return (id >>> TIMESTAMP_SHIFT) + customEpoch;
    }

    /**
     * Extracts the node ID that generated this ID.
     */
    public int extractNodeId(long id) {
        return (int) ((id >>> NODE_ID_SHIFT) & MAX_NODE_ID);
    }

    /**
     * Extracts the sequence number within the millisecond.
     */
    public int extractSequence(long id) {
        return (int) (id & MAX_SEQUENCE);
    }

    /**
     * Human-readable inspection format.
     */
    public String format(long id) {
        long ts = extractTimestamp(id);
        int node = extractNodeId(id);
        int seq = extractSequence(id);
        return String.format("ID[%d: Time=%s, Node=%d, Seq=%d]", id, Instant.ofEpochMilli(ts), node, seq);
    }

    protected long currentTime() {
        return System.currentTimeMillis();
    }

    private long waitTillNextMillis(long lastTimestamp) {
        long timestamp = currentTime();
        while (timestamp <= lastTimestamp) {
            Thread.onSpinWait();
            timestamp = currentTime();
        }
        return timestamp;
    }
}
