package com.banking.common.sharding;

import com.banking.common.hashing.ConsistentHashRing;

import java.util.*;

/**
 * Routes account operations to the appropriate database shard.
 * Uses a ConsistentHashRing to distribute accountId keys across shards.
 */
public class ShardRouter {

    private final ConsistentHashRing<Shard> ring;

    public ShardRouter() {
        this(ConsistentHashRing.DEFAULT_VIRTUAL_NODES);
    }

    public ShardRouter(int virtualNodes) {
        this.ring = new ConsistentHashRing<>(virtualNodes);
    }

    public void addShard(Shard shard) {
        ring.addNode(shard);
    }

    public void removeShard(Shard shard) {
        ring.removeNode(shard);
    }

    /**
     * Resolves the primary shard responsible for an account.
     */
    public Shard getShard(String accountId) {
        if (accountId == null || accountId.isBlank()) {
            throw new IllegalArgumentException("accountId cannot be blank");
        }
        Shard shard = ring.getNode(accountId);
        if (shard == null) {
            throw new IllegalStateException("No shards available in the router");
        }
        return shard;
    }

    public Set<Shard> getAllShards() {
        return ring.getPhysicalNodes();
    }

    public int getShardCount() {
        return ring.getNodeCount();
    }

    public Map<Shard, Integer> getShardDistribution(Collection<String> accountIds) {
        return ring.getNodeLoad(accountIds);
    }

    public ConsistentHashRing<Shard> getRing() {
        return ring;
    }
}
