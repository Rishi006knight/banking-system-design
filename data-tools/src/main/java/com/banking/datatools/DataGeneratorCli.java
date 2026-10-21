package com.banking.datatools;

import com.banking.common.sharding.LocalSqliteShardConnection;
import com.banking.common.sharding.Shard;
import com.banking.common.sharding.ShardRouter;

import java.io.File;

/**
 * Command-line interface for seeding database shards with synthetic data.
 */
public class DataGeneratorCli {

    public static void main(String[] args) {
        int shardCount = 3;
        String dataDir = "./data";
        int customers = 1000;
        int accounts = 2000;
        int transactions = 10000;

        for (int i = 0; i < args.length; i++) {
            if ("--shards".equals(args[i]) && i + 1 < args.length) {
                shardCount = Integer.parseInt(args[++i]);
            } else if ("--data-dir".equals(args[i]) && i + 1 < args.length) {
                dataDir = args[++i];
            } else if ("--customers".equals(args[i]) && i + 1 < args.length) {
                customers = Integer.parseInt(args[++i]);
            } else if ("--accounts".equals(args[i]) && i + 1 < args.length) {
                accounts = Integer.parseInt(args[++i]);
            } else if ("--transactions".equals(args[i]) && i + 1 < args.length) {
                transactions = Integer.parseInt(args[++i]);
            }
        }

        File dir = new File(dataDir);
        if (!dir.exists()) {
            dir.mkdirs();
        }

        System.out.println("==================================================================");
        System.out.println("SYNTHETIC BANKING DATA GENERATOR (PHASE 2)");
        System.out.printf("Shards: %d | Data Directory: %s%n", shardCount, dir.getAbsolutePath());
        System.out.printf("Target: Customers=%d, Accounts=%d, Transactions=%d%n", customers, accounts, transactions);
        System.out.println("==================================================================");

        ShardRouter router = new ShardRouter(150);
        for (int s = 0; s < shardCount; s++) {
            String shardId = "bank-shard-" + s;
            String dbPath = new File(dir, shardId + ".db").getAbsolutePath();
            LocalSqliteShardConnection conn = new LocalSqliteShardConnection("jdbc:sqlite:" + dbPath);
            router.addShard(new Shard(shardId, "Shard " + s, conn));
        }

        SyntheticDataGenerator generator = new SyntheticDataGenerator(router);
        SyntheticDataGenerator.GenerationSummary summary = generator.generate(customers, accounts, transactions);

        System.out.println("\nSEEDING COMPLETED SUCCESSFULLY!");
        System.out.printf("Duration:              %d ms%n", summary.durationMillis());
        System.out.printf("Customers Created:     %d%n", summary.customersCreated());
        System.out.printf("Accounts Created:      %d%n", summary.accountsCreated());
        System.out.printf("Transactions Created:  %d%n", summary.transactionsCreated());
        System.out.printf("Beneficiaries Created: %d%n", summary.beneficiariesCreated());
        System.out.printf("Utility Bills Created: %d%n", summary.billsCreated());
        System.out.printf("Total Initial Balance: %d paise (%,.2f INR)%n", summary.totalBalanceCents(), summary.totalBalanceCents() / 100.0);
        System.out.println("\nROW DISTRIBUTION PER SHARD:");
        summary.rowsPerShard().forEach((shard, rows) -> System.out.printf("  %s: %,d rows%n", shard, rows));
        System.out.println("==================================================================");

        // Close connections
        for (Shard s : router.getAllShards()) {
            s.getConnection().close();
        }
    }
}
