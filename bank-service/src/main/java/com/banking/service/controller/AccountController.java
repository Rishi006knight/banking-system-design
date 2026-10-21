package com.banking.service.controller;

import com.banking.common.ratelimit.RateLimitConfig;
import com.banking.common.ratelimit.RateLimitResult;
import com.banking.common.ratelimit.RateLimiter;
import com.banking.service.dto.AccountDto;
import com.banking.service.dto.BalanceDto;
import com.banking.service.dto.TransactionDto;
import com.banking.service.service.AccountService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/accounts")
public class AccountController {

    private final AccountService accountService;
    private final RateLimiter rateLimiter;

    public AccountController(AccountService accountService, RateLimiter rateLimiter) {
        this.accountService = accountService;
        this.rateLimiter = rateLimiter;
    }

    @GetMapping("/{id}")
    public ResponseEntity<?> getAccount(@PathVariable("id") String accountId, HttpServletResponse response) {
        try {
            AccountDto dto = accountService.getAccount(accountId);
            response.setHeader("X-Shard", dto.shardId());
            return ResponseEntity.ok(dto);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", e.getMessage()));
        }
    }

    @GetMapping("/{id}/balance")
    public ResponseEntity<?> getBalance(
            @PathVariable("id") String accountId,
            HttpServletRequest request,
            HttpServletResponse response) {

        String clientKey = getClientIp(request) + ":" + accountId;
        RateLimitResult limit = rateLimiter.tryAcquire(clientKey, RateLimitConfig.lenientEnquiry());
        if (!limit.isAllowed()) {
            return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS)
                    .header(HttpHeaders.RETRY_AFTER, String.valueOf(limit.getRetryAfterSeconds()))
                    .body(Map.of("error", "Rate limit exceeded on balance enquiry", "retryAfterSeconds", limit.getRetryAfterSeconds()));
        }

        try {
            BalanceDto dto = accountService.getBalance(accountId);
            response.setHeader("X-Shard", dto.shardId());
            response.setHeader("X-Cache-Hit", String.valueOf(dto.cached()));
            return ResponseEntity.ok(dto);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", e.getMessage()));
        }
    }

    @GetMapping("/{id}/transactions")
    public ResponseEntity<?> getTransactions(
            @PathVariable("id") String accountId,
            @RequestParam(name = "page", defaultValue = "0") int page,
            @RequestParam(name = "size", defaultValue = "20") int size) {
        try {
            List<TransactionDto> list = accountService.getTransactions(accountId, page, size);
            return ResponseEntity.ok(list);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", e.getMessage()));
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
