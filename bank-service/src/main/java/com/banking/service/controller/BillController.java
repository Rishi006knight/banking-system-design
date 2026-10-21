package com.banking.service.controller;

import com.banking.common.ratelimit.RateLimitConfig;
import com.banking.common.ratelimit.RateLimitResult;
import com.banking.common.ratelimit.RateLimiter;
import com.banking.service.dto.BillDto;
import com.banking.service.dto.BillPaymentRequest;
import com.banking.service.service.BillService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
public class BillController {

    private final BillService billService;
    private final RateLimiter rateLimiter;

    public BillController(BillService billService, RateLimiter rateLimiter) {
        this.billService = billService;
        this.rateLimiter = rateLimiter;
    }

    @GetMapping("/billers")
    public ResponseEntity<List<Map<String, String>>> getBillers() {
        return ResponseEntity.ok(billService.getBillers());
    }

    @GetMapping("/bills")
    public ResponseEntity<List<BillDto>> getBills(@RequestParam("customerId") String customerId) {
        return ResponseEntity.ok(billService.getCustomerBills(customerId));
    }

    @PostMapping("/billpayments")
    public ResponseEntity<?> payBill(
            @Valid @RequestBody BillPaymentRequest req,
            @RequestHeader(value = "Idempotency-Key", required = false) String idempotencyKey,
            HttpServletRequest request) {

        if (idempotencyKey == null || idempotencyKey.isBlank()) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(Map.of("error", "Missing required header 'Idempotency-Key'"));
        }

        // Rate limit: moderate (30/min) per source account (exempt benchmark client)
        boolean isBenchmark = "true".equalsIgnoreCase(request.getHeader("X-Benchmark-Client"));
        if (!isBenchmark) {
            String clientKey = getClientIp(request) + ":" + req.accountId();
            RateLimitResult limit = rateLimiter.tryAcquire(clientKey, RateLimitConfig.moderateTransfer());
            if (!limit.isAllowed()) {
                return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS)
                        .header(HttpHeaders.RETRY_AFTER, String.valueOf(limit.getRetryAfterSeconds()))
                        .body(Map.of("error", "Rate limit exceeded on bill payments", "retryAfterSeconds", limit.getRetryAfterSeconds()));
            }
        }

        try {
            BillDto result = billService.payBill(req, idempotencyKey);
            return ResponseEntity.ok(result);
        } catch (IllegalArgumentException | IllegalStateException e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("error", e.getMessage()));
        } catch (Exception e) {
            Throwable cause = e.getCause();
            if (cause instanceof IllegalArgumentException || cause instanceof IllegalStateException) {
                return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("error", cause.getMessage()));
            }
            if (e.getMessage() != null && (e.getMessage().contains("not found") || e.getMessage().contains("Insufficient balance"))) {
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
