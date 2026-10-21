package com.banking.gateway.config;

import com.banking.common.ratelimit.RateLimiter;
import com.banking.common.ratelimit.TokenBucketRateLimiter;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class GatewayConfig {

    @Bean
    public RateLimiter gatewayRateLimiter() {
        return new TokenBucketRateLimiter();
    }
}
