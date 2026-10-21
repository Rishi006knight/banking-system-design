package com.banking.datatools;

import com.banking.common.sharding.QueryResult;
import com.banking.common.sharding.Shard;
import com.banking.common.sharding.ShardRouter;
import com.banking.common.sharding.ShardSchema;
import com.banking.common.snowflake.SnowflakeIdGenerator;

import java.util.*;

/**
 * High-speed generator for synthetic banking data.
 * All accounts and their associated records are partitioned across shards
 * using the Consistent Hashing ShardRouter.
 */
public class SyntheticDataGenerator {

    private final ShardRouter router;
    private final SnowflakeIdGenerator idGenerator;
    private final Random random;

    private static final String[] FIRST_NAMES = {
            "Aarav", "Aditi", "Rohan", "Priya", "Vikram", "Sneha", "Karthik", "Ananya",
            "Rahul", "Pooja", "Arjun", "Divya", "Siddharth", "Meera", "Varun", "Ritu"
    };

    private static final String[] LAST_NAMES = {
            "Sharma", "Verma", "Patel", "Iyer", "Reddy", "Nair", "Gupta", "Menon",
            "Singh", "Chatterjee", "Deshmukh", "Kulkarni", "Bose", "Pillai", "Choudhury"
    };

    private static final String[] BANK_CODES = {"SBIN0001", "HDFC0002", "ICIC0003", "UTIB0004"};
    private static final String[] BILLERS = {
            "TNEB_POWER:Tamil Nadu Electricity Board",
            "BESCOM_ELEC:Bangalore Electricity Supply",
            "JIO_FIBER:Reliance Jio Infocomm",
            "AIRTEL_POST:Airtel Postpaid & Broadband",
            "INDANE_GAS:Indian Oil Indane Gas"
    };

    // BCrypt hash for default password: "Password@123"
    public static final String DEFAULT_PASSWORD_HASH = "$2a$10$wT0lQn2L9K6U3B4gK.qO6eY1W8d0rO5mD6v8yN2zB8xK9pL0mN1q.";

    public SyntheticDataGenerator(ShardRouter router) {
        this(router, new Random(42));
    }

    public SyntheticDataGenerator(ShardRouter router, Random random) {
        this.router = Objects.requireNonNull(router, "router cannot be null");
        this.idGenerator = new SnowflakeIdGenerator(0);
        this.random = random;
    }

    public record GenerationSummary(
            int customersCreated,
            int accountsCreated,
            int transactionsCreated,
            int beneficiariesCreated,
            int billsCreated,
            long totalBalanceCents,
            Map<String, Long> rowsPerShard,
            long durationMillis
    ) {}

