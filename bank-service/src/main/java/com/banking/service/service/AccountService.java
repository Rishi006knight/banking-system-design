package com.banking.service.service;

import com.banking.common.kvstore.KeyValueStore;
import com.banking.common.sharding.QueryResult;
import com.banking.common.sharding.Shard;
import com.banking.common.sharding.ShardRouter;
import com.banking.service.dto.AccountDto;
import com.banking.service.dto.BalanceDto;
import com.banking.service.dto.TransactionDto;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@Service
public class AccountService {

    private final ShardRouter router;
    private final KeyValueStore<String> kvStore;

    @Value("${banking.cache.balance-ttl-millis:60000}")
    private long balanceTtlMillis;

    public AccountService(ShardRouter router, KeyValueStore<String> kvStore) {
        this.router = router;
        this.kvStore = kvStore;
    }

    public AccountDto getAccount(String accountId) {
        Shard shard = router.getShard(accountId);
        QueryResult qr = shard.getConnection().executeQuery(
                "SELECT * FROM accounts WHERE account_id = ?", accountId
        );
        if (qr.isEmpty()) {
            throw new IllegalArgumentException("Account not found: " + accountId);
        }
        Map<String, Object> row = qr.firstRow();
        long balanceCents = ((Number) row.get("balance_cents")).longValue();

        return new AccountDto(
                accountId,
                (String) row.get("customer_id"),
                (String) row.get("account_number"),
                balanceCents,
                balanceCents / 100.0,
                (String) row.get("currency"),
                (String) row.get("status"),
                shard.getShardId()
        );
    }

    public BalanceDto getBalance(String accountId) {
        Shard shard = router.getShard(accountId);
        String cacheKey = "balance:" + accountId;

        // 1. Check Key-Value Cache first
        String cachedBalance = kvStore.get(cacheKey);
        if (cachedBalance != null) {
            long cents = Long.parseLong(cachedBalance);
            return new BalanceDto(accountId, cents, cents / 100.0, "INR", true, shard.getShardId());
        }

        // 2. Query Shard on cache miss
        QueryResult qr = shard.getConnection().executeQuery(
                "SELECT balance_cents, currency FROM accounts WHERE account_id = ?", accountId
        );
        if (qr.isEmpty()) {
            throw new IllegalArgumentException("Account not found: " + accountId);
        }

        long cents = ((Number) qr.firstRow().get("balance_cents")).longValue();
        String currency = (String) qr.firstRow().get("currency");

        // 3. Populate KV Cache
        kvStore.put(cacheKey, String.valueOf(cents), balanceTtlMillis);

        return new BalanceDto(accountId, cents, cents / 100.0, currency, false, shard.getShardId());
    }

    public List<TransactionDto> getTransactions(String accountId, int page, int size) {
        Shard shard = router.getShard(accountId);
        int offset = Math.max(0, page) * Math.max(1, size);

        QueryResult qr = shard.getConnection().executeQuery(
                "SELECT * FROM transactions WHERE account_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?",
                accountId, size, offset
        );

        List<TransactionDto> list = new ArrayList<>();
        for (Map<String, Object> row : qr.getRows()) {
            long amt = ((Number) row.get("amount_cents")).longValue();
            long bal = ((Number) row.get("balance_after_cents")).longValue();
            list.add(new TransactionDto(
                    (String) row.get("transaction_id"),
                    (String) row.get("account_id"),
                    (String) row.get("type"),
                    amt,
                    amt / 100.0,
                    bal,
                    bal / 100.0,
                    (String) row.get("description"),
                    (String) row.get("idempotency_key"),
                    ((Number) row.get("created_at")).longValue()
            ));
        }
        return list;
    }
}
