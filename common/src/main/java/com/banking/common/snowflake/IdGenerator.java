package com.banking.common.snowflake;

/**
 * Interface for generating globally unique 64-bit identifiers.
 */
public interface IdGenerator {

    /**
     * Generates the next unique 64-bit identifier.
     */
    long nextId();

    /**
     * Generates the next unique ID as a string.
     */
    default String nextIdStr() {
        return String.valueOf(nextId());
    }

    /**
     * Metrics on generation throughput.
     */
    SnowflakeMetrics getMetrics();
}
