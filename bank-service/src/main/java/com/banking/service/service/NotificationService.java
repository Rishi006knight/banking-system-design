package com.banking.service.service;

import com.banking.common.sharding.QueryResult;
import com.banking.common.sharding.Shard;
import com.banking.common.sharding.ShardRouter;
import com.banking.service.dto.NotificationDto;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@Service
public class NotificationService {

    private final ShardRouter router;

    public NotificationService(ShardRouter router) {
        this.router = router;
    }

    public List<NotificationDto> getNotifications(String customerId) {
        List<NotificationDto> list = new ArrayList<>();
        for (Shard shard : router.getAllShards()) {
            QueryResult qr = shard.getConnection().executeQuery(
                    "SELECT * FROM notifications WHERE customer_id = ? ORDER BY created_at DESC LIMIT 50", customerId
            );
            for (Map<String, Object> row : qr.getRows()) {
                list.add(new NotificationDto(
                        (String) row.get("notification_id"),
                        (String) row.get("customer_id"),
                        (String) row.get("message"),
                        ((Number) row.get("read")).intValue() == 1,
                        ((Number) row.get("created_at")).longValue()
                ));
            }
            if (!list.isEmpty()) break;
        }
        return list;
    }
}
