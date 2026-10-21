package com.banking.service;

import com.banking.common.sharding.QueryResult;
import com.banking.common.sharding.Shard;
import com.banking.common.sharding.ShardRouter;
import com.banking.service.dto.*;
import com.banking.service.service.AccountService;
import com.banking.service.service.AuthService;
import com.banking.service.service.TransferService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest(classes = BankServiceApplication.class, properties = {
        "banking.data-dir=./target/test-data",
        "banking.shards.count=3"
})
class BankServiceIntegrationTest {

    @Autowired
    private AuthService authService;

    @Autowired
    private AccountService accountService;

    @Autowired
    private TransferService transferService;

    @Autowired
    private ShardRouter shardRouter;

    @Test
    @DisplayName("Test Customer Registration, BCrypt Login, and Session Token Caching")
    void testAuthRegistrationAndLogin() {
        String username = "testuser_" + System.currentTimeMillis();
        RegisterRequest regReq = new RegisterRequest(username, "SecretPass@123", username + "@test.com", "Test User", 50_000L);

        AuthResponse regRes = authService.register(regReq);
        assertNotNull(regRes.token());
        assertNotNull(regRes.primaryAccountId());

        // Verify session verification
        assertNotNull(authService.verifySession(regRes.token()));

        // Login with correct password
        AuthResponse loginRes = authService.login(new AuthRequest(username, "SecretPass@123"));
        assertNotNull(loginRes.token());
        assertEquals(username, loginRes.username());

        // Login with bad password must fail
        assertThrows(IllegalArgumentException.class, () ->
                authService.login(new AuthRequest(username, "WrongPassword"))
        );
    }

    @Test
    @DisplayName("Test Account Balance Retrieval with Key-Value Caching")
    void testCachedBalance() {
        String username = "cacheuser_" + System.currentTimeMillis();
        AuthResponse reg = authService.register(new RegisterRequest(username, "Pass@123", username + "@test.com", "Cache User", 75_000L));
        String accId = reg.primaryAccountId();

        // 1st request: Cache miss -> queries shard
        BalanceDto b1 = accountService.getBalance(accId);
        assertFalse(b1.cached(), "First request must be a cache miss");
        assertEquals(75_000L, b1.balanceCents());

        // 2nd request: Cache hit -> served from KeyValueStore
        BalanceDto b2 = accountService.getBalance(accId);
        assertTrue(b2.cached(), "Second request must hit KeyValueStore cache");
        assertEquals(75_000L, b2.balanceCents());
    }

    @Test
    @DisplayName("Test Same-Shard Atomic Transfer with Idempotency")
    void testSameShardTransfer() {
        // Create accounts and find two that map to the same shard
        List<AuthResponse> accounts = createAccounts(10, 100_000L);
        AuthResponse src = null;
        AuthResponse dst = null;

        for (int i = 0; i < accounts.size(); i++) {
            for (int j = i + 1; j < accounts.size(); j++) {
                Shard s1 = shardRouter.getShard(accounts.get(i).primaryAccountId());
                Shard s2 = shardRouter.getShard(accounts.get(j).primaryAccountId());
                if (s1.equals(s2)) {
                    src = accounts.get(i);
                    dst = accounts.get(j);
                    break;
                }
            }
            if (src != null) break;
        }

        assertNotNull(src, "Should find two accounts on same shard");
        assertNotNull(dst, "Should find two accounts on same shard");

        String idemKey = "same-shard-idem-" + UUID.randomUUID();
        TransferRequest req = new TransferRequest(src.primaryAccountId(), dst.primaryAccountId(), 20_000L, "Rent");

        TransferResponse res = transferService.executeTransfer(req, idemKey);
        assertEquals("COMPLETED", res.status());
        assertEquals("SAME_SHARD", res.transferType());

        // Verify balances
        BalanceDto srcBal = accountService.getBalance(src.primaryAccountId());
        BalanceDto dstBal = accountService.getBalance(dst.primaryAccountId());
        assertEquals(80_000L, srcBal.balanceCents());
        assertEquals(120_000L, dstBal.balanceCents());

        // Test Idempotency: Calling again with same idempotency key must NOT debit again
        TransferResponse res2 = transferService.executeTransfer(req, idemKey);
        assertEquals(res.transferId(), res2.transferId());
        assertEquals(80_000L, accountService.getBalance(src.primaryAccountId()).balanceCents());
    }

    @Test
    @DisplayName("Test Cross-Shard Saga Transfer with Balance Invariant")
    void testCrossShardSagaTransfer() {
        // Find two accounts that map to DIFFERENT shards
        List<AuthResponse> accounts = createAccounts(10, 100_000L);
        AuthResponse src = null;
        AuthResponse dst = null;

        for (int i = 0; i < accounts.size(); i++) {
            for (int j = i + 1; j < accounts.size(); j++) {
                Shard s1 = shardRouter.getShard(accounts.get(i).primaryAccountId());
                Shard s2 = shardRouter.getShard(accounts.get(j).primaryAccountId());
                if (!s1.equals(s2)) {
                    src = accounts.get(i);
                    dst = accounts.get(j);
                    break;
                }
            }
            if (src != null) break;
        }

        assertNotNull(src, "Should find accounts on different shards");
        assertNotNull(dst, "Should find accounts on different shards");

        String idemKey = "cross-shard-idem-" + UUID.randomUUID();
        TransferRequest req = new TransferRequest(src.primaryAccountId(), dst.primaryAccountId(), 35_000L, "Tuition");

        TransferResponse res = transferService.executeTransfer(req, idemKey);
        assertEquals("COMPLETED", res.status());
        assertEquals("CROSS_SHARD_SAGA", res.transferType());
        assertNotEquals(res.sourceShard(), res.destShard());

        // Verify balances across shards
        BalanceDto srcBal = accountService.getBalance(src.primaryAccountId());
        BalanceDto dstBal = accountService.getBalance(dst.primaryAccountId());
        assertEquals(65_000L, srcBal.balanceCents());
        assertEquals(135_000L, dstBal.balanceCents());
    }

