package com.banking.gateway.router;

import com.banking.common.hashing.ConsistentHashRing;
import com.banking.gateway.model.ServerNode;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Routes incoming API requests across backend bank-service instances
 * using the Consistent Hash Ring with virtual nodes.
 */
@Component
public class GatewayHashRingRouter {

    private final ConsistentHashRing<ServerNode> ring;
    private final Map<String, ServerNode> allServers = new ConcurrentHashMap<>();

    public GatewayHashRingRouter(@Value("${gateway.virtual-nodes:150}") int virtualNodes) {
        this.ring = new ConsistentHashRing<>(virtualNodes);
    }

    public synchronized void registerServer(ServerNode node) {
        allServers.put(node.getServerId(), node);
        if (node.isHealthy()) {
            ring.addNode(node);
        }
    }

    public synchronized void markServerDown(ServerNode node) {
        node.setHealthy(false);
        ring.removeNode(node);
    }

    public synchronized void markServerHealthy(ServerNode node) {
        node.setHealthy(true);
        ring.addNode(node);
    }

    /**
     * Resolves the primary healthy backend server for a given key.
     */
    public ServerNode route(String key) {
        if (key == null || key.isBlank()) {
            key = "default-key";
        }
        return ring.getNode(key);
    }

    public List<ServerNode> getAllServers() {
        return new ArrayList<>(allServers.values());
    }

    public Set<ServerNode> getActiveServers() {
        return ring.getPhysicalNodes();
    }

    public ConsistentHashRing<ServerNode> getRing() {
        return ring;
    }
}
