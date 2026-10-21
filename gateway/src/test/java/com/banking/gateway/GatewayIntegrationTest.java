package com.banking.gateway;

import com.banking.gateway.model.ServerNode;
import com.banking.gateway.router.GatewayHashRingRouter;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(classes = GatewayApplication.class)
@AutoConfigureMockMvc
class GatewayIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private GatewayHashRingRouter router;

    @Test
    @DisplayName("Test Gateway Hash Ring Server Registration and Routing")
    void testGatewayRouterWithServers() {
        ServerNode s1 = new ServerNode("node-8081", "http://localhost:8081");
        ServerNode s2 = new ServerNode("node-8082", "http://localhost:8082");
        ServerNode s3 = new ServerNode("node-8083", "http://localhost:8083");

        router.registerServer(s1);
        router.registerServer(s2);
        router.registerServer(s3);

        assertEquals(3, router.getActiveServers().size());

        // Verify deterministic routing
        ServerNode routed1 = router.route("ACC-0000001");
        ServerNode routed2 = router.route("ACC-0000002");
        assertNotNull(routed1);
        assertNotNull(routed2);
        assertEquals(routed1, router.route("ACC-0000001"));
    }

    @Test
    @DisplayName("Test Server Failure (Dead Server Removal) and Recovery (Re-Add to Ring)")
    void testServerFailoverAndReAdd() {
        ServerNode s1 = new ServerNode("test-8081", "http://localhost:8081");
        ServerNode s2 = new ServerNode("test-8082", "http://localhost:8082");

        router.registerServer(s1);
        router.registerServer(s2);
        assertTrue(router.getActiveServers().contains(s1));

        // Simulate server s1 failure -> automatically removed from hash ring
        router.markServerDown(s1);
        assertFalse(s1.isHealthy());
        assertFalse(router.getActiveServers().contains(s1));

        // Requests that mapped to s1 must now map to remaining healthy server s2
        ServerNode fallback = router.route("key-that-mapped-to-s1");
        assertNotNull(fallback);
        assertNotEquals(s1, fallback);

        // Simulate server s1 recovery -> automatically re-added to hash ring
        router.markServerHealthy(s1);
        assertTrue(s1.isHealthy());
        assertTrue(router.getActiveServers().contains(s1));
    }

    @Test
    @DisplayName("Test Edge Rate Limiter on /auth/login (Strict 5/min -> HTTP 429)")
    void testEdgeRateLimiting() throws Exception {
        // Send 5 rapid requests (allowed)
        for (int i = 0; i < 5; i++) {
            mockMvc.perform(post("/auth/login")
                    .header("X-Forwarded-For", "10.0.0.99")
                    .contentType("application/json")
                    .content("{\"username\":\"test\",\"password\":\"pass\"}"));
        }

        // 6th request must trigger HTTP 429 Too Many Requests with Retry-After header
        mockMvc.perform(post("/auth/login")
                        .header("X-Forwarded-For", "10.0.0.99")
                        .contentType("application/json")
                        .content("{\"username\":\"test\",\"password\":\"pass\"}"))
                .andExpect(status().isTooManyRequests())
                .andExpect(header().exists("Retry-After"));
    }

    @Test
    @DisplayName("Test Gateway Admin Endpoints (/gateway/routes & /gateway/metrics)")
    void testGatewayAdminEndpoints() throws Exception {
        mockMvc.perform(get("/gateway/routes"))
                .andExpect(status().isOk());

        mockMvc.perform(get("/gateway/metrics"))
                .andExpect(status().isOk());
    }
}
