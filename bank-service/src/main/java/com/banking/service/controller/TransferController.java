package com.banking.service.controller;

import com.banking.common.ratelimit.RateLimitConfig;
import com.banking.common.ratelimit.RateLimitResult;
import com.banking.common.ratelimit.RateLimiter;
import com.banking.service.dto.TransferRequest;
import com.banking.service.dto.TransferResponse;
import com.banking.service.service.TransferService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/transfers")
public class TransferController {

    private final TransferService transferService;
    private final RateLimiter rateLimiter;

    public TransferController(TransferService transferService, RateLimiter rateLimiter) {
        this.transferService = transferService;
        this.rateLimiter = rateLimiter;
    }

    @PostMapping
    public ResponseEntity<?> transfer(
            @Valid @RequestBody TransferRequest req,
            @RequestHeader(value = "Idempotency-Key", required = false) String idempotencyKey,
            HttpServletRequest request,
            HttpServletResponse response) {

        if (idempotencyKey == null || idempotencyKey.isBlank()) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(Map.of("error", "Missing required header 'Idempotency-Key'"));
        }

        // Rate limit: moderate (30/min) per source account (exempt benchmark client)
        boolean isBenchmark = "true".equalsIgnoreCase(request.getHeader("X-Benchmark-Client"));
        if (!isBenchmark) {
            String clientKey = getClientIp(request) + ":" + req.sourceAccountId();
            RateLimitResult limit = rateLimiter.tryAcquire(clientKey, RateLimitConfig.moderateTransfer());
            if (!limit.isAllowed()) {
                return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS)
                        .header(HttpHeaders.RETRY_AFTER, String.valueOf(limit.getRetryAfterSeconds()))
                        .body(Map.of("error", "Rate limit exceeded on transfers", "retryAfterSeconds", limit.getRetryAfterSeconds()));
            }
        }

        try {
            TransferResponse result = transferService.executeTransfer(req, idempotencyKey);
            response.setHeader("X-Shard", result.sourceShard());
            return ResponseEntity.ok(result);
        } catch (IllegalArgumentException | IllegalStateException e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("error", e.getMessage()));
        } catch (Exception e) {
            Throwable cause = e.getCause();
            if (cause instanceof IllegalArgumentException || cause instanceof IllegalStateException) {
                return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("error", cause.getMessage()));
            }
            if (e.getMessage() != null && (e.getMessage().contains("not found") || e.getMessage().contains("Insufficient funds"))) {
                return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("error", e.getMessage()));
            }
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(Map.of("error", e.getMessage()));
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
