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

    @org.springframework.web.bind.annotation.PostMapping("/simulate/fail")
    public ResponseEntity<Map<String, Object>> simulateFail(@org.springframework.web.bind.annotation.RequestParam String serverId) {
        Optional<ServerNode> found = router.getAllServers().stream()
                .filter(s -> s.getServerId().equalsIgnoreCase(serverId) || s.getUrl().contains(serverId))
                .findFirst();
        if (found.isPresent()) {
            router.markServerDown(found.get());
            return ResponseEntity.ok(Map.of(
                    "status", "OFFLINE",
                    "serverId", found.get().getServerId(),
                    "message", "Simulated failure: server removed from hash ring.",
                    "activeServerCount", router.getActiveServers().size()
            ));
        }
        return ResponseEntity.notFound().build();
    }

    @org.springframework.web.bind.annotation.PostMapping("/simulate/recover")
    public ResponseEntity<Map<String, Object>> simulateRecover(@org.springframework.web.bind.annotation.RequestParam String serverId) {
        Optional<ServerNode> found = router.getAllServers().stream()
                .filter(s -> s.getServerId().equalsIgnoreCase(serverId) || s.getUrl().contains(serverId))
                .findFirst();
        if (found.isPresent()) {
            router.markServerHealthy(found.get());
            return ResponseEntity.ok(Map.of(
                    "status", "ONLINE",
                    "serverId", found.get().getServerId(),
                    "message", "Simulated recovery: server re-added to hash ring with 150 vnodes.",
                    "activeServerCount", router.getActiveServers().size()
            ));
        }
        return ResponseEntity.notFound().build();
    }
}
