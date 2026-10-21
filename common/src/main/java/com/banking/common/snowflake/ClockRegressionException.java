package com.banking.common.snowflake;

/**
 * Thrown when the system clock shifts backwards beyond the tolerable threshold.
 */
public class ClockRegressionException extends RuntimeException {

    private final long clockDifferenceMillis;

    public ClockRegressionException(String message, long clockDifferenceMillis) {
        super(message);
        this.clockDifferenceMillis = clockDifferenceMillis;
    }

    public long getClockDifferenceMillis() {
        return clockDifferenceMillis;
    }
}
