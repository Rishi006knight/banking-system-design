package com.banking.service.service;

import com.banking.common.kvstore.KeyValueStore;
import com.banking.common.sharding.QueryResult;
import com.banking.common.sharding.Shard;
import com.banking.common.sharding.ShardRouter;
import com.banking.common.snowflake.IdGenerator;
import com.banking.service.dto.TransferRequest;
import com.banking.service.dto.TransferResponse;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Service;

import java.util.Map;

/**
 * Core Transfer Service implementing:
 * 1. Same-shard atomic ACID transfers.
 * 2. Cross-shard Saga orchestration with compensatory refunds on failure.
 * 3. Strict Idempotency guarantees via KeyValueStore.
 * 4. Automatic cache invalidation.
 */
@Service
public class TransferService {

    private final ShardRouter router;
    private final IdGenerator idGenerator;
    private final KeyValueStore<String> kvStore;
    private final ObjectMapper mapper = new ObjectMapper();

    public TransferService(ShardRouter router, IdGenerator idGenerator, KeyValueStore<String> kvStore) {
        this.router = router;
        this.idGenerator = idGenerator;
        this.kvStore = kvStore;
    }

    public TransferResponse executeTransfer(TransferRequest req, String idempotencyKey) {
        if (idempotencyKey == null || idempotencyKey.isBlank()) {
            throw new IllegalArgumentException("Header 'Idempotency-Key' is required for fund transfers");
        }
        if (req.sourceAccountId().equals(req.destAccountId())) {
            throw new IllegalArgumentException("Source and destination accounts must be different");
        }
        if (req.amountCents() <= 0) {
            throw new IllegalArgumentException("Transfer amount must be strictly positive");
        }

        // 1. Idempotency Check: Return cached response if already executed
        String cacheKey = "idempotency:transfer:" + idempotencyKey;
        String cachedJson = kvStore.get(cacheKey);
        if (cachedJson != null) {
            try {
                return mapper.readValue(cachedJson, TransferResponse.class);
            } catch (JsonProcessingException ignored) {}
        }

        Shard sourceShard = router.getShard(req.sourceAccountId());
        Shard destShard = router.getShard(req.destAccountId());
        String transferId = "TRF-" + idGenerator.nextId();
        long now = System.currentTimeMillis();

        TransferResponse response;
        if (sourceShard.equals(destShard)) {
            // ==========================================
            // SAME-SHARD TRANSFER: Atomic Database Tx
            // ==========================================
            response = executeSameShardTransfer(sourceShard, req, transferId, idempotencyKey, now);
        } else {
            // ==========================================
            // CROSS-SHARD TRANSFER: SAGA Orchestration
            // ==========================================
            response = executeCrossShardSagaTransfer(sourceShard, destShard, req, transferId, idempotencyKey, now);
        }

        // Cache completed transfer under Idempotency-Key for 24 hours
        try {
            kvStore.put(cacheKey, mapper.writeValueAsString(response), 86400000);
        } catch (JsonProcessingException ignored) {}

        return response;
    }

