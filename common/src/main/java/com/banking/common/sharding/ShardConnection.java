package com.banking.common.sharding;

import java.util.List;

/**
 * Abstraction for database operations against a specific shard.
 * Supports both local SQLite/libSQL instances and remote Turso HTTP pipelines.
 */
public interface ShardConnection extends AutoCloseable {

    /**
     * Executes a SELECT query with parameters.
     */
    QueryResult executeQuery(String sql, Object... params);

    /**
     * Executes an INSERT/UPDATE/DELETE statement with parameters.
     * @return number of affected rows
     */
    int executeUpdate(String sql, Object... params);

    /**
     * Executes multiple statements in a single batch.
     */
    void executeBatch(List<String> sqlStatements);

    /**
     * Executes a series of operations atomically within a transaction.
     * If callback throws an exception, changes are rolled back.
     */
    void executeInTransaction(TransactionCallback callback);

    /**
     * Health check verifying database responsiveness.
     */
    boolean isHealthy();

    @Override
    void close();

    @FunctionalInterface
    interface TransactionCallback {
        void execute(ShardConnection txConnection) throws Exception;
    }
}
