package com.banking.gateway.proxy;

import com.banking.gateway.model.ServerNode;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.io.InputStream;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.Enumeration;
import java.util.Set;

/**
 * High-throughput reverse proxy forwarding requests to the selected backend node
 * using Java 17 HttpClient with zero Spring Cloud Gateway dependency.
 */
@Service
public class ReverseProxyService {

    private final HttpClient httpClient;

    private static final Set<String> HOP_BY_HOP_HEADERS = Set.of(
            "connection", "keep-alive", "proxy-authenticate", "proxy-authorization",
            "te", "trailer", "transfer-encoding", "upgrade", "host",
            "content-length", "expect", "date"
    );

    public ReverseProxyService() {
        this.httpClient = HttpClient.newBuilder()
                .version(HttpClient.Version.HTTP_1_1)
                .connectTimeout(Duration.ofSeconds(10))
                .followRedirects(HttpClient.Redirect.NORMAL)
                .executor(java.util.concurrent.Executors.newFixedThreadPool(600))
                .build();
    }

    public void proxyRequest(ServerNode targetServer, HttpServletRequest req, HttpServletResponse resp) throws IOException {
        String query = req.getQueryString();
        String targetUri = targetServer.getUrl() + req.getRequestURI() + (query != null ? "?" + query : "");

        HttpRequest.Builder reqBuilder = HttpRequest.newBuilder()
                .uri(URI.create(targetUri))
                .timeout(Duration.ofSeconds(15));

        // Copy incoming headers
        Enumeration<String> headerNames = req.getHeaderNames();
        while (headerNames != null && headerNames.hasMoreElements()) {
            String name = headerNames.nextElement();
            if (!HOP_BY_HOP_HEADERS.contains(name.toLowerCase())) {
                Enumeration<String> values = req.getHeaders(name);
                while (values.hasMoreElements()) {
                    reqBuilder.header(name, values.nextElement());
                }
            }
        }

        // Add proxy trace headers
        reqBuilder.header("X-Forwarded-For", getClientIp(req));
        reqBuilder.header("X-Forwarded-Host", req.getHeader("Host") != null ? req.getHeader("Host") : "localhost:8080");

        // Forward method and body
        String method = req.getMethod();
        byte[] bodyBytes = req.getInputStream().readAllBytes();
        if ("POST".equalsIgnoreCase(method) || "PUT".equalsIgnoreCase(method) || "PATCH".equalsIgnoreCase(method)) {
            reqBuilder.method(method, HttpRequest.BodyPublishers.ofByteArray(bodyBytes));
        } else {
            reqBuilder.method(method, HttpRequest.BodyPublishers.noBody());
        }

        try {
            HttpResponse<InputStream> backendResp = httpClient.send(reqBuilder.build(), HttpResponse.BodyHandlers.ofInputStream());

            // Set response status
            resp.setStatus(backendResp.statusCode());

            // Copy backend response headers
            backendResp.headers().map().forEach((headerName, headerValues) -> {
                if (!HOP_BY_HOP_HEADERS.contains(headerName.toLowerCase())) {
                    for (String val : headerValues) {
                        resp.addHeader(headerName, val);
                    }
                }
            });

            // Annotate with Gateway routing metadata
            resp.setHeader("X-Gateway-Route", targetServer.getServerId());

            // Stream body to client
            try (InputStream in = backendResp.body()) {
                in.transferTo(resp.getOutputStream());
            }
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            resp.sendError(HttpServletResponse.SC_GATEWAY_TIMEOUT, "Gateway timed out contacting backend " + targetServer);
        } catch (Exception e) {
            resp.sendError(HttpServletResponse.SC_BAD_GATEWAY, "Backend communication failure: " + e.getMessage());
        }
    }

    private String getClientIp(HttpServletRequest req) {
        String xf = req.getHeader("X-Forwarded-For");
        if (xf != null && !xf.isBlank()) {
            return xf.split(",")[0].trim();
        }
        return req.getRemoteAddr() != null ? req.getRemoteAddr() : "127.0.0.1";
    }
}