    @Test
    @DisplayName("INVARIANT TEST: 100 Concurrent Transfers with Balance Conservation and Zero Collisions")
    void testConcurrentTransfersAndBalanceInvariant() throws InterruptedException {
        int accountCount = 20;
        long startingBalancePerAccount = 100_000L; // 1,000 INR
        List<AuthResponse> accounts = createAccounts(accountCount, startingBalancePerAccount);

        // Snapshot initial total balance across all shards
        long initialTotalBalance = calculateTotalBalanceAcrossAllShards();

        int transferAttempts = 100;
        int threads = 10;
        ExecutorService executor = Executors.newFixedThreadPool(threads);
        CountDownLatch latch = new CountDownLatch(transferAttempts);
        AtomicInteger successfulTransfers = new AtomicInteger(0);
        AtomicInteger rejectedTransfers = new AtomicInteger(0);
        Random rng = new Random(12345);

        for (int i = 0; i < transferAttempts; i++) {
            int srcIdx = rng.nextInt(accountCount);
            int dstIdx = rng.nextInt(accountCount);
            while (srcIdx == dstIdx) {
                dstIdx = rng.nextInt(accountCount);
            }

            final String srcAcc = accounts.get(srcIdx).primaryAccountId();
            final String dstAcc = accounts.get(dstIdx).primaryAccountId();
            // Random amount from 1,000 to 20,000 cents (with some that exceed balance to test rejection)
            final long amount = (i % 10 == 0) ? 500_000L : (rng.nextInt(20) + 1) * 1_000L;
            final String idemKey = "stress-idem-" + i;

            executor.submit(() -> {
                try {
                    TransferRequest req = new TransferRequest(srcAcc, dstAcc, amount, "Concurrent stress test");
                    transferService.executeTransfer(req, idemKey);
                    successfulTransfers.incrementAndGet();
                } catch (Exception e) {
                    rejectedTransfers.incrementAndGet();
                } finally {
                    latch.countDown();
                }
            });
        }

        assertTrue(latch.await(20, TimeUnit.SECONDS));
        executor.shutdown();

        long finalTotalBalance = calculateTotalBalanceAcrossAllShards();

        System.out.println("==================================================================");
        System.out.println("CONCURRENT TRANSFERS INVARIANT TEST RESULTS:");
        System.out.printf("Total Attempts:       %d%n", transferAttempts);
        System.out.printf("Successful Transfers: %d%n", successfulTransfers.get());
        System.out.printf("Rejected Transfers:   %d%n", rejectedTransfers.get());
        System.out.printf("Initial Total Balance: %d cents%n", initialTotalBalance);
        System.out.printf("Final Total Balance:   %d cents%n", finalTotalBalance);
        System.out.println("==================================================================");

        // 1. INVARIANT: Sum of all balances across all shards MUST equal initial total
        assertEquals(initialTotalBalance, finalTotalBalance,
                "CRITICAL INVARIANT VIOLATION: Total money across all shards must be strictly conserved!");

        // 2. INVARIANT: No account balance can be negative
        for (AuthResponse acc : accounts) {
            BalanceDto bal = accountService.getBalance(acc.primaryAccountId());
            assertTrue(bal.balanceCents() >= 0, "Account balance cannot be negative: " + bal.accountId());
        }

        // 3. INVARIANT: Zero duplicate transaction IDs across all shards
        Set<String> allTxIds = new HashSet<>();
        for (Shard shard : shardRouter.getAllShards()) {
            QueryResult qr = shard.getConnection().executeQuery("SELECT transaction_id FROM transactions");
            for (Map<String, Object> row : qr.getRows()) {
                String txId = (String) row.get("transaction_id");
                assertTrue(allTxIds.add(txId), "Duplicate transaction ID found: " + txId);
            }
        }
        System.out.printf("Verified %d unique transaction IDs with zero duplicates.%n", allTxIds.size());
    }

    private List<AuthResponse> createAccounts(int count, long initialDeposit) {
        List<AuthResponse> list = new ArrayList<>(count);
        for (int i = 0; i < count; i++) {
            String u = "user_" + UUID.randomUUID().toString().substring(0, 8);
            list.add(authService.register(new RegisterRequest(u, "Secret123!", u + "@bank.com", "User " + i, initialDeposit)));
        }
        return list;
    }

    private long calculateTotalBalanceAcrossAllShards() {
        long total = 0;
        for (Shard s : shardRouter.getAllShards()) {
            QueryResult qr = s.getConnection().executeQuery("SELECT COALESCE(SUM(balance_cents), 0) as total FROM accounts");
            if (!qr.isEmpty() && qr.firstRow().get("total") != null) {
                total += ((Number) qr.firstRow().get("total")).longValue();
            }
        }
        return total;
    }
}
