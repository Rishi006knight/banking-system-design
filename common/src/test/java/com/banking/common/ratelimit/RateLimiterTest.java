package com.banking.common.ratelimit;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.Duration;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.jupiter.api.Assertions.*;

class RateLimiterTest {

    private TokenBucketRateLimiter rateLimiter;

    @BeforeEach
    void setUp() {
        rateLimiter = new TokenBucketRateLimiter();
    }

    @AfterEach
    void tearDown() {
        rateLimiter.shutdown();
    }

    @Test
    @DisplayName("Test Token Bucket Capacity and Rejection")
    void testBasicCapacityAndRejection() {
        RateLimitConfig config = RateLimitConfig.of("TEST_RULE", 3, Duration.ofSeconds(10));
        String user = "user-101";

        // First 3 should succeed
        assertTrue(rateLimiter.tryAcquire(user, config).isAllowed());
        assertTrue(rateLimiter.tryAcquire(user, config).isAllowed());
        RateLimitResult third = rateLimiter.tryAcquire(user, config);
        assertTrue(third.isAllowed());
        assertEquals(0, third.getRemainingTokens());

        // 4th request must be rejected
        RateLimitResult fourth = rateLimiter.tryAcquire(user, config);
        assertFalse(fourth.isAllowed());
        assertTrue(fourth.getRetryAfterMillis() > 0);
        assertTrue(fourth.getRetryAfterSeconds() >= 1);

        System.out.println("RateLimiter Metrics: " + rateLimiter.getGlobalMetrics());
        assertEquals(3, rateLimiter.getGlobalMetrics().getAllowedRequests());
        assertEquals(1, rateLimiter.getGlobalMetrics().getRejectedRequests());
        assertEquals(25.0, rateLimiter.getGlobalMetrics().getRejectionRate(), 0.01);
    }

    @Test
    @DisplayName("Test Lazy Refill after Elapsed Time")
    void testLazyRefill() throws InterruptedException {
        // 2 tokens per 200ms
        RateLimitConfig config = new RateLimitConfig("FAST_REFILL", 2, 2, 200);
        String user = "user-202";

        assertTrue(rateLimiter.tryAcquire(user, config).isAllowed());
        assertTrue(rateLimiter.tryAcquire(user, config).isAllowed());
        assertFalse(rateLimiter.tryAcquire(user, config).isAllowed());

        // Wait for refill
        Thread.sleep(250);

        // Should be allowed again
        RateLimitResult refilled = rateLimiter.tryAcquire(user, config);
        assertTrue(refilled.isAllowed());
    }

    @Test
    @DisplayName("Test Per-Endpoint Rules (Strict Login vs Lenient Enquiry)")
    void testPerEndpointRules() {
        String clientIp = "192.168.1.50";

        // Login is strict: 5/min
        RateLimitConfig loginRule = RateLimitConfig.strictLogin();
        for (int i = 0; i < 5; i++) {
            assertTrue(rateLimiter.tryAcquire(clientIp, loginRule).isAllowed());
        }
        assertFalse(rateLimiter.tryAcquire(clientIp, loginRule).isAllowed());

        // Enquiry is lenient: 120/min; should still allow requests for the same client
        RateLimitConfig enquiryRule = RateLimitConfig.lenientEnquiry();
        for (int i = 0; i < 20; i++) {
            assertTrue(rateLimiter.tryAcquire(clientIp, enquiryRule).isAllowed());
        }

        RateLimiterMetrics loginMetrics = rateLimiter.getMetrics("LOGIN_STRICT");
        RateLimiterMetrics enquiryMetrics = rateLimiter.getMetrics("ENQUIRY_LENIENT");

        System.out.println("Login Metrics: " + loginMetrics);
        System.out.println("Enquiry Metrics: " + enquiryMetrics);

        assertEquals(1, loginMetrics.getRejectedRequests());
        assertEquals(0, enquiryMetrics.getRejectedRequests());
    }

