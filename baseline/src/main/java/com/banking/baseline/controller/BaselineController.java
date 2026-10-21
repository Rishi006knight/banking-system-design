package com.banking.baseline.controller;

import com.banking.baseline.db.BaselineDatabase;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.web.bind.annotation.*;

import java.util.*;

@RestController
public class BaselineController {

    private final BaselineDatabase db;
    private final BCryptPasswordEncoder encoder = new BCryptPasswordEncoder();

    public BaselineController(BaselineDatabase db) {
        this.db = db;
    }

    @PostMapping("/auth/register")
    public ResponseEntity<?> register(@RequestBody Map<String, Object> req) {
        String username = (String) req.get("username");
        String password = (String) req.get("password");
        String email = (String) req.get("email");
        String fullName = (String) req.get("fullName");
        long initialDeposit = req.containsKey("initialDepositCents") ? ((Number) req.get("initialDepositCents")).longValue() : 0;

        String customerId = "CUST-" + UUID.randomUUID().toString().substring(0, 8);
        String accountId = "ACC-" + UUID.randomUUID().toString().substring(0, 8);
        String accountNumber = "BASE-" + (System.currentTimeMillis() % 1_000_000_000L);
        long now = System.currentTimeMillis();

        List<Map<String, Object>> existing = db.query("SELECT customer_id FROM customers WHERE username = ?", username);
        if (!existing.isEmpty()) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("error", "Username already exists: " + username));
        }

        db.update(
                "INSERT INTO customers (customer_id, username, password_hash, email, full_name, created_at) VALUES (?, ?, ?, ?, ?, ?)",
                customerId, username, encoder.encode(password), email, fullName, now
        );

        db.update(
                "INSERT INTO accounts (account_id, customer_id, account_number, balance_cents, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
                accountId, customerId, accountNumber, initialDeposit, now, now
        );

        return ResponseEntity.status(HttpStatus.CREATED).body(Map.of(
                "customerId", customerId,
                "username", username,
                "primaryAccountId", accountId,
                "token", "baseline-token-" + UUID.randomUUID()
        ));
    }

    @PostMapping("/auth/login")
    public ResponseEntity<?> login(@RequestBody Map<String, Object> req) {
        String username = (String) req.get("username");
        String password = (String) req.get("password");

        List<Map<String, Object>> rows = db.query("SELECT * FROM customers WHERE username = ?", username);
        if (rows.isEmpty() || !encoder.matches(password, (String) rows.get(0).get("password_hash"))) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("error", "Invalid credentials"));
        }

        Map<String, Object> cust = rows.get(0);
        String customerId = (String) cust.get("customer_id");
        List<Map<String, Object>> accs = db.query("SELECT account_id FROM accounts WHERE customer_id = ? LIMIT 1", customerId);
        String accountId = accs.isEmpty() ? null : (String) accs.get(0).get("account_id");

        return ResponseEntity.ok(Map.of(
                "customerId", customerId,
                "username", username,
                "primaryAccountId", accountId,
                "token", "baseline-token-" + UUID.randomUUID()
        ));
    }

    @GetMapping("/accounts/{id}")
    public ResponseEntity<?> getAccount(@PathVariable("id") String id) {
        List<Map<String, Object>> rows = db.query("SELECT * FROM accounts WHERE account_id = ?", id);
        if (rows.isEmpty()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", "Account not found"));
        }
        return ResponseEntity.ok(rows.get(0));
    }

    @GetMapping("/accounts/{id}/balance")
    public ResponseEntity<?> getBalance(@PathVariable("id") String id) {
        // Uncached: Direct disk query every time
        List<Map<String, Object>> rows = db.query("SELECT balance_cents FROM accounts WHERE account_id = ?", id);
        if (rows.isEmpty()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", "Account not found"));
        }
        long balanceCents = ((Number) rows.get(0).get("balance_cents")).longValue();
        return ResponseEntity.ok(Map.of(
                "accountId", id,
                "balanceCents", balanceCents,
                "balanceInr", balanceCents / 100.0,
                "cached", false,
                "shard", "baseline-single-db"
        ));
    }

    @GetMapping("/accounts/{id}/transactions")
    public ResponseEntity<?> getTransactions(@PathVariable("id") String id) {
        List<Map<String, Object>> rows = db.query(
                "SELECT * FROM transactions WHERE account_id = ? ORDER BY created_at DESC LIMIT 20", id
        );
        return ResponseEntity.ok(rows);
    }

    @PostMapping("/transfers")
    public ResponseEntity<?> transfer(
            @RequestBody Map<String, Object> req,
            @RequestHeader(value = "Idempotency-Key", required = false) String idempotencyKey) {

        String srcId = (String) req.get("sourceAccountId");
        String dstId = (String) req.get("destAccountId");
        long amount = ((Number) req.get("amountCents")).longValue();
        long now = System.currentTimeMillis();
        String transferId = "BASE-TRF-" + UUID.randomUUID().toString().substring(0, 8);

        try {
            db.inTransaction(() -> {
                List<Map<String, Object>> srcRows = db.query("SELECT balance_cents FROM accounts WHERE account_id = ?", srcId);
                if (srcRows.isEmpty()) throw new IllegalArgumentException("Source account not found");
                long srcBal = ((Number) srcRows.get(0).get("balance_cents")).longValue();
                if (srcBal < amount) throw new IllegalArgumentException("Insufficient balance");

                List<Map<String, Object>> dstRows = db.query("SELECT balance_cents FROM accounts WHERE account_id = ?", dstId);
                if (dstRows.isEmpty()) throw new IllegalArgumentException("Destination account not found");

                db.update("UPDATE accounts SET balance_cents = balance_cents - ?, updated_at = ? WHERE account_id = ?", amount, now, srcId);
                db.update("UPDATE accounts SET balance_cents = balance_cents + ?, updated_at = ? WHERE account_id = ?", amount, now, dstId);

                db.update("INSERT INTO transactions (transaction_id, account_id, type, amount_cents, balance_after_cents, description, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
                        "TX-" + UUID.randomUUID().toString().substring(0, 8), srcId, "DEBIT", amount, srcBal - amount, "Transfer to " + dstId, now);

                long dstBal = ((Number) dstRows.get(0).get("balance_cents")).longValue();
                db.update("INSERT INTO transactions (transaction_id, account_id, type, amount_cents, balance_after_cents, description, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
                        "TX-" + UUID.randomUUID().toString().substring(0, 8), dstId, "CREDIT", amount, dstBal + amount, "Transfer from " + srcId, now);

                db.update("INSERT INTO transfers (transfer_id, source_account_id, dest_account_id, amount_cents, status, idempotency_key, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                        transferId, srcId, dstId, amount, "COMPLETED", idempotencyKey, now, now);
            });

            return ResponseEntity.ok(Map.of(
                    "transferId", transferId,
                    "sourceAccountId", srcId,
                    "destAccountId", dstId,
                    "amountCents", amount,
                    "status", "COMPLETED",
                    "mode", "baseline-single-db"
            ));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("error", e.getMessage()));
        }
    }

    @GetMapping("/beneficiaries")
    public ResponseEntity<?> getBeneficiaries(@RequestParam("customerId") String customerId) {
        List<Map<String, Object>> rows = db.query("SELECT * FROM beneficiaries WHERE customer_id = ?", customerId);
        return ResponseEntity.ok(rows);
    }

    @PostMapping("/beneficiaries")
    public ResponseEntity<?> addBeneficiary(
            @RequestParam("customerId") String customerId,
            @RequestBody Map<String, Object> req) {
        String benId = "BEN-" + UUID.randomUUID().toString().substring(0, 8);
        String name = (String) req.get("name");
        String accNum = (String) req.get("accountNumber");
        String bankCode = (String) req.get("bankCode");
        long now = System.currentTimeMillis();
        db.update("INSERT INTO beneficiaries (beneficiary_id, customer_id, name, account_number, bank_code, created_at) VALUES (?, ?, ?, ?, ?, ?)",
                benId, customerId, name, accNum, bankCode, now);
        return ResponseEntity.status(HttpStatus.CREATED).body(Map.of(
                "beneficiaryId", benId,
                "customerId", customerId,
                "name", name,
                "accountNumber", accNum,
                "bankCode", bankCode
        ));
    }

    @GetMapping("/bills")
    public ResponseEntity<?> getBills(@RequestParam(value = "customerId", required = false) String customerId) {
        List<Map<String, Object>> rows = customerId != null
                ? db.query("SELECT * FROM bills WHERE customer_id = ?", customerId)
                : db.query("SELECT * FROM bills LIMIT 20");
        return ResponseEntity.ok(rows);
    }

    @GetMapping("/billers")
    public ResponseEntity<?> getBillers() {
        return ResponseEntity.ok(List.of(
                Map.of("billerId", "BLR-01", "name", "Electricity Board", "category", "ELECTRICITY"),
                Map.of("billerId", "BLR-02", "name", "Water Supply Board", "category", "WATER"),
                Map.of("billerId", "BLR-03", "name", "Fiber Broadband", "category", "INTERNET")
        ));
    }

    @PostMapping("/billpayments")
    public ResponseEntity<?> payBill(
            @RequestBody Map<String, Object> req,
            @RequestHeader(value = "Idempotency-Key", required = false) String idempotencyKey) {

        String accId = (String) req.get("accountId");
        String billId = (String) req.get("billId");
        long now = System.currentTimeMillis();

        try {
            db.inTransaction(() -> {
                List<Map<String, Object>> accRows = db.query("SELECT balance_cents FROM accounts WHERE account_id = ?", accId);
                if (accRows.isEmpty()) throw new IllegalArgumentException("Account not found: " + accId);

                long amount = 500; // default 500 cents (INR 5.00)
                List<Map<String, Object>> billRows = db.query("SELECT amount_cents, status FROM bills WHERE bill_id = ?", billId);
                if (!billRows.isEmpty()) {
                    amount = ((Number) billRows.get(0).get("amount_cents")).longValue();
                    db.update("UPDATE bills SET status = 'PAID' WHERE bill_id = ?", billId);
                }

                long curBal = ((Number) accRows.get(0).get("balance_cents")).longValue();
                if (curBal < amount) throw new IllegalArgumentException("Insufficient balance for bill payment");

                db.update("UPDATE accounts SET balance_cents = balance_cents - ?, updated_at = ? WHERE account_id = ?", amount, now, accId);
                db.update("INSERT INTO transactions (transaction_id, account_id, type, amount_cents, balance_after_cents, description, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
                        "TX-BILL-" + UUID.randomUUID().toString().substring(0, 8), accId, "DEBIT", amount, curBal - amount, "Bill Payment: " + billId, now);
            });

            return ResponseEntity.ok(Map.of(
                    "billId", billId,
                    "accountId", accId,
                    "status", "PAID",
                    "mode", "baseline-single-db"
            ));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("error", e.getMessage()));
        }
    }

    @GetMapping("/admin/metrics")
    public ResponseEntity<Map<String, Object>> getMetrics() {
        return ResponseEntity.ok(Map.of(
                "service", "baseline-bank-service",
                "status", "UP",
                "sharding", false,
                "rateLimiting", false,
                "cache", false
        ));
    }
}
