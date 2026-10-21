package com.banking.service.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record TransferRequest(
        @NotBlank(message = "Source account ID is required") String sourceAccountId,
        @NotBlank(message = "Destination account ID is required") String destAccountId,
        @NotNull(message = "Amount is required") @Min(value = 1, message = "Amount must be at least 1 cent") Long amountCents,
        String description
) {}
