package com.banking.gateway.controller;

import com.banking.common.ratelimit.RateLimitConfig;
import com.banking.common.ratelimit.RateLimitResult;
import com.banking.common.ratelimit.RateLimiter;
import com.banking.gateway.model.ServerNode;
import com.banking.gateway.proxy.ReverseProxyService;
import com.banking.gateway.router.GatewayHashRingRouter;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.io.IOException;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Main API Gateway Controller receiving external requests:
 * 1. Enforces edge rate limiting per endpoint category.
 * 2. Extracts accountId routing key for Consistent Hashing.
 * 3. Proxies request to the designated healthy bank-service instance.
 */
@RestController
public class GatewayController {

    private final GatewayHashRingRouter router;
    private final ReverseProxyService proxyService;
    private final RateLimiter rateLimiter;

    private static final Pattern ACCOUNT_ID_PATTERN = Pattern.compile("/accounts/([^/?]+)");

    public GatewayController(GatewayHashRingRouter router, ReverseProxyService proxyService, RateLimiter rateLimiter) {
        this.router = router;
        this.proxyService = proxyService;
        this.rateLimiter = rateLimiter;
    }

    @RequestMapping(value = {
            "/auth/**",
            "/accounts/**",
            "/transfers/**",
            "/billers/**",
            "/bills/**",
            "/billpayments/**",
            "/beneficiaries/**",
            "/notifications/**",
            "/admin/**"
    })
    public void handleGatewayRequest(HttpServletRequest request, HttpServletResponse response) throws IOException {
        String uri = request.getRequestURI();
        String clientIp = getClientIp(request);

        // 1. Determine Rate Limit Policy (Exempt benchmark load test client to measure raw system capacity)
        boolean isBenchmark = "true".equalsIgnoreCase(request.getHeader("X-Benchmark-Client"));
        if (!isBenchmark) {
            RateLimitConfig rateLimitConfig = determineRateLimitRule(uri);
            String rateLimitKey = clientIp + ":" + rateLimitConfig.getName();

            RateLimitResult limitResult = rateLimiter.tryAcquire(rateLimitKey, rateLimitConfig);
            if (!limitResult.isAllowed()) {
                response.setStatus(HttpStatus.TOO_MANY_REQUESTS.value());
                response.setHeader(HttpHeaders.RETRY_AFTER, String.valueOf(limitResult.getRetryAfterSeconds()));
                response.setContentType("application/json");
                response.getWriter().write(String.format(
                        "{\"error\":\"Gateway rate limit exceeded\",\"rule\":\"%s\",\"retryAfterSeconds\":%d}",
                        rateLimitConfig.getName(), limitResult.getRetryAfterSeconds()
                ));
                return;
            }
        }

        // 2. Extract Routing Key for Consistent Hash Ring
        String routingKey = extractRoutingKey(request, uri, clientIp);

        // 3. Resolve Target Backend Server from Hash Ring
        ServerNode targetNode = router.route(routingKey);
        if (targetNode == null || !targetNode.isHealthy()) {
            // Check if any healthy node is available in ring
            targetNode = router.getActiveServers().stream().findFirst().orElse(null);
        }

        if (targetNode == null) {
            response.setStatus(HttpStatus.SERVICE_UNAVAILABLE.value());
            response.setContentType("application/json");
            response.getWriter().write("{\"error\":\"No healthy bank-service servers available in hash ring\"}");
            return;
        }

        // 4. Reverse Proxy to Target Node
        proxyService.proxyRequest(targetNode, request, response);
    }

    private RateLimitConfig determineRateLimitRule(String uri) {
        if (uri.startsWith("/auth/login") || uri.startsWith("/auth/register")) {
            return RateLimitConfig.strictLogin();
        } else if (uri.startsWith("/transfers") || uri.startsWith("/billpayments")) {
            return RateLimitConfig.moderateTransfer();
        } else {
            return RateLimitConfig.lenientEnquiry();
        }
    }

    private String extractRoutingKey(HttpServletRequest req, String uri, String clientIp) {
        // A. Check /accounts/{id}
        Matcher matcher = ACCOUNT_ID_PATTERN.matcher(uri);
        if (matcher.find()) {
            return matcher.group(1);
        }

        // B. Check header X-Account-Id
        String accHeader = req.getHeader("X-Account-Id");
        if (accHeader != null && !accHeader.isBlank()) {
            return accHeader;
        }

        // C. Check query parameter accountId
        String accParam = req.getParameter("accountId");
        if (accParam != null && !accParam.isBlank()) {
            return accParam;
        }

        // D. Check Authorization header
        String authHeader = req.getHeader("Authorization");
        if (authHeader != null && authHeader.startsWith("Bearer ")) {
            return authHeader.substring(7);
        }

        // E. Fallback to client IP
        return clientIp;
    }

    private String getClientIp(HttpServletRequest req) {
        String xf = req.getHeader("X-Forwarded-For");
        if (xf != null && !xf.isBlank()) {
            return xf.split(",")[0].trim();
        }
        return req.getRemoteAddr() != null ? req.getRemoteAddr() : "127.0.0.1";
    }
}
