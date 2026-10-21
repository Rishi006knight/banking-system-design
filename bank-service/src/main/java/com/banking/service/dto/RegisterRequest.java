package com.banking.service.dto;

import jakarta.validation.constraints.NotBlank;

public record RegisterRequest(
        @NotBlank(message = "Username is required") String username,
        @NotBlank(message = "Password is required") String password,
        @NotBlank(message = "Email is required") String email,
        @NotBlank(message = "Full name is required") String fullName,
        Long initialDepositCents
) {}
