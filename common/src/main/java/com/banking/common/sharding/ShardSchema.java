package com.banking.common.sharding;

import java.util.List;

/**
 * Standard SQL DDL schema definitions for each shard.
 */
public final class ShardSchema {

    private ShardSchema() {}

    public static final String CREATE_CUSTOMERS_TABLE = """
        CREATE TABLE IF NOT EXISTS customers (
            customer_id TEXT PRIMARY KEY,
            username TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            email TEXT NOT NULL,
            full_name TEXT NOT NULL,
            created_at INTEGER NOT NULL
        );
        """;

    public static final String CREATE_ACCOUNTS_TABLE = """
        CREATE TABLE IF NOT EXISTS accounts (
            account_id TEXT PRIMARY KEY,
            customer_id TEXT NOT NULL,
            account_number TEXT UNIQUE NOT NULL,
            balance_cents INTEGER NOT NULL DEFAULT 0,
            currency TEXT NOT NULL DEFAULT 'INR',
            status TEXT NOT NULL DEFAULT 'ACTIVE',
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL,
            FOREIGN KEY (customer_id) REFERENCES customers(customer_id)
        );
        """;

    public static final String CREATE_TRANSACTIONS_TABLE = """
        CREATE TABLE IF NOT EXISTS transactions (
            transaction_id TEXT PRIMARY KEY,
            account_id TEXT NOT NULL,
            type TEXT NOT NULL, -- DEBIT, CREDIT, TRANSFER_IN, TRANSFER_OUT, BILL_PAY
            amount_cents INTEGER NOT NULL,
            balance_after_cents INTEGER NOT NULL,
            description TEXT,
            idempotency_key TEXT,
            created_at INTEGER NOT NULL,
            FOREIGN KEY (account_id) REFERENCES accounts(account_id)
        );
        """;

    public static final String CREATE_TRANSFERS_TABLE = """
        CREATE TABLE IF NOT EXISTS transfers (
            transfer_id TEXT PRIMARY KEY,
            source_account_id TEXT NOT NULL,
            dest_account_id TEXT NOT NULL,
            amount_cents INTEGER NOT NULL,
            status TEXT NOT NULL, -- PENDING, COMPLETED, FAILED, COMPENSATED
            idempotency_key TEXT UNIQUE,
            error_message TEXT,
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL
        );
        """;

    public static final String CREATE_BENEFICIARIES_TABLE = """
        CREATE TABLE IF NOT EXISTS beneficiaries (
            beneficiary_id TEXT PRIMARY KEY,
            customer_id TEXT NOT NULL,
            name TEXT NOT NULL,
            account_number TEXT NOT NULL,
            bank_code TEXT NOT NULL,
            created_at INTEGER NOT NULL,
            FOREIGN KEY (customer_id) REFERENCES customers(customer_id)
        );
        """;

    public static final String CREATE_BILLS_TABLE = """
        CREATE TABLE IF NOT EXISTS bills (
            bill_id TEXT PRIMARY KEY,
            customer_id TEXT NOT NULL,
            biller_code TEXT NOT NULL,
            biller_name TEXT NOT NULL,
            amount_cents INTEGER NOT NULL,
            status TEXT NOT NULL DEFAULT 'UNPAID', -- UNPAID, PAID
            paid_at INTEGER,
            created_at INTEGER NOT NULL
        );
        """;

    public static final String CREATE_NOTIFICATIONS_TABLE = """
        CREATE TABLE IF NOT EXISTS notifications (
            notification_id TEXT PRIMARY KEY,
            customer_id TEXT NOT NULL,
            message TEXT NOT NULL,
            read INTEGER NOT NULL DEFAULT 0,
            created_at INTEGER NOT NULL
        );
        """;

    public static final List<String> ALL_DDL_STATEMENTS = List.of(
            CREATE_CUSTOMERS_TABLE,
            CREATE_ACCOUNTS_TABLE,
            CREATE_TRANSACTIONS_TABLE,
            CREATE_TRANSFERS_TABLE,
            CREATE_BENEFICIARIES_TABLE,
            CREATE_BILLS_TABLE,
            CREATE_NOTIFICATIONS_TABLE
    );

    public static void initializeSchema(ShardConnection connection) {
        connection.executeBatch(ALL_DDL_STATEMENTS);
    }
}
