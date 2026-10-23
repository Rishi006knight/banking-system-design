package com.banking.common.sharding;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.List;

/**
 * Resilient ShardConnection that attempts operations on a primary connection (e.g. Turso / libSQL Cloud)
 * and seamlessly falls back to a secondary connection (e.g. Local SQLite) if the primary fails.
 */
public class FallbackShardConnection implements ShardConnection {

    private static final Logger log = LoggerFactory.getLogger(FallbackShardConnection.class);

    private final ShardConnection primary;
    private final ShardConnection fallback;
    private final String shardName;
    private volatile boolean primaryDisabled = false;

    public FallbackShardConnection(ShardConnection primary, ShardConnection fallback, String shardName) {
        this.primary = primary;
        this.fallback = fallback;
        this.shardName = shardName != null ? shardName : "shard";
    }

    public FallbackShardConnection(ShardConnection primary, ShardConnection fallback) {
        this(primary, fallback, "shard");
    }

    @Override
    public QueryResult executeQuery(String sql, Object... params) {
        if (!primaryDisabled) {
            try {
                return primary.executeQuery(sql, params);
            } catch (Exception e) {
                log.warn("[{}] Primary database error on executeQuery, falling back to local SQLite: {}", shardName, e.getMessage());
            }
        }
        return fallback.executeQuery(sql, params);
    }

    @Override
    public int executeUpdate(String sql, Object... params) {
        if (!primaryDisabled) {
            try {
                int res = primary.executeUpdate(sql, params);
                try {
                    fallback.executeUpdate(sql, params);
                } catch (Exception ignored) {
                }
                return res;
            } catch (Exception e) {
                log.warn("[{}] Primary database error on executeUpdate, falling back to local SQLite: {}", shardName, e.getMessage());
            }
        }
        return fallback.executeUpdate(sql, params);
    }

    @Override
    public void executeBatch(List<String> sqlStatements) {
        if (!primaryDisabled) {
            try {
                primary.executeBatch(sqlStatements);
                try {
                    fallback.executeBatch(sqlStatements);
                } catch (Exception ignored) {
                }
                return;
            } catch (Exception e) {
                log.warn("[{}] Primary database error on executeBatch, falling back to local SQLite: {}", shardName, e.getMessage());
            }
        }
        fallback.executeBatch(sqlStatements);
    }

    @Override
    public void executeInTransaction(TransactionCallback callback) {
        if (!primaryDisabled) {
            try {
                primary.executeInTransaction(callback);
                return;
            } catch (Exception e) {
                log.warn("[{}] Primary database error on executeInTransaction, falling back to local SQLite: {}", shardName, e.getMessage());
            }
        }
        fallback.executeInTransaction(callback);
    }

    @Override
    public boolean isHealthy() {
        if (!primaryDisabled && primary.isHealthy()) {
            return true;
        }
        return fallback.isHealthy();
    }

    @Override
    public void close() {
        try {
            primary.close();
        } catch (Exception ignored) {
        }
        try {
            fallback.close();
        } catch (Exception ignored) {
        }
    }

    public ShardConnection getPrimary() {
        return primary;
    }

    public ShardConnection getFallback() {
        return fallback;
    }
}
