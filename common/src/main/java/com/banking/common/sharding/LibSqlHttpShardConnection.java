package com.banking.common.sharding;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.*;

/**
 * ShardConnection implementation for Turso and libSQL via HTTP /v2/pipeline.
 * Uses java.net.http.HttpClient and standard Hrana v2 JSON protocol.
 */
public class LibSqlHttpShardConnection implements ShardConnection {

    private final String pipelineUrl;
    private final String authToken;
    private final HttpClient httpClient;
    private final ObjectMapper mapper;

    public LibSqlHttpShardConnection(String baseUrl, String authToken) {
        String cleanUrl = baseUrl.trim();
        if (cleanUrl.startsWith("libsql://")) {
            cleanUrl = "https://" + cleanUrl.substring("libsql://".length());
        }
        if (!cleanUrl.endsWith("/v2/pipeline")) {
            if (cleanUrl.endsWith("/")) {
                cleanUrl = cleanUrl + "v2/pipeline";
            } else {
                cleanUrl = cleanUrl + "/v2/pipeline";
            }
        }
        this.pipelineUrl = cleanUrl;
        this.authToken = (authToken != null && !authToken.isBlank()) ? authToken : null;
        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(5))
                .build();
        this.mapper = new ObjectMapper();
    }

    @Override
    public QueryResult executeQuery(String sql, Object... params) {
        ObjectNode root = mapper.createObjectNode();
        ArrayNode requests = root.putArray("requests");

        ObjectNode execReq = requests.addObject();
        execReq.put("type", "execute");
        ObjectNode stmt = execReq.putObject("stmt");
        stmt.put("sql", sql);
        stmt.put("want_ret", true);
        appendArgs(stmt, params);

        ObjectNode closeReq = requests.addObject();
        closeReq.put("type", "close");

        JsonNode responseNode = sendPipelineRequest(root);
        return parseQueryResult(responseNode);
    }

    @Override
    public int executeUpdate(String sql, Object... params) {
        ObjectNode root = mapper.createObjectNode();
        ArrayNode requests = root.putArray("requests");

        ObjectNode execReq = requests.addObject();
        execReq.put("type", "execute");
        ObjectNode stmt = execReq.putObject("stmt");
        stmt.put("sql", sql);
        stmt.put("want_ret", false);
        appendArgs(stmt, params);

        ObjectNode closeReq = requests.addObject();
        closeReq.put("type", "close");

        JsonNode responseNode = sendPipelineRequest(root);
        return parseAffectedRows(responseNode);
    }

    @Override
    public void executeBatch(List<String> sqlStatements) {
        if (sqlStatements == null || sqlStatements.isEmpty()) return;

        ObjectNode root = mapper.createObjectNode();
        ArrayNode requests = root.putArray("requests");

        for (String sql : sqlStatements) {
            if (!sql.isBlank()) {
                ObjectNode execReq = requests.addObject();
                execReq.put("type", "execute");
                ObjectNode stmt = execReq.putObject("stmt");
                stmt.put("sql", sql);
                stmt.put("want_ret", false);
            }
        }

        ObjectNode closeReq = requests.addObject();
        closeReq.put("type", "close");

        sendPipelineRequest(root);
    }

    @Override
    public void executeInTransaction(TransactionCallback callback) {
        // Multi-statement atomic transaction batch via BEGIN / COMMIT
        executeUpdate("BEGIN TRANSACTION;");
        try {
            callback.execute(this);
            executeUpdate("COMMIT;");
        } catch (Exception e) {
            try {
                executeUpdate("ROLLBACK;");
            } catch (Exception ignored) {
            }
            throw new RuntimeException("Transaction rolled back: " + e.getMessage(), e);
        }
    }

    @Override
    public boolean isHealthy() {
        try {
            QueryResult qr = executeQuery("SELECT 1;");
            return !qr.isEmpty();
        } catch (Exception e) {
            return false;
        }
    }

    @Override
    public void close() {
        // HttpClient handles connection pooling automatically
    }

    private void appendArgs(ObjectNode stmt, Object[] params) {
        if (params == null || params.length == 0) return;
        ArrayNode args = stmt.putArray("args");
        for (Object p : params) {
            ObjectNode argNode = args.addObject();
            if (p == null) {
                argNode.put("type", "null");
            } else if (p instanceof Integer || p instanceof Long || p instanceof Short || p instanceof Byte) {
                argNode.put("type", "integer");
                argNode.put("value", String.valueOf(p));
            } else if (p instanceof Float || p instanceof Double) {
                argNode.put("type", "float");
                argNode.put("value", ((Number) p).doubleValue());
            } else {
                argNode.put("type", "text");
                argNode.put("value", p.toString());
            }
        }
    }

    private JsonNode sendPipelineRequest(ObjectNode body) {
        try {
            String jsonPayload = mapper.writeValueAsString(body);
            HttpRequest.Builder reqBuilder = HttpRequest.newBuilder()
                    .uri(URI.create(pipelineUrl))
                    .header("Content-Type", "application/json")
                    .timeout(Duration.ofSeconds(10))
                    .POST(HttpRequest.BodyPublishers.ofString(jsonPayload));

            if (authToken != null) {
                reqBuilder.header("Authorization", "Bearer " + authToken);
            }

            HttpResponse<String> response = httpClient.send(reqBuilder.build(), HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() != 200) {
                throw new RuntimeException("Turso HTTP error (" + response.statusCode() + "): " + response.body());
            }
            return mapper.readTree(response.body());
        } catch (IOException | InterruptedException e) {
            throw new RuntimeException("Failed to call Turso HTTP endpoint: " + pipelineUrl, e);
        }
    }

    private QueryResult parseQueryResult(JsonNode root) {
        JsonNode results = root.path("results");
        if (results.isArray() && results.size() > 0) {
            JsonNode first = results.get(0);
            if (first.path("type").asText("").equals("error")) {
                throw new RuntimeException("libSQL execution error: " + first.path("error").path("message").asText());
            }
            JsonNode result = first.path("response").path("result");
            List<String> cols = new ArrayList<>();
            JsonNode colsNode = result.path("cols");
            if (colsNode.isArray()) {
                for (JsonNode col : colsNode) {
                    cols.add(col.path("name").asText());
                }
            }

            List<Map<String, Object>> rows = new ArrayList<>();
            JsonNode rowsNode = result.path("rows");
            if (rowsNode.isArray()) {
                for (JsonNode rowNode : rowsNode) {
                    Map<String, Object> row = new LinkedHashMap<>();
                    for (int i = 0; i < cols.size() && i < rowNode.size(); i++) {
                        JsonNode cell = rowNode.get(i);
                        row.put(cols.get(i), parseCellValue(cell));
                    }
                    rows.add(row);
                }
            }
            int affected = result.path("affected_row_count").asInt(0);
            return new QueryResult(cols, rows, affected);
        }
        return QueryResult.empty(0);
    }

    private int parseAffectedRows(JsonNode root) {
        JsonNode results = root.path("results");
        if (results.isArray() && results.size() > 0) {
            JsonNode first = results.get(0);
            if (first.path("type").asText("").equals("error")) {
                throw new RuntimeException("libSQL execution error: " + first.path("error").path("message").asText());
            }
            return first.path("response").path("result").path("affected_row_count").asInt(0);
        }
        return 0;
    }

    private Object parseCellValue(JsonNode cell) {
        String type = cell.path("type").asText("null");
        if ("null".equals(type)) return null;
        if ("integer".equals(type)) return cell.path("value").asLong();
        if ("float".equals(type)) return cell.path("value").asDouble();
        return cell.path("value").asText();
    }
}
