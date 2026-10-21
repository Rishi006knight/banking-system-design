package com.banking.service.controller;

import com.banking.common.kvstore.KeyValueStore;
import com.banking.common.ratelimit.RateLimiter;
import com.banking.common.sharding.QueryResult;
import com.banking.common.sharding.Shard;
import com.banking.common.sharding.ShardRouter;
import com.banking.common.snowflake.IdGenerator;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.LinkedHashMap;
import java.util.Map;

@RestController
@RequestMapping("/admin")
public class AdminController {

    private final RateLimiter rateLimiter;
    private final ShardRouter shardRouter;
    private final KeyValueStore<String> keyValueStore;
    private final IdGenerator idGenerator;

    public AdminController(RateLimiter rateLimiter, ShardRouter shardRouter,
                           KeyValueStore<String> keyValueStore, IdGenerator idGenerator) {
        this.rateLimiter = rateLimiter;
        this.shardRouter = shardRouter;
        this.keyValueStore = keyValueStore;
        this.idGenerator = idGenerator;
    }

    @GetMapping("/metrics")
    public ResponseEntity<Map<String, Object>> getMetrics() {
        Map<String, Object> metrics = new LinkedHashMap<>();

        // 1. Rate Limiter Metrics
        metrics.put("rateLimiter", Map.of(
                "totalRequests", rateLimiter.getGlobalMetrics().getTotalRequests(),
                "allowedRequests", rateLimiter.getGlobalMetrics().getAllowedRequests(),
                "rejectedRequests", rateLimiter.getGlobalMetrics().getRejectedRequests(),
                "rejectionRatePercent", rateLimiter.getGlobalMetrics().getRejectionRate(),
                "activeBuckets", rateLimiter.getActiveBucketCount()
        ));

        // 2. Key-Value Store Metrics
        metrics.put("keyValueStore", Map.of(
                "totalGets", keyValueStore.getMetrics().getTotalGets(),
                "hits", keyValueStore.getMetrics().getHits(),
                "misses", keyValueStore.getMetrics().getMisses(),
                "hitRatioPercent", keyValueStore.getMetrics().getHitRatio(),
                "totalPuts", keyValueStore.getMetrics().getTotalPuts(),
                "totalEvictions", keyValueStore.getMetrics().getTotalEvictions(),
                "avgGetLatencyNanos", keyValueStore.getMetrics().getAverageGetLatencyNanos(),
                "activeKeys", keyValueStore.size()
        ));

        // 3. Unique ID Generator Metrics
        metrics.put("uniqueIdGenerator", Map.of(
                "totalGenerated", idGenerator.getMetrics().getGeneratedCount(),
                "generationRatePerSecond", idGenerator.getMetrics().getGenerationRatePerSecond()
        ));

        // 4. Consistent Hash Ring Topology
        metrics.put("consistentHashRing", Map.of(
                "physicalNodes", shardRouter.getRing().getPhysicalNodes().stream().map(Shard::getShardId).toList(),
                "nodeCount", shardRouter.getRing().getNodeCount(),
                "virtualNodesPerNode", shardRouter.getRing().getVirtualNodesPerNode(),
                "totalVirtualNodes", shardRouter.getRing().getVirtualNodeCount()
        ));

        return ResponseEntity.ok(metrics);
    }

    @GetMapping("/shards")
    public ResponseEntity<Map<String, Object>> getShards() {
        Map<String, Object> shardsInfo = new LinkedHashMap<>();

        for (Shard shard : shardRouter.getAllShards()) {
            Map<String, Object> info = new LinkedHashMap<>();
            info.put("healthy", shard.getConnection().isHealthy());

            QueryResult qr = shard.getConnection().executeQuery(
                    "SELECT " +
                            "(SELECT COUNT(*) FROM customers) as customers, " +
                            "(SELECT COUNT(*) FROM accounts) as accounts, " +
                            "(SELECT COUNT(*) FROM transactions) as transactions, " +
                            "(SELECT COUNT(*) FROM transfers) as transfers, " +
                            "(SELECT COUNT(*) FROM beneficiaries) as beneficiaries, " +
                            "(SELECT COUNT(*) FROM bills) as bills, " +
                            "(SELECT COALESCE(SUM(balance_cents), 0) FROM accounts) as total_balance_cents"
            );

            if (!qr.isEmpty()) {
                info.put("counts", qr.firstRow());
            }
            shardsInfo.put(shard.getShardId(), info);
        }

        return ResponseEntity.ok(shardsInfo);
    }

    @GetMapping("/ring")
    public ResponseEntity<Map<String, Object>> getRing() {
        return ResponseEntity.ok(Map.of(
                "nodes", shardRouter.getRing().getPhysicalNodes().stream().map(Shard::getShardId).toList(),
                "virtualNodesPerNode", shardRouter.getRing().getVirtualNodesPerNode(),
                "totalVirtualNodes", shardRouter.getRing().getVirtualNodeCount()
        ));
    }
}
