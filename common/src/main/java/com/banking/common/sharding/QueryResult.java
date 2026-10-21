package com.banking.common.sharding;

import java.util.*;

/**
 * Result of a SQL execution on a ShardConnection.
 */
public class QueryResult {

    private final List<String> columns;
    private final List<Map<String, Object>> rows;
    private final int affectedRowCount;

    public QueryResult(List<String> columns, List<Map<String, Object>> rows, int affectedRowCount) {
        this.columns = (columns != null) ? Collections.unmodifiableList(new ArrayList<>(columns)) : Collections.emptyList();
        this.rows = (rows != null) ? Collections.unmodifiableList(new ArrayList<>(rows)) : Collections.emptyList();
        this.affectedRowCount = affectedRowCount;
    }

    public static QueryResult empty(int affectedRowCount) {
        return new QueryResult(Collections.emptyList(), Collections.emptyList(), affectedRowCount);
    }

    public List<String> getColumns() {
        return columns;
    }

    public List<Map<String, Object>> getRows() {
        return rows;
    }

    public int getAffectedRowCount() {
        return affectedRowCount;
    }

    public boolean isEmpty() {
        return rows.isEmpty();
    }

    public int size() {
        return rows.size();
    }

    public Map<String, Object> firstRow() {
        return rows.isEmpty() ? null : rows.get(0);
    }
}
