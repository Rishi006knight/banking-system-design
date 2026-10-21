package com.banking.common.sharding;

import java.util.Objects;

/**
 * Represents a database shard instance.
 */
public class Shard {

    private final String shardId;
    private final String name;
    private final ShardConnection connection;

    public Shard(String shardId, String name, ShardConnection connection) {
        this.shardId = Objects.requireNonNull(shardId, "shardId cannot be null");
        this.name = (name != null) ? name : shardId;
        this.connection = connection;
    }

    public String getShardId() {
        return shardId;
    }

    public String getName() {
        return name;
    }

    public ShardConnection getConnection() {
        return connection;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        Shard shard = (Shard) o;
        return Objects.equals(shardId, shard.shardId);
    }

    @Override
    public int hashCode() {
        return Objects.hash(shardId);
    }

    @Override
    public String toString() {
        return shardId;
    }
}