    private TransferResponse executeSameShardTransfer(
            Shard shard, TransferRequest req, String transferId, String idempotencyKey, long now) {

        shard.getConnection().executeInTransaction(tx -> {
            // 1. Verify source balance
            QueryResult srcQr = tx.executeQuery(
                    "SELECT balance_cents, customer_id FROM accounts WHERE account_id = ?", req.sourceAccountId()
            );
            if (srcQr.isEmpty()) {
                throw new IllegalArgumentException("Source account not found: " + req.sourceAccountId());
            }
            long srcBalance = ((Number) srcQr.firstRow().get("balance_cents")).longValue();
            if (srcBalance < req.amountCents()) {
                throw new IllegalArgumentException(String.format("Insufficient funds: balance is %d cents, required %d cents",
                        srcBalance, req.amountCents()));
            }

            // 2. Verify destination exists
            QueryResult dstQr = tx.executeQuery(
                    "SELECT balance_cents, customer_id FROM accounts WHERE account_id = ?", req.destAccountId()
            );
            if (dstQr.isEmpty()) {
                throw new IllegalArgumentException("Destination account not found: " + req.destAccountId());
            }

            // 3. Debit source
            tx.executeUpdate(
                    "UPDATE accounts SET balance_cents = balance_cents - ?, updated_at = ? WHERE account_id = ?",
                    req.amountCents(), now, req.sourceAccountId()
            );

            // 4. Credit destination
            tx.executeUpdate(
                    "UPDATE accounts SET balance_cents = balance_cents + ?, updated_at = ? WHERE account_id = ?",
                    req.amountCents(), now, req.destAccountId()
            );

            // 5. Insert transaction records
            long newSrcBal = srcBalance - req.amountCents();
            long dstBal = ((Number) dstQr.firstRow().get("balance_cents")).longValue() + req.amountCents();

            tx.executeUpdate(
                    "INSERT INTO transactions (transaction_id, account_id, type, amount_cents, balance_after_cents, description, idempotency_key, created_at) " +
                            "VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                    "TX-" + idGenerator.nextId(), req.sourceAccountId(), "TRANSFER_OUT", req.amountCents(),
                    newSrcBal, "Transfer to " + req.destAccountId(), idempotencyKey, now
            );

            tx.executeUpdate(
                    "INSERT INTO transactions (transaction_id, account_id, type, amount_cents, balance_after_cents, description, idempotency_key, created_at) " +
                            "VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                    "TX-" + idGenerator.nextId(), req.destAccountId(), "TRANSFER_IN", req.amountCents(),
                    dstBal, "Transfer from " + req.sourceAccountId(), idempotencyKey, now
            );

            // 6. Record completed transfer
            tx.executeUpdate(
                    "INSERT INTO transfers (transfer_id, source_account_id, dest_account_id, amount_cents, status, idempotency_key, created_at, updated_at) " +
                            "VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                    transferId, req.sourceAccountId(), req.destAccountId(), req.amountCents(), "COMPLETED", idempotencyKey, now, now
            );

            // 7. Write notifications
            String srcCustId = (String) srcQr.firstRow().get("customer_id");
            String dstCustId = (String) dstQr.firstRow().get("customer_id");

            tx.executeUpdate(
                    "INSERT INTO notifications (notification_id, customer_id, message, created_at) VALUES (?, ?, ?, ?)",
                    "NOTIF-" + idGenerator.nextId(), srcCustId,
                    String.format("Transferred INR %.2f to account %s", req.amountCents() / 100.0, req.destAccountId()), now
            );
            tx.executeUpdate(
                    "INSERT INTO notifications (notification_id, customer_id, message, created_at) VALUES (?, ?, ?, ?)",
                    "NOTIF-" + idGenerator.nextId(), dstCustId,
                    String.format("Received INR %.2f from account %s", req.amountCents() / 100.0, req.sourceAccountId()), now
            );
        });

        // Invalidate KV balance cache for both accounts
        kvStore.remove("balance:" + req.sourceAccountId());
        kvStore.remove("balance:" + req.destAccountId());

        return new TransferResponse(
                transferId, req.sourceAccountId(), req.destAccountId(),
                req.amountCents(), req.amountCents() / 100.0, "COMPLETED", "SAME_SHARD",
                shard.getShardId(), shard.getShardId(), idempotencyKey, now
        );
    }

