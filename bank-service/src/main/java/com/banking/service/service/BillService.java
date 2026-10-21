package com.banking.service.service;

import com.banking.common.kvstore.KeyValueStore;
import com.banking.common.sharding.QueryResult;
import com.banking.common.sharding.Shard;
import com.banking.common.sharding.ShardRouter;
import com.banking.common.snowflake.IdGenerator;
import com.banking.service.dto.BillDto;
import com.banking.service.dto.BillPaymentRequest;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@Service
public class BillService {

    private final ShardRouter router;
    private final IdGenerator idGenerator;
    private final KeyValueStore<String> kvStore;

    private static final List<Map<String, String>> BILLERS = List.of(
            Map.of("code", "TNEB_POWER", "name", "Tamil Nadu Electricity Board", "category", "Electricity"),
            Map.of("code", "BESCOM_ELEC", "name", "Bangalore Electricity Supply", "category", "Electricity"),
            Map.of("code", "JIO_FIBER", "name", "Reliance Jio Fiber Broadband", "category", "Telecom"),
            Map.of("code", "AIRTEL_POST", "name", "Airtel Postpaid & DTH", "category", "Telecom"),
            Map.of("code", "INDANE_GAS", "name", "Indian Oil Indane Gas", "category", "Gas")
    );

    public BillService(ShardRouter router, IdGenerator idGenerator, KeyValueStore<String> kvStore) {
        this.router = router;
        this.idGenerator = idGenerator;
        this.kvStore = kvStore;
    }

    public List<Map<String, String>> getBillers() {
        return BILLERS;
    }

    public List<BillDto> getCustomerBills(String customerId) {
        List<BillDto> list = new ArrayList<>();
        // Search shards for customer's bills
        for (Shard shard : router.getAllShards()) {
            QueryResult qr = shard.getConnection().executeQuery(
                    "SELECT * FROM bills WHERE customer_id = ? ORDER BY created_at DESC", customerId
            );
            for (Map<String, Object> row : qr.getRows()) {
                long amount = ((Number) row.get("amount_cents")).longValue();
                Long paidAt = (row.get("paid_at") != null) ? ((Number) row.get("paid_at")).longValue() : null;
                list.add(new BillDto(
                        (String) row.get("bill_id"),
                        (String) row.get("customer_id"),
                        (String) row.get("biller_code"),
                        (String) row.get("biller_name"),
                        amount,
                        amount / 100.0,
                        (String) row.get("status"),
                        paidAt
                ));
            }
            if (!list.isEmpty()) break;
        }
        return list;
    }

    public BillDto payBill(BillPaymentRequest req, String idempotencyKey) {
        if (idempotencyKey == null || idempotencyKey.isBlank()) {
            throw new IllegalArgumentException("Header 'Idempotency-Key' is required for bill payments");
        }

        // Check idempotency in KV Store
        String cacheKey = "idempotency:bill:" + idempotencyKey;
        if (kvStore.exists(cacheKey)) {
            // Already paid
            String billId = kvStore.get(cacheKey);
            return getBillById(billId, req.accountId());
        }

        Shard shard = router.getShard(req.accountId());
        long now = System.currentTimeMillis();

        shard.getConnection().executeInTransaction(tx -> {
            // 1. Verify account exists and check balance FIRST
            QueryResult accQr = tx.executeQuery(
                    "SELECT balance_cents, customer_id FROM accounts WHERE account_id = ?", req.accountId()
            );
            if (accQr.isEmpty()) {
                throw new IllegalArgumentException("Account not found: " + req.accountId());
            }
            long balance = ((Number) accQr.firstRow().get("balance_cents")).longValue();
            String custId = (String) accQr.firstRow().get("customer_id");

            // 2. Get or create bill details
            QueryResult billQr = tx.executeQuery(
                    "SELECT * FROM bills WHERE bill_id = ?", req.billId()
            );
            long billAmount;
            String billerName;
            if (billQr.isEmpty()) {
                billAmount = 500; // default 500 cents (INR 5.00)
                billerName = "Utility Service Provider";
                tx.executeUpdate(
                        "INSERT OR REPLACE INTO bills (bill_id, customer_id, biller_code, biller_name, amount_cents, status, created_at, paid_at) " +
                                "VALUES (?, ?, ?, ?, ?, 'PAID', ?, ?)",
                        req.billId(), custId, "UTIL_BILL", billerName, billAmount, now, now
                );
            } else {
                Map<String, Object> billRow = billQr.firstRow();
                billAmount = ((Number) billRow.get("amount_cents")).longValue();
                billerName = (String) billRow.get("biller_name");
                tx.executeUpdate(
                        "UPDATE bills SET status = 'PAID', paid_at = ? WHERE bill_id = ?", now, req.billId()
                );
            }

            if (balance < billAmount) {
                throw new IllegalArgumentException(String.format("Insufficient balance to pay bill of %d cents", billAmount));
            }

            // 3. Debit account
            tx.executeUpdate(
                    "UPDATE accounts SET balance_cents = balance_cents - ?, updated_at = ? WHERE account_id = ?",
                    billAmount, now, req.accountId()
            );

            // 4. Insert transaction
            tx.executeUpdate(
                    "INSERT INTO transactions (transaction_id, account_id, type, amount_cents, balance_after_cents, description, idempotency_key, created_at) " +
                            "VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                    "TX-" + idGenerator.nextId(), req.accountId(), "BILL_PAY", billAmount,
                    balance - billAmount, "Bill payment to " + billerName, idempotencyKey, now
            );

            // 5. Notification
            if (custId != null) {
                tx.executeUpdate(
                        "INSERT INTO notifications (notification_id, customer_id, message, created_at) VALUES (?, ?, ?, ?)",
                        "NOTIF-" + idGenerator.nextId(), custId,
                        String.format("Paid INR %.2f for %s", billAmount / 100.0, billerName), now
                );
            }
        });

        // Invalidate account balance cache
        kvStore.remove("balance:" + req.accountId());
        kvStore.put(cacheKey, req.billId(), 86400000);

        return getBillById(req.billId(), req.accountId());
    }

    private BillDto getBillById(String billId, String accountId) {
        Shard shard = router.getShard(accountId);
        QueryResult qr = shard.getConnection().executeQuery("SELECT * FROM bills WHERE bill_id = ?", billId);
        if (qr.isEmpty()) return null;
        Map<String, Object> row = qr.firstRow();
        long amount = ((Number) row.get("amount_cents")).longValue();
        Long paidAt = (row.get("paid_at") != null) ? ((Number) row.get("paid_at")).longValue() : null;
        return new BillDto(
                billId,
                (String) row.get("customer_id"),
                (String) row.get("biller_code"),
                (String) row.get("biller_name"),
                amount,
                amount / 100.0,
                (String) row.get("status"),
                paidAt
        );
    }
}
