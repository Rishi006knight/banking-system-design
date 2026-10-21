package com.banking.service.service;

import com.banking.common.sharding.QueryResult;
import com.banking.common.sharding.Shard;
import com.banking.common.sharding.ShardRouter;
import com.banking.service.dto.TransferRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.util.Map;

/**
 * Background recovery job that re-drives any PENDING cross-shard transfers
 * orphaned by crashes, timeouts, or network interruptions.
 */
@Component
public class TransferRecoveryJob {

    private static final Logger log = LoggerFactory.getLogger(TransferRecoveryJob.class);

    private final ShardRouter router;
    private final TransferService transferService;

    public TransferRecoveryJob(ShardRouter router, TransferService transferService) {
        this.router = router;
        this.transferService = transferService;
    }

    @EventListener(ApplicationReadyEvent.class)
    public void onStartup() {
        log.info("Running initial Saga transfer recovery scan across all shards...");
        recoverPendingTransfers();
    }

    @Scheduled(fixedDelay = 10000)
    public void scheduledRecovery() {
        recoverPendingTransfers();
    }

    public synchronized int recoverPendingTransfers() {
        int recoveredCount = 0;
        long cutoffTime = System.currentTimeMillis() - 3000; // Older than 3 seconds

        for (Shard sourceShard : router.getAllShards()) {
            QueryResult pendingQr = sourceShard.getConnection().executeQuery(
                    "SELECT * FROM transfers WHERE status = 'PENDING' AND created_at < ?", cutoffTime
            );

            for (Map<String, Object> transfer : pendingQr.getRows()) {
                String transferId = (String) transfer.get("transfer_id");
                String sourceAccountId = (String) transfer.get("source_account_id");
                String destAccountId = (String) transfer.get("dest_account_id");
                long amount = ((Number) transfer.get("amount_cents")).longValue();
                String idempotencyKey = (String) transfer.get("idempotency_key");

                log.warn("Found orphaned PENDING transfer {} from {} to {}. Re-driving Saga...",
                        transferId, sourceAccountId, destAccountId);

                Shard destShard = router.getShard(destAccountId);

                // Check if destination already executed the credit
                QueryResult destCheck = destShard.getConnection().executeQuery(
                        "SELECT * FROM transactions WHERE account_id = ? AND idempotency_key = ? AND type = 'TRANSFER_IN'",
                        destAccountId, idempotencyKey
                );

                if (!destCheck.isEmpty()) {
                    // Step 2 actually succeeded before the crash; mark COMPLETED on source
                    sourceShard.getConnection().executeUpdate(
                            "UPDATE transfers SET status = 'COMPLETED', updated_at = ? WHERE transfer_id = ?",
                            System.currentTimeMillis(), transferId
                    );
                    log.info("Re-drive resolved transfer {} as COMPLETED.", transferId);
                } else {
                    // Step 2 was never applied; trigger compensating refund on source
                    TransferRequest req = new TransferRequest(sourceAccountId, destAccountId, amount, "Recovery");
                    transferService.compensateFailedTransfer(
                            sourceShard, req, transferId, "Recovery job found incomplete transfer after timeout", System.currentTimeMillis()
                    );
                    log.info("Re-drive compensated transfer {} with refund.", transferId);
                }
                recoveredCount++;
            }
        }
        return recoveredCount;
    }
}
