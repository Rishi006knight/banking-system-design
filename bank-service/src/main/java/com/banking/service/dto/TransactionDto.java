package com.banking.service.dto;

public record TransactionDto(
        String transactionId,
        String accountId,
        String type,
        long amountCents,
        double amountInr,
        long balanceAfterCents,
        double balanceAfterInr,
        String description,
        String idempotencyKey,
        long createdAt
) {}