    @Test
    @DisplayName("Concurrency Test: Multiple Threads Requesting Same Bucket")
    void testConcurrentRequests() throws InterruptedException {
        int threads = 20;
        int capacity = 50;
        int requestsPerThread = 10; // Total 200 requests for 50 tokens
        RateLimitConfig config = RateLimitConfig.of("CONCURRENT_TEST", capacity, Duration.ofMinutes(1));

        ExecutorService executor = Executors.newFixedThreadPool(threads);
        CountDownLatch latch = new CountDownLatch(threads);
        AtomicInteger allowedCount = new AtomicInteger(0);
        AtomicInteger rejectedCount = new AtomicInteger(0);

        for (int i = 0; i < threads; i++) {
            executor.submit(() -> {
                try {
                    for (int j = 0; j < requestsPerThread; j++) {
                        RateLimitResult res = rateLimiter.tryAcquire("shared-account-key", config);
                        if (res.isAllowed()) {
                            allowedCount.incrementAndGet();
                        } else {
                            rejectedCount.incrementAndGet();
                        }
                    }
                } finally {
                    latch.countDown();
                }
            });
        }

        assertTrue(latch.await(5, TimeUnit.SECONDS));
        executor.shutdown();

        System.out.printf("Concurrent Rate Limiter Result: Allowed=%d, Rejected=%d, Total=%d%n",
                allowedCount.get(), rejectedCount.get(), allowedCount.get() + rejectedCount.get());

        // Exactly 'capacity' tokens must be allowed, and remaining rejected
        assertEquals(capacity, allowedCount.get());
        assertEquals((threads * requestsPerThread) - capacity, rejectedCount.get());
        assertEquals(200, rateLimiter.getGlobalMetrics().getTotalRequests());
    }

    @Test
    @DisplayName("Test Stale Bucket Eviction")
    void testStaleBucketEviction() throws InterruptedException {
        RateLimitConfig config = RateLimitConfig.of("CLEANUP_TEST", 10, Duration.ofMinutes(1));
        rateLimiter.tryAcquire("stale-user-1", config);
        rateLimiter.tryAcquire("stale-user-2", config);

        assertEquals(2, rateLimiter.getActiveBucketCount());

        Thread.sleep(50);
        // Clean buckets idle for > 20ms
        int removed = rateLimiter.cleanupStaleBuckets(20);
        assertEquals(2, removed);
        assertEquals(0, rateLimiter.getActiveBucketCount());
    }

    @Test
    @DisplayName("Test Dynamic Countdown of Retry-After Over Elapsed Time")
    void testDynamicCountdownRetryAfterOverTime() throws InterruptedException {
        // Capacity 1, refill 1 token per 1000ms
        RateLimitConfig config = new RateLimitConfig("COUNTDOWN_TEST", 1, 1, 1000);
        String key = "test-countdown-user";

        // First request succeeds
        assertTrue(rateLimiter.tryAcquire(key, config).isAllowed());

        // Immediately second request is rejected: retryAfter should be ~1000ms
        RateLimitResult reject1 = rateLimiter.tryAcquire(key, config);
        assertFalse(reject1.isAllowed());
        long wait1 = reject1.getRetryAfterMillis();
        assertTrue(wait1 > 700 && wait1 <= 1000, "Initial wait should be ~1000ms, was " + wait1);

        // Sleep 400ms
        Thread.sleep(400);

        // Third request is rejected: retryAfter must have dynamically counted down!
        RateLimitResult reject2 = rateLimiter.tryAcquire(key, config);
        assertFalse(reject2.isAllowed());
        long wait2 = reject2.getRetryAfterMillis();
        assertTrue(wait2 < wait1, "Dynamic countdown expected: wait2 (" + wait2 + ") < wait1 (" + wait1 + ")");
        assertTrue(wait2 <= 650, "After 400ms sleep, wait should be <= ~650ms, was " + wait2);
    }

    @Test
    @DisplayName("Test Multi-Key Isolation (Keys Operate in Independent Buckets)")
    void testMultiKeyIsolation() {
        RateLimitConfig config = RateLimitConfig.of("ISOLATION_TEST", 2, Duration.ofMinutes(1));
        String clientA = "client-A";
        String clientB = "client-B";

        // Exhaust clientA's bucket (2 tokens)
        assertTrue(rateLimiter.tryAcquire(clientA, config).isAllowed());
        assertTrue(rateLimiter.tryAcquire(clientA, config).isAllowed());
        assertFalse(rateLimiter.tryAcquire(clientA, config).isAllowed());

        // ClientB must be completely unaffected by clientA's exhaustion
        assertTrue(rateLimiter.tryAcquire(clientB, config).isAllowed());
        assertTrue(rateLimiter.tryAcquire(clientB, config).isAllowed());
        assertFalse(rateLimiter.tryAcquire(clientB, config).isAllowed());

        // Key A is still rejected
        assertFalse(rateLimiter.tryAcquire(clientA, config).isAllowed());
    }
}
