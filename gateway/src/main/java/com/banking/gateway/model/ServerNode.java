package com.banking.gateway.model;

import java.util.Objects;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * Represents a backend bank-service instance in the Gateway's hash ring.
 */
public class ServerNode {

    private final String serverId;
    private final String url;
    private final AtomicBoolean healthy = new AtomicBoolean(true);
    private final AtomicInteger consecutiveFailures = new AtomicInteger(0);

    public ServerNode(String serverId, String url) {
        this.serverId = Objects.requireNonNull(serverId);
        this.url = Objects.requireNonNull(url);
    }

    public String getServerId() {
        return serverId;
    }

    public String getUrl() {
        return url;
    }

    public boolean isHealthy() {
        return healthy.get();
    }

    public void setHealthy(boolean status) {
        healthy.set(status);
        if (status) {
            consecutiveFailures.set(0);
        }
    }

    public int recordFailure() {
        return consecutiveFailures.incrementAndGet();
    }

    public void resetFailures() {
        consecutiveFailures.set(0);
        healthy.set(true);
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        ServerNode that = (ServerNode) o;
        return Objects.equals(serverId, that.serverId);
    }

    @Override
    public int hashCode() {
        return Objects.hash(serverId);
    }

    @Override
    public String toString() {
        return serverId;
    }
}
