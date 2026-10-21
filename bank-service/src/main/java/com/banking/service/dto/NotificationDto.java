package com.banking.service.dto;

public record NotificationDto(
        String notificationId,
        String customerId,
        String message,
        boolean read,
        long createdAt
) {}