    private TransferResponse executeCrossShardSagaTransfer(
            Shard sourceShard, Shard destShard, TransferRequest req, String transferId, String idempotencyKey, long now) {

        // ========================================================
        // PRE-FLIGHT CHECK: Verify Destination Account Exists
        // ========================================================
        QueryResult dstCheck = destShard.getConnection().executeQuery(
                "SELECT customer_id FROM accounts WHERE account_id = ?", req.destAccountId()
        );
        if (dstCheck.isEmpty()) {
            throw new IllegalArgumentException("Destination account not found: " + req.destAccountId());
        }

        // ========================================================
        // SAGA STEP 1: Debit Source Shard & Record Transfer PENDING
        // ========================================================
        sourceShard.getConnection().executeInTransaction(tx -> {
            QueryResult srcQr = tx.executeQuery(
                    "SELECT balance_cents, customer_id FROM accounts WHERE account_id = ?", req.sourceAccountId()
            );
            if (srcQr.isEmpty()) {
                throw new IllegalArgumentException("Source account not found: " + req.sourceAccountId());
            }
            long srcBalance = ((Number) srcQr.firstRow().get("balance_cents")).longValue();
            if (srcBalance < req.amountCents()) {
                throw new IllegalArgumentException(String.format("Insufficient funds: balance is %d cents, required %d cents",
                        srcBalance, req.amountCents()));
            }

            // Debit source account
            tx.executeUpdate(
                    "UPDATE accounts SET balance_cents = balance_cents - ?, updated_at = ? WHERE account_id = ?",
                    req.amountCents(), now, req.sourceAccountId()
            );

            // Insert transaction row
            tx.executeUpdate(
                    "INSERT INTO transactions (transaction_id, account_id, type, amount_cents, balance_after_cents, description, idempotency_key, created_at) " +
                            "VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                    "TX-" + idGenerator.nextId(), req.sourceAccountId(), "TRANSFER_OUT", req.amountCents(),
                    srcBalance - req.amountCents(), "Cross-shard transfer to " + req.destAccountId(), idempotencyKey, now
            );

            // Record Transfer as PENDING
            tx.executeUpdate(
                    "INSERT INTO transfers (transfer_id, source_account_id, dest_account_id, amount_cents, status, idempotency_key, created_at, updated_at) " +
                            "VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                    transferId, req.sourceAccountId(), req.destAccountId(), req.amountCents(), "PENDING", idempotencyKey, now, now
            );
        });

        // Invalidate source cache immediately
        kvStore.remove("balance:" + req.sourceAccountId());

        // ========================================================
        // SAGA STEP 2: Credit Destination Shard
        // ========================================================
        boolean step2Success = false;
        String errorMessage = null;

        try {
            destShard.getConnection().executeInTransaction(tx -> {
                QueryResult dstQr = tx.executeQuery(
                        "SELECT balance_cents, customer_id FROM accounts WHERE account_id = ?", req.destAccountId()
                );
                if (dstQr.isEmpty()) {
                    throw new IllegalArgumentException("Destination account not found: " + req.destAccountId());
                }

                long dstBal = ((Number) dstQr.firstRow().get("balance_cents")).longValue() + req.amountCents();

                // Credit destination account
                tx.executeUpdate(
                        "UPDATE accounts SET balance_cents = balance_cents + ?, updated_at = ? WHERE account_id = ?",
                        req.amountCents(), now, req.destAccountId()
                );

                // Insert transaction record on destination shard
                tx.executeUpdate(
                        "INSERT INTO transactions (transaction_id, account_id, type, amount_cents, balance_after_cents, description, idempotency_key, created_at) " +
                                "VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                        "TX-" + idGenerator.nextId(), req.destAccountId(), "TRANSFER_IN", req.amountCents(),
                        dstBal, "Cross-shard transfer from " + req.sourceAccountId(), idempotencyKey, now
                );

                // Notification for destination customer
                String dstCustId = (String) dstQr.firstRow().get("customer_id");
                tx.executeUpdate(
                        "INSERT INTO notifications (notification_id, customer_id, message, created_at) VALUES (?, ?, ?, ?)",
                        "NOTIF-" + idGenerator.nextId(), dstCustId,
                        String.format("Received INR %.2f from account %s", req.amountCents() / 100.0, req.sourceAccountId()), now
                );
            });

            // Invalidate destination cache
            kvStore.remove("balance:" + req.destAccountId());
            step2Success = true;
        } catch (Exception e) {
            errorMessage = e.getMessage();
        }

        // ========================================================
        // SAGA STEP 3: Complete or Compensate
        // ========================================================
        if (step2Success) {
            // Mark COMPLETED on source shard
            sourceShard.getConnection().executeUpdate(
                    "UPDATE transfers SET status = 'COMPLETED', updated_at = ? WHERE transfer_id = ?", now, transferId
            );

            // Write notification for source customer
            QueryResult srcCustQr = sourceShard.getConnection().executeQuery(
                    "SELECT customer_id FROM accounts WHERE account_id = ?", req.sourceAccountId()
            );
            if (!srcCustQr.isEmpty()) {
                String srcCustId = (String) srcCustQr.firstRow().get("customer_id");
                sourceShard.getConnection().executeUpdate(
                        "INSERT INTO notifications (notification_id, customer_id, message, created_at) VALUES (?, ?, ?, ?)",
                        "NOTIF-" + idGenerator.nextId(), srcCustId,
                        String.format("Transferred INR %.2f to %s (Cross-shard)", req.amountCents() / 100.0, req.destAccountId()), now
                );
            }

            return new TransferResponse(
                    transferId, req.sourceAccountId(), req.destAccountId(),
                    req.amountCents(), req.amountCents() / 100.0, "COMPLETED", "CROSS_SHARD_SAGA",
                    sourceShard.getShardId(), destShard.getShardId(), idempotencyKey, now
            );
        } else {
            // STEP 2 FAILED -> EXECUTE COMPENSATING REFUND TRANSACTION
            compensateFailedTransfer(sourceShard, req, transferId, errorMessage, now);

            if (errorMessage != null && errorMessage.contains("not found")) {
                throw new IllegalArgumentException(errorMessage);
            }
            throw new IllegalStateException("Cross-shard transfer could not be completed at destination: " + errorMessage + ". Compensating refund executed.");
        }
    }

    public void compensateFailedTransfer(Shard sourceShard, TransferRequest req, String transferId, String error, long now) {
        sourceShard.getConnection().executeInTransaction(tx -> {
            // 1. Refund the debited amount
            tx.executeUpdate(
                    "UPDATE accounts SET balance_cents = balance_cents + ?, updated_at = ? WHERE account_id = ?",
                    req.amountCents(), now, req.sourceAccountId()
            );

            QueryResult srcQr = tx.executeQuery(
                    "SELECT balance_cents, customer_id FROM accounts WHERE account_id = ?", req.sourceAccountId()
            );
            long refundedBalance = srcQr.isEmpty() ? 0 : ((Number) srcQr.firstRow().get("balance_cents")).longValue();

            // 2. Insert compensation transaction record
            tx.executeUpdate(
                    "INSERT INTO transactions (transaction_id, account_id, type, amount_cents, balance_after_cents, description, created_at) " +
                            "VALUES (?, ?, ?, ?, ?, ?, ?)",
                    "TX-" + idGenerator.nextId(), req.sourceAccountId(), "COMPENSATION_REFUND",
                    req.amountCents(), refundedBalance, "Refund for failed transfer: " + transferId, now
            );

            // 3. Mark transfer as COMPENSATED
            tx.executeUpdate(
                    "UPDATE transfers SET status = 'COMPENSATED', error_message = ?, updated_at = ? WHERE transfer_id = ?",
                    error, now, transferId
            );
        });

        // Ensure cache is invalidated
        kvStore.remove("balance:" + req.sourceAccountId());
    }
}
