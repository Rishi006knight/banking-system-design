package com.banking.service.service;

import com.banking.common.kvstore.KeyValueStore;
import com.banking.common.sharding.QueryResult;
import com.banking.common.sharding.Shard;
import com.banking.common.sharding.ShardRouter;
import com.banking.common.snowflake.IdGenerator;
import com.banking.service.dto.BeneficiaryDto;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@Service
public class BeneficiaryService {

    private final ShardRouter router;
    private final IdGenerator idGenerator;
    private final KeyValueStore<String> kvStore;
    private final ObjectMapper mapper = new ObjectMapper();

    public BeneficiaryService(ShardRouter router, IdGenerator idGenerator, KeyValueStore<String> kvStore) {
        this.router = router;
        this.idGenerator = idGenerator;
        this.kvStore = kvStore;
    }

    public List<BeneficiaryDto> getBeneficiaries(String customerId) {
        String cacheKey = "beneficiaries:" + customerId;
        String cachedJson = kvStore.get(cacheKey);
        if (cachedJson != null) {
            try {
                return mapper.readValue(cachedJson, new TypeReference<>() {});
            } catch (Exception ignored) {}
        }

        List<BeneficiaryDto> list = new ArrayList<>();
        for (Shard shard : router.getAllShards()) {
            QueryResult qr = shard.getConnection().executeQuery(
                    "SELECT * FROM beneficiaries WHERE customer_id = ? ORDER BY created_at DESC", customerId
            );
            for (Map<String, Object> row : qr.getRows()) {
                list.add(new BeneficiaryDto(
                        (String) row.get("beneficiary_id"),
                        (String) row.get("customer_id"),
                        (String) row.get("name"),
                        (String) row.get("account_number"),
                        (String) row.get("bank_code")
                ));
            }
            if (!list.isEmpty()) break;
        }

        try {
            kvStore.put(cacheKey, mapper.writeValueAsString(list), 300000); // 5 min TTL
        } catch (Exception ignored) {}

        return list;
    }

    public BeneficiaryDto addBeneficiary(String customerId, BeneficiaryDto dto) {
        String beneficiaryId = "BEN-" + idGenerator.nextId();
        long now = System.currentTimeMillis();

        // Find customer's shard
        Shard targetShard = null;
        for (Shard shard : router.getAllShards()) {
            QueryResult qr = shard.getConnection().executeQuery(
                    "SELECT customer_id FROM customers WHERE customer_id = ?", customerId
            );
            if (!qr.isEmpty()) {
                targetShard = shard;
                break;
            }
        }

        if (targetShard == null) {
            targetShard = router.getAllShards().iterator().next();
        }

        targetShard.getConnection().executeUpdate(
                "INSERT INTO beneficiaries (beneficiary_id, customer_id, name, account_number, bank_code, created_at) " +
                        "VALUES (?, ?, ?, ?, ?, ?)",
                beneficiaryId, customerId, dto.name(), dto.accountNumber(), dto.bankCode(), now
        );

        // Invalidate beneficiary lookup cache
        kvStore.remove("beneficiaries:" + customerId);

        return new BeneficiaryDto(beneficiaryId, customerId, dto.name(), dto.accountNumber(), dto.bankCode());
    }
}
