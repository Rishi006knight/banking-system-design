package com.banking.gateway.health;

import com.banking.gateway.model.ServerNode;
import com.banking.gateway.router.GatewayHashRingRouter;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.List;

/**
 * Health check monitor that probes backend servers and automatically
 * removes dead instances from the consistent hash ring, and re-adds them upon recovery.
 */
@Component
public class ServerHealthChecker {

    private static final Logger log = LoggerFactory.getLogger(ServerHealthChecker.class);

    private final GatewayHashRingRouter router;
    private final HttpClient httpClient;
    private final List<String> configuredServerUrls;

    @Value("${gateway.health-check.timeout-millis:2000}")
    private long timeoutMillis;

    public ServerHealthChecker(
            GatewayHashRingRouter router,
            @Value("${gateway.servers:http://localhost:8081,http://localhost:8082,http://localhost:8083}") List<String> configuredServerUrls) {
        this.router = router;
        this.configuredServerUrls = configuredServerUrls;
        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(2))
                .build();
    }

    @EventListener(ApplicationReadyEvent.class)
    public void init() {
        for (String url : configuredServerUrls) {
            String serverId = extractServerId(url);
            ServerNode node = new ServerNode(serverId, url);
            router.registerServer(node);
        }
        log.info("Initialized gateway with {} backend servers.", configuredServerUrls.size());
        checkAllServers();
    }

    @Scheduled(fixedDelayString = "${gateway.health-check.interval-millis:5000}")
    public void scheduledHealthCheck() {
        checkAllServers();
    }

    public synchronized void checkAllServers() {
        for (ServerNode server : router.getAllServers()) {
            boolean isAlive = pingServer(server.getUrl());

            if (isAlive) {
                if (!server.isHealthy()) {
                    log.info("Backend server {} recovered! Re-adding to hash ring.", server);
                    router.markServerHealthy(server);
                } else {
                    server.resetFailures();
                }
            } else {
                int failures = server.recordFailure();
                if (server.isHealthy() && failures >= 2) {
                    log.warn("Backend server {} failed {} health checks. Removing from hash ring!", server, failures);
                    router.markServerDown(server);
                }
            }
        }
    }

    public boolean pingServer(String baseUrl) {
        try {
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(baseUrl + "/admin/metrics"))
                    .timeout(Duration.ofMillis(timeoutMillis))
                    .GET()
                    .build();

            HttpResponse<Void> response = httpClient.send(request, HttpResponse.BodyHandlers.discarding());
            return response.statusCode() == 200;
        } catch (Exception e) {
            return false;
        }
    }

    private String extractServerId(String url) {
        if (url.contains(":8081")) return "bank-shard-0";
        if (url.contains(":8082")) return "bank-shard-1";
        if (url.contains(":8083")) return "bank-shard-2";
        int lastColon = url.lastIndexOf(':');
        if (lastColon != -1) {
            return "node-" + url.substring(lastColon + 1).replaceAll("[^0-9]", "");
        }
        return "node-" + url.hashCode();
    }
}