    /**
     * Seeds the shards with synthetic customers, accounts, transactions, and bills.
     */
    public GenerationSummary generate(int customerCount, int accountCount, int transactionCount) {
        long startTime = System.currentTimeMillis();

        // 1. Initialize schema on all shards
        for (Shard shard : router.getAllShards()) {
            ShardSchema.initializeSchema(shard.getConnection());
        }

        // 2. Generate customers and their primary accounts
        List<String> accountIds = new ArrayList<>(accountCount);
        long totalBalanceSum = 0;
        int accountsPerCustomer = Math.max(1, accountCount / Math.max(1, customerCount));

        int actualAccounts = 0;
        int actualTransactions = 0;
        int actualBeneficiaries = 0;
        int actualBills = 0;

        for (int i = 1; i <= customerCount; i++) {
            String customerId = "CUST-" + String.format("%06d", i);
            String firstName = FIRST_NAMES[random.nextInt(FIRST_NAMES.length)];
            String lastName = LAST_NAMES[random.nextInt(LAST_NAMES.length)];
            String username = (firstName + "." + lastName + i).toLowerCase();
            String email = username + "@synthetic-bank.com";
            String fullName = firstName + " " + lastName;
            long custCreatedAt = startTime - (86400_000L * (random.nextInt(365) + 30));

            for (int a = 0; a < accountsPerCustomer && actualAccounts < accountCount; a++) {
                actualAccounts++;
                String accountId = "ACC-" + String.format("%07d", actualAccounts);
                accountIds.add(accountId);

                // Initial balance: 5,000 to 500,000 INR (in paise / cents)
                long initialBalance = (random.nextInt(495) + 5) * 100_000L;
                totalBalanceSum += initialBalance;

                // Identify shard by accountId
                Shard shard = router.getShard(accountId);

                // Insert Customer on this shard
                shard.getConnection().executeUpdate(
                        "INSERT OR IGNORE INTO customers (customer_id, username, password_hash, email, full_name, created_at) " +
                                "VALUES (?, ?, ?, ?, ?, ?)",
                        customerId, username, DEFAULT_PASSWORD_HASH, email, fullName, custCreatedAt
                );

                // Insert Account on this shard
                shard.getConnection().executeUpdate(
                        "INSERT OR REPLACE INTO accounts (account_id, customer_id, account_number, balance_cents, currency, status, created_at, updated_at) " +
                                "VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                        accountId, customerId, "999" + String.format("%09d", actualAccounts), initialBalance, "INR", "ACTIVE", custCreatedAt, startTime
                );

                // Add 1-2 Beneficiaries
                int benCount = random.nextInt(2) + 1;
                for (int b = 0; b < benCount; b++) {
                    actualBeneficiaries++;
                    String benId = "BEN-" + idGenerator.nextId();
                    String benName = FIRST_NAMES[random.nextInt(FIRST_NAMES.length)] + " " + LAST_NAMES[random.nextInt(LAST_NAMES.length)];
                    String benAcc = "555" + String.format("%09d", random.nextInt(100_000_000));
                    String bankCode = BANK_CODES[random.nextInt(BANK_CODES.length)];

                    shard.getConnection().executeUpdate(
                            "INSERT INTO beneficiaries (beneficiary_id, customer_id, name, account_number, bank_code, created_at) " +
                                    "VALUES (?, ?, ?, ?, ?, ?)",
                            benId, customerId, benName, benAcc, bankCode, startTime
                    );
                }

                // Add 1-2 Utility Bills
                int billCount = random.nextInt(2) + 1;
                for (int bl = 0; bl < billCount; bl++) {
                    actualBills++;
                    String billId = "BILL-" + String.format("%07d", actualBills);
                    String billerMeta = BILLERS[random.nextInt(BILLERS.length)];
                    String[] parts = billerMeta.split(":");
                    long billAmount = (random.nextInt(40) + 5) * 10_000L; // 500 to 4500 INR

                    shard.getConnection().executeUpdate(
                            "INSERT INTO bills (bill_id, customer_id, biller_code, biller_name, amount_cents, status, created_at) " +
                                    "VALUES (?, ?, ?, ?, ?, ?, ?)",
                            billId, customerId, parts[0], parts[1], billAmount, "UNPAID", startTime
                    );
                }
            }
        }

        // 3. Generate Historical Transactions distributed across accounts
        int txPerAccount = Math.max(1, transactionCount / Math.max(1, actualAccounts));
        for (String accountId : accountIds) {
            Shard shard = router.getShard(accountId);
            QueryResult accQr = shard.getConnection().executeQuery(
                    "SELECT balance_cents FROM accounts WHERE account_id = ?", accountId
            );
            if (accQr.isEmpty()) continue;

            long currentBalance = ((Number) accQr.firstRow().get("balance_cents")).longValue();

            for (int t = 0; t < txPerAccount && actualTransactions < transactionCount; t++) {
                actualTransactions++;
                String txId = "TX-" + idGenerator.nextId();
                boolean isCredit = random.nextBoolean();
                long amount = (random.nextInt(50) + 1) * 10_000L; // 100 to 5000 INR

                if (isCredit) {
                    currentBalance += amount;
                    shard.getConnection().executeUpdate(
                            "INSERT INTO transactions (transaction_id, account_id, type, amount_cents, balance_after_cents, description, created_at) " +
                                    "VALUES (?, ?, ?, ?, ?, ?, ?)",
                            txId, accountId, "CREDIT", amount, currentBalance, "Salary / NEFT Credit", startTime - (t * 3600_000L)
                    );
                } else {
                    if (currentBalance > amount) {
                        currentBalance -= amount;
                        shard.getConnection().executeUpdate(
                                "INSERT INTO transactions (transaction_id, account_id, type, amount_cents, balance_after_cents, description, created_at) " +
                                        "VALUES (?, ?, ?, ?, ?, ?, ?)",
                                txId, accountId, "DEBIT", amount, currentBalance, "POS / ATM Withdrawal", startTime - (t * 3600_000L)
                        );
                    }
                }
            }

            // Update account balance to reflect transactions
            shard.getConnection().executeUpdate(
                    "UPDATE accounts SET balance_cents = ? WHERE account_id = ?", currentBalance, accountId
            );
        }

        // 4. Compute verified row counts per shard
        Map<String, Long> rowsPerShard = new LinkedHashMap<>();
        for (Shard shard : router.getAllShards()) {
            QueryResult qr = shard.getConnection().executeQuery(
                    "SELECT (SELECT COUNT(*) FROM customers) + " +
                            "(SELECT COUNT(*) FROM accounts) + " +
                            "(SELECT COUNT(*) FROM transactions) + " +
                            "(SELECT COUNT(*) FROM beneficiaries) + " +
                            "(SELECT COUNT(*) FROM bills) as total_rows"
            );
            long rows = qr.isEmpty() ? 0 : ((Number) qr.firstRow().get("total_rows")).longValue();
            rowsPerShard.put(shard.getShardId(), rows);
        }

        long duration = System.currentTimeMillis() - startTime;
        return new GenerationSummary(
                customerCount, actualAccounts, actualTransactions, actualBeneficiaries, actualBills,
                totalBalanceSum, rowsPerShard, duration
        );
    }
}
