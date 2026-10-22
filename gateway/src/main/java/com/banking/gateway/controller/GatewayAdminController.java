package com.banking.gateway.controller;

import com.banking.common.ratelimit.RateLimiter;
import com.banking.gateway.model.ServerNode;
import com.banking.gateway.router.GatewayHashRingRouter;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.*;

@RestController
@RequestMapping("/gateway")
public class GatewayAdminController {

    private final GatewayHashRingRouter router;
    private final RateLimiter rateLimiter;

    public GatewayAdminController(GatewayHashRingRouter router, RateLimiter rateLimiter) {
        this.router = router;
        this.rateLimiter = rateLimiter;
    }

    @GetMapping("/routes")
    public ResponseEntity<Map<String, Object>> getRoutes() {
        Map<String, Object> resp = new LinkedHashMap<>();
        resp.put("activeServers", router.getActiveServers().stream().map(ServerNode::getUrl).toList());
        resp.put("allConfiguredServers", router.getAllServers().stream().map(s -> Map.of(
                "serverId", s.getServerId(),
                "url", s.getUrl(),
                "healthy", s.isHealthy()
        )).toList());
        resp.put("virtualNodesPerNode", router.getRing().getVirtualNodesPerNode());
        resp.put("totalVirtualNodesOnRing", router.getRing().getVirtualNodeCount());
        return ResponseEntity.ok(resp);
    }

    @GetMapping("/metrics")
    public ResponseEntity<Map<String, Object>> getMetrics() {
        Map<String, Object> resp = new LinkedHashMap<>();
        resp.put("rateLimiter", Map.of(
                "totalRequests", rateLimiter.getGlobalMetrics().getTotalRequests(),
                "allowedRequests", rateLimiter.getGlobalMetrics().getAllowedRequests(),
                "rejectedRequests", rateLimiter.getGlobalMetrics().getRejectedRequests(),
                "rejectionRatePercent", rateLimiter.getGlobalMetrics().getRejectionRate(),
                "activeBuckets", rateLimiter.getActiveBucketCount()
        ));
        resp.put("activeServerCount", router.getActiveServers().size());
        resp.put("totalServerCount", router.getAllServers().size());
        return ResponseEntity.ok(resp);
    }

    @GetMapping("/distribution")
    public ResponseEntity<Map<String, Integer>> getDistribution() {
        List<String> sampleKeys = new ArrayList<>(1000);
        for (int i = 0; i < 1000; i++) {
            sampleKeys.add("ACC-" + String.format("%07d", i));
        }

        Map<ServerNode, Integer> load = router.getRing().getNodeLoad(sampleKeys);
        Map<String, Integer> result = new LinkedHashMap<>();
        load.forEach((node, count) -> result.put(node.getServerId(), count));
        return ResponseEntity.ok(result);
    }

    @org.springframework.web.bind.annotation.PostMapping({"/simulate/fail", "/admin/nodes/{id}/kill"})
    public ResponseEntity<Map<String, Object>> simulateFail(
            @org.springframework.web.bind.annotation.RequestParam(value = "serverId", required = false) String serverId,
            @org.springframework.web.bind.annotation.PathVariable(value = "id", required = false) String id) {
        String targetId = id != null ? id : serverId;
        if (targetId == null) return ResponseEntity.badRequest().build();
        String cleanId = targetId.replace("node-", "").replace("server-", "");
        Optional<ServerNode> found = router.getAllServers().stream()
                .filter(s -> s.getServerId().equalsIgnoreCase(targetId)
                        || s.getServerId().equalsIgnoreCase(cleanId)
                        || s.getUrl().contains(targetId)
                        || s.getUrl().contains(cleanId))
                .findFirst();
        if (found.isPresent()) {
            router.markServerDown(found.get());
            long now = System.currentTimeMillis();
            return ResponseEntity.ok(Map.of(
                    "ok", true,
                    "status", "OFFLINE",
                    "serverId", found.get().getServerId(),
                    "evictedAt", now,
                    "message", "Simulated failure: server removed from hash ring.",
                    "activeServerCount", router.getActiveServers().size()
            ));
        }
        return ResponseEntity.notFound().build();
    }

    @org.springframework.web.bind.annotation.PostMapping({"/simulate/recover", "/admin/nodes/{id}/revive"})
    public ResponseEntity<Map<String, Object>> simulateRecover(
            @org.springframework.web.bind.annotation.RequestParam(value = "serverId", required = false) String serverId,
            @org.springframework.web.bind.annotation.PathVariable(value = "id", required = false) String id) {
        String targetId = id != null ? id : serverId;
        if (targetId == null) return ResponseEntity.badRequest().build();
        String cleanId = targetId.replace("node-", "").replace("server-", "");
        Optional<ServerNode> found = router.getAllServers().stream()
                .filter(s -> s.getServerId().equalsIgnoreCase(targetId)
                        || s.getServerId().equalsIgnoreCase(cleanId)
                        || s.getUrl().contains(targetId)
                        || s.getUrl().contains(cleanId))
                .findFirst();
        if (found.isPresent()) {
            router.markServerHealthy(found.get());
            long now = System.currentTimeMillis();
            return ResponseEntity.ok(Map.of(
                    "ok", true,
                    "status", "ONLINE",
                    "serverId", found.get().getServerId(),
                    "rejoinedAt", now,
                    "message", "Simulated recovery: server re-added to hash ring with 150 vnodes.",
                    "activeServerCount", router.getActiveServers().size()
            ));
        }
        return ResponseEntity.notFound().build();
    }

    @org.springframework.web.bind.annotation.PostMapping({"/servers/add", "/admin/shards"})
    public ResponseEntity<Map<String, Object>> addServer(
            @org.springframework.web.bind.annotation.RequestParam(value = "serverId", required = false) String serverId,
            @org.springframework.web.bind.annotation.RequestParam(value = "url", required = false) String url) {
        String finalServerId = serverId != null ? serverId : "bank-shard-3";
        String finalUrl = url != null ? url : "http://localhost:8084";
        ServerNode node = new ServerNode(finalServerId, finalUrl);
        router.registerServer(node);
        return ResponseEntity.ok(Map.of(
                "ok", true,
                "status", "REGISTERED",
                "serverId", finalServerId,
                "url", finalUrl,
                "activeServerCount", router.getActiveServers().size(),
                "totalVirtualNodes", router.getRing().getVirtualNodeCount()
        ));
    }
}
