package com.banking.service.dto;

public record BalanceDto(
        String accountId,
        long balanceCents,
        double balanceInr,
        String currency,
        boolean cached,
        String shardId
) {}
