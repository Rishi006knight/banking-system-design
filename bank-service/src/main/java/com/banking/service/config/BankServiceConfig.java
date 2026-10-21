package com.banking.service.config;

import com.banking.common.kvstore.InMemoryTtlKeyValueStore;
import com.banking.common.kvstore.KeyValueStore;
import com.banking.common.ratelimit.RateLimiter;
import com.banking.common.ratelimit.TokenBucketRateLimiter;
import com.banking.common.sharding.*;
import com.banking.common.snowflake.IdGenerator;
import com.banking.common.snowflake.SnowflakeIdGenerator;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.io.File;

@Configuration
public class BankServiceConfig {

    @Value("${banking.node-id:1}")
    private long nodeId;

    @Value("${banking.data-dir:./data}")
    private String dataDir;

    @Value("${banking.shards.count:3}")
    private int shardCount;

    @Value("${banking.shards.virtual-nodes:150}")
    private int virtualNodes;

    @Value("${banking.shards.url:}")
    private String tursoUrl;

    @Value("${banking.shards.auth-token:}")
    private String tursoAuthToken;

    @Value("${banking.cache.max-capacity:50000}")
    private int cacheCapacity;

    @Bean
    public ShardRouter shardRouter() {
        ShardRouter router = new ShardRouter(virtualNodes);

        if (tursoUrl != null && !tursoUrl.isBlank()) {
            // Cloud Turso / Remote libSQL endpoint
            for (int i = 0; i < shardCount; i++) {
                String shardId = "bank-shard-" + i;
                LibSqlHttpShardConnection conn = new LibSqlHttpShardConnection(tursoUrl, tursoAuthToken);
                router.addShard(new Shard(shardId, "Turso Shard " + i, conn));
            }
        } else {
            // Local SQLite / sqld file-based shards
            File dir = new File(dataDir);
            if (!dir.exists() && new File("..", dataDir).exists()) {
                dir = new File("..", dataDir);
            }
            if (!dir.exists()) {
                dir.mkdirs();
            }
            for (int i = 0; i < shardCount; i++) {
                String shardId = "bank-shard-" + i;
                String dbFile = new File(dir, shardId + ".db").getAbsolutePath();
                LocalSqliteShardConnection conn = new LocalSqliteShardConnection("jdbc:sqlite:" + dbFile);
                ShardSchema.initializeSchema(conn);
                router.addShard(new Shard(shardId, "Local Shard " + i, conn));
            }
        }

        return router;
    }

    @Bean
    public IdGenerator idGenerator() {
        return new SnowflakeIdGenerator(nodeId);
    }

    @Bean
    public KeyValueStore<String> keyValueStore() {
        return new InMemoryTtlKeyValueStore<>(cacheCapacity, 1000);
    }

    @Bean
    public RateLimiter rateLimiter() {
        return new TokenBucketRateLimiter();
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }
}
