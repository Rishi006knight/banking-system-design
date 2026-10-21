package com.banking.service.dto;

import jakarta.validation.constraints.NotBlank;

public record BillPaymentRequest(
        @NotBlank(message = "Account ID is required") String accountId,
        @NotBlank(message = "Bill ID is required") String billId
) {}
