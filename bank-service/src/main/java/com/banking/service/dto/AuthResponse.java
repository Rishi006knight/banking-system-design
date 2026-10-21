package com.banking.service.dto;

public record AuthResponse(
        String token,
        String customerId,
        String username,
        String fullName,
        String primaryAccountId,
        long expiresInSeconds
) {}
