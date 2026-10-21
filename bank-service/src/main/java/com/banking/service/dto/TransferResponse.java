package com.banking.service.dto;

public record TransferResponse(
        String transferId,
        String sourceAccountId,
        String destAccountId,
        long amountCents,
        double amountInr,
        String status, // COMPLETED, PENDING, FAILED, COMPENSATED
        String transferType, // SAME_SHARD, CROSS_SHARD_SAGA
        String sourceShard,
        String destShard,
        String idempotencyKey,
        long timestamp
) {}
