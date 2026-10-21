package com.banking.service.service;

import com.banking.common.kvstore.KeyValueStore;
import com.banking.common.sharding.QueryResult;
import com.banking.common.sharding.Shard;
import com.banking.common.sharding.ShardRouter;
import com.banking.common.snowflake.IdGenerator;
import com.banking.service.dto.AuthRequest;
import com.banking.service.dto.AuthResponse;
import com.banking.service.dto.RegisterRequest;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.util.Map;
import java.util.UUID;

@Service
public class AuthService {

    private final ShardRouter router;
    private final IdGenerator idGenerator;
    private final KeyValueStore<String> kvStore;
    private final PasswordEncoder passwordEncoder;

    @Value("${banking.cache.session-ttl-millis:900000}")
    private long sessionTtlMillis;

    public AuthService(ShardRouter router, IdGenerator idGenerator, KeyValueStore<String> kvStore, PasswordEncoder passwordEncoder) {
        this.router = router;
        this.idGenerator = idGenerator;
        this.kvStore = kvStore;
        this.passwordEncoder = passwordEncoder;
    }

    public AuthResponse register(RegisterRequest req) {
        String customerId = "CUST-" + idGenerator.nextId();
        String accountId = "ACC-" + idGenerator.nextId();
        String accountNumber = "999" + (idGenerator.nextId() % 1_000_000_000L);
        long initialDeposit = (req.initialDepositCents() != null && req.initialDepositCents() > 0)
                ? req.initialDepositCents() : 0L;
        long now = System.currentTimeMillis();

        Shard shard = router.getShard(accountId);
        String passwordHash = passwordEncoder.encode(req.password());

        // Insert customer
        shard.getConnection().executeUpdate(
                "INSERT INTO customers (customer_id, username, password_hash, email, full_name, created_at) " +
                        "VALUES (?, ?, ?, ?, ?, ?)",
                customerId, req.username(), passwordHash, req.email(), req.fullName(), now
        );

        // Insert primary account
        shard.getConnection().executeUpdate(
                "INSERT INTO accounts (account_id, customer_id, account_number, balance_cents, currency, status, created_at, updated_at) " +
                        "VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                accountId, customerId, accountNumber, initialDeposit, "INR", "ACTIVE", now, now
        );

        // Initial deposit transaction if amount > 0
        if (initialDeposit > 0) {
            shard.getConnection().executeUpdate(
                    "INSERT INTO transactions (transaction_id, account_id, type, amount_cents, balance_after_cents, description, created_at) " +
                            "VALUES (?, ?, ?, ?, ?, ?, ?)",
                    "TX-" + idGenerator.nextId(), accountId, "CREDIT", initialDeposit, initialDeposit, "Initial Account Opening Deposit", now
            );
        }

        // Cache customer username -> shard mapping in KV store for quick login routing
        kvStore.put("user_shard:" + req.username(), shard.getShardId(), 86400000); // 24 hours

        // Generate session token
        String token = UUID.randomUUID().toString();
        kvStore.put("session:" + token, customerId + ":" + req.username() + ":" + accountId, sessionTtlMillis);

        return new AuthResponse(token, customerId, req.username(), req.fullName(), accountId, sessionTtlMillis / 1000);
    }

    public AuthResponse login(AuthRequest req) {
        String username = req.username();
        Map<String, Object> customer = null;
        Shard foundShard = null;

        // 1. Try finding cached shard for this user
        String cachedShardId = kvStore.get("user_shard:" + username);
        if (cachedShardId != null) {
            for (Shard s : router.getAllShards()) {
                if (s.getShardId().equals(cachedShardId)) {
                    QueryResult qr = s.getConnection().executeQuery("SELECT * FROM customers WHERE username = ?", username);
                    if (!qr.isEmpty()) {
                        customer = qr.firstRow();
                        foundShard = s;
                        break;
                    }
                }
            }
        }

        // 2. Fallback: Search all shards if not cached
        if (customer == null) {
            for (Shard s : router.getAllShards()) {
                QueryResult qr = s.getConnection().executeQuery("SELECT * FROM customers WHERE username = ?", username);
                if (!qr.isEmpty()) {
                    customer = qr.firstRow();
                    foundShard = s;
                    kvStore.put("user_shard:" + username, s.getShardId(), 86400000);
                    break;
                }
            }
        }

        if (customer == null) {
            throw new IllegalArgumentException("Invalid username or password");
        }

        String storedHash = (String) customer.get("password_hash");
        if (!passwordEncoder.matches(req.password(), storedHash)) {
            throw new IllegalArgumentException("Invalid username or password");
        }

        String customerId = (String) customer.get("customer_id");
        String fullName = (String) customer.get("full_name");

        // Find primary account
        QueryResult accQr = foundShard.getConnection().executeQuery(
                "SELECT account_id FROM accounts WHERE customer_id = ? LIMIT 1", customerId
        );
        String primaryAccountId = accQr.isEmpty() ? null : (String) accQr.firstRow().get("account_id");

        // Generate session token
        String token = UUID.randomUUID().toString();
        kvStore.put("session:" + token, customerId + ":" + username + ":" + primaryAccountId, sessionTtlMillis);

        return new AuthResponse(token, customerId, username, fullName, primaryAccountId, sessionTtlMillis / 1000);
    }

    public void logout(String token) {
        if (token != null && !token.isBlank()) {
            kvStore.remove("session:" + token);
        }
    }

    public String verifySession(String token) {
        if (token == null || token.isBlank()) return null;
        return kvStore.get("session:" + token);
    }
}
