package com.banking.common.sharding;

import org.sqlite.SQLiteConfig;

import java.sql.*;
import java.util.*;

/**
 * High-performance local SQLite shard connection.
 * Configured with WAL mode, 5000ms busy timeout, IMMEDIATE transaction mode,
 * and automatic retry with exponential backoff on SQLITE_BUSY.
 */
public class LocalSqliteShardConnection implements ShardConnection {

    private final String jdbcUrl;
    private Connection connection;

    public LocalSqliteShardConnection(String jdbcUrl) {
        this.jdbcUrl = jdbcUrl;
        connect();
    }

    private synchronized void connect() {
        try {
            if (connection == null || connection.isClosed()) {
                SQLiteConfig config = new SQLiteConfig();
                config.setBusyTimeout(15000); // 15 second busy wait
                config.setJournalMode(SQLiteConfig.JournalMode.WAL);
                config.setSynchronous(SQLiteConfig.SynchronousMode.NORMAL);
                config.setTransactionMode(SQLiteConfig.TransactionMode.IMMEDIATE);
                config.enforceForeignKeys(true);
                connection = config.createConnection(jdbcUrl);

                try (Statement stmt = connection.createStatement()) {
                    stmt.execute("PRAGMA journal_mode = WAL;");
                    stmt.execute("PRAGMA synchronous = NORMAL;");
                    stmt.execute("PRAGMA foreign_keys = ON;");
                    stmt.execute("PRAGMA busy_timeout = 15000;");
                }
            }
        } catch (SQLException e) {
            throw new RuntimeException("Failed to establish SQLite connection: " + jdbcUrl, e);
        }
    }

    @Override
    public synchronized QueryResult executeQuery(String sql, Object... params) {
        int maxRetries = 5;
        for (int attempt = 1; attempt <= maxRetries; attempt++) {
            connect();
            try (PreparedStatement pstmt = connection.prepareStatement(sql)) {
                bindParams(pstmt, params);
                try (ResultSet rs = pstmt.executeQuery()) {
                    ResultSetMetaData meta = rs.getMetaData();
                    int colCount = meta.getColumnCount();
                    List<String> columns = new ArrayList<>(colCount);
                    for (int i = 1; i <= colCount; i++) {
                        columns.add(meta.getColumnLabel(i));
                    }

                    List<Map<String, Object>> rows = new ArrayList<>();
                    while (rs.next()) {
                        Map<String, Object> row = new LinkedHashMap<>();
                        for (int i = 1; i <= colCount; i++) {
                            row.put(columns.get(i - 1), rs.getObject(i));
                        }
                        rows.add(row);
                    }
                    return new QueryResult(columns, rows, rows.size());
                }
            } catch (SQLException e) {
                if (isBusyError(e) && attempt < maxRetries) {
                    sleepBackoff(attempt);
                    continue;
                }
                throw new RuntimeException("Failed executing query: " + sql, e);
            }
        }
        throw new RuntimeException("Failed executing query after retries: " + sql);
    }

    @Override
    public synchronized int executeUpdate(String sql, Object... params) {
        int maxRetries = 10;
        for (int attempt = 1; attempt <= maxRetries; attempt++) {
            connect();
            try (PreparedStatement pstmt = connection.prepareStatement(sql)) {
                bindParams(pstmt, params);
                return pstmt.executeUpdate();
            } catch (SQLException e) {
                if (isBusyError(e) && attempt < maxRetries) {
                    sleepBackoff(attempt);
                    continue;
                }
                throw new RuntimeException("Failed executing update: " + sql, e);
            }
        }
        throw new RuntimeException("Failed executing update after retries: " + sql);
    }

    @Override
    public synchronized void executeBatch(List<String> sqlStatements) {
        int maxRetries = 10;
        for (int attempt = 1; attempt <= maxRetries; attempt++) {
            connect();
            try (Statement stmt = connection.createStatement()) {
                for (String sql : sqlStatements) {
                    if (!sql.isBlank()) {
                        stmt.addBatch(sql);
                    }
                }
                stmt.executeBatch();
                return;
            } catch (SQLException e) {
                if (isBusyError(e) && attempt < maxRetries) {
                    sleepBackoff(attempt);
                    continue;
                }
                throw new RuntimeException("Failed executing batch statements", e);
            }
        }
    }

    @Override
    public synchronized void executeInTransaction(TransactionCallback callback) {
        int maxRetries = 10;
        for (int attempt = 1; attempt <= maxRetries; attempt++) {
            connect();
            boolean originalAutoCommit;
            try {
                originalAutoCommit = connection.getAutoCommit();
                connection.setAutoCommit(false);
                try {
                    callback.execute(this);
                    connection.commit();
                    return; // Success
                } catch (IllegalArgumentException | IllegalStateException e) {
                    connection.rollback();
                    throw e; // Immediately rethrow client validation errors
                } catch (Exception e) {
                    connection.rollback();
                    if (isBusyError(e) && attempt < maxRetries) {
                        sleepBackoff(attempt);
                        continue;
                    }
                    if (e.getCause() instanceof IllegalArgumentException) {
                        throw (IllegalArgumentException) e.getCause();
                    }
                    if (e.getCause() instanceof IllegalStateException) {
                        throw (IllegalStateException) e.getCause();
                    }
                    throw new RuntimeException("Transaction rolled back due to error: " + e.getMessage(), e);
                } finally {
                    try {
                        connection.setAutoCommit(originalAutoCommit);
                    } catch (SQLException ignored) {}
                }
            } catch (SQLException e) {
                if (isBusyError(e) && attempt < maxRetries) {
                    sleepBackoff(attempt);
                    continue;
                }
                throw new RuntimeException("Transaction boundary failure", e);
            }
        }
    }

    @Override
    public synchronized boolean isHealthy() {
        try {
            connect();
            try (Statement stmt = connection.createStatement();
                 ResultSet rs = stmt.executeQuery("SELECT 1;")) {
                return rs.next() && rs.getInt(1) == 1;
            }
        } catch (Exception e) {
            return false;
        }
    }

    @Override
    public synchronized void close() {
        if (connection != null) {
            try {
                connection.close();
            } catch (SQLException ignored) {
            }
        }
    }

    private void bindParams(PreparedStatement pstmt, Object[] params) throws SQLException {
        if (params != null) {
            for (int i = 0; i < params.length; i++) {
                pstmt.setObject(i + 1, params[i]);
            }
        }
    }

    private boolean isBusyError(Throwable t) {
        if (t == null) return false;
        String msg = t.getMessage();
        if (msg != null && (msg.contains("SQLITE_BUSY") || msg.contains("database is locked") || msg.contains("busy"))) {
            return true;
        }
        return isBusyError(t.getCause());
    }

    private void sleepBackoff(int attempt) {
        try {
            Thread.sleep(30L * attempt + (long) (Math.random() * 20));
        } catch (InterruptedException ie) {
            Thread.currentThread().interrupt();
        }
    }
}
