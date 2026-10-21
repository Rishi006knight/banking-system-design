package com.banking.service.controller;

import com.banking.common.ratelimit.RateLimitConfig;
import com.banking.common.ratelimit.RateLimitResult;
import com.banking.common.ratelimit.RateLimiter;
import com.banking.service.dto.AuthRequest;
import com.banking.service.dto.AuthResponse;
import com.banking.service.dto.RegisterRequest;
import com.banking.service.service.AuthService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/auth")
public class AuthController {

    private final AuthService authService;
    private final RateLimiter rateLimiter;

    public AuthController(AuthService authService, RateLimiter rateLimiter) {
        this.authService = authService;
        this.rateLimiter = rateLimiter;
    }

    @PostMapping("/register")
    public ResponseEntity<?> register(@Valid @RequestBody RegisterRequest req, HttpServletRequest request) {
        String clientIp = getClientIp(request);
        RateLimitResult limit = rateLimiter.tryAcquire(clientIp, RateLimitConfig.strictLogin());
        if (!limit.isAllowed()) {
            return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS)
                    .header(HttpHeaders.RETRY_AFTER, String.valueOf(limit.getRetryAfterSeconds()))
                    .body(Map.of("error", "Rate limit exceeded. Too many registration attempts.", "retryAfterSeconds", limit.getRetryAfterSeconds()));
        }

        try {
            AuthResponse response = authService.register(req);
            return ResponseEntity.status(HttpStatus.CREATED).body(response);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("error", e.getMessage()));
        }
    }

    @PostMapping("/login")
    public ResponseEntity<?> login(@Valid @RequestBody AuthRequest req, HttpServletRequest request) {
        String clientKey = getClientIp(request) + ":" + req.username();
        RateLimitResult limit = rateLimiter.tryAcquire(clientKey, RateLimitConfig.strictLogin());
        if (!limit.isAllowed()) {
            return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS)
                    .header(HttpHeaders.RETRY_AFTER, String.valueOf(limit.getRetryAfterSeconds()))
                    .body(Map.of("error", "Rate limit exceeded. Too many login attempts.", "retryAfterSeconds", limit.getRetryAfterSeconds()));
        }

        try {
            AuthResponse response = authService.login(req);
            return ResponseEntity.ok(response);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("error", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(Map.of("error", e.getMessage()));
        }
    }

    @PostMapping("/logout")
    public ResponseEntity<?> logout(@RequestHeader(value = "Authorization", required = false) String authHeader) {
        if (authHeader != null && authHeader.startsWith("Bearer ")) {
            String token = authHeader.substring(7);
            authService.logout(token);
        }
        return ResponseEntity.ok(Map.of("message", "Logged out successfully"));
    }

    private String getClientIp(HttpServletRequest req) {
        String xf = req.getHeader("X-Forwarded-For");
        if (xf != null && !xf.isBlank()) {
            return xf.split(",")[0].trim();
        }
        return req.getRemoteAddr() != null ? req.getRemoteAddr() : "127.0.0.1";
    }
}
