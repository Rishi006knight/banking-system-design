package com.banking.service.dto;

public record BillDto(
        String billId,
        String customerId,
        String billerCode,
        String billerName,
        long amountCents,
        double amountInr,
        String status,
        Long paidAt
) {}
