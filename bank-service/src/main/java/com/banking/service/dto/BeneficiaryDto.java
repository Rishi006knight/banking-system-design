package com.banking.service.dto;

import jakarta.validation.constraints.NotBlank;

public record BeneficiaryDto(
        String beneficiaryId,
        String customerId,
        @NotBlank(message = "Name is required") String name,
        @NotBlank(message = "Account number is required") String accountNumber,
        @NotBlank(message = "Bank code is required") String bankCode
) {}
