package com.banking.service.dto;

public record AccountDto(
        String accountId,
        String customerId,
        String accountNumber,
        long balanceCents,
        double balanceInr,
        String currency,
        String status,
        String shardId
) {}
