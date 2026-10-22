import sqlite3
import os

base_db = "data/baseline.db"
con_base = sqlite3.connect(base_db)
cur_base = con_base.cursor()

# Clear existing tables in baseline.db
for table in ['notifications', 'transfers', 'transactions', 'bills', 'beneficiaries', 'accounts', 'customers']:
    cur_base.execute(f"DELETE FROM {table}")

total_accs = 0
total_custs = 0
total_bills = 0

for s in [0, 1, 2]:
    shard_db = f"data/bank-shard-{s}.db"
    con_shard = sqlite3.connect(shard_db)
    con_shard.row_factory = sqlite3.Row
    cur_shard = con_shard.cursor()

    # Customers
    cur_shard.execute("SELECT * FROM customers")
    for r in cur_shard.fetchall():
        cur_base.execute(
            "INSERT OR REPLACE INTO customers (customer_id, username, password_hash, email, full_name, created_at) VALUES (?, ?, ?, ?, ?, ?)",
            (r['customer_id'], r['username'], r['password_hash'], r['email'], r['full_name'], r['created_at'])
        )
        total_custs += 1

    # Accounts
    cur_shard.execute("SELECT * FROM accounts")
    for r in cur_shard.fetchall():
        cur_base.execute(
            "INSERT OR REPLACE INTO accounts (account_id, customer_id, account_number, balance_cents, currency, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            (r['account_id'], r['customer_id'], r['account_number'], r['balance_cents'], r['currency'], r['status'], r['created_at'], r['updated_at'])
        )
        total_accs += 1

    # Bills
    cur_shard.execute("SELECT * FROM bills")
    for r in cur_shard.fetchall():
        cur_base.execute(
            "INSERT OR REPLACE INTO bills (bill_id, customer_id, biller_code, biller_name, amount_cents, status, created_at, paid_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            (r['bill_id'], r['customer_id'], r['biller_code'], r['biller_name'], r['amount_cents'], r['status'], r['created_at'], r['paid_at'] if 'paid_at' in r.keys() else None)
        )
        total_bills += 1

    # Beneficiaries
    cur_shard.execute("SELECT * FROM beneficiaries")
    for r in cur_shard.fetchall():
        cur_base.execute(
            "INSERT OR REPLACE INTO beneficiaries (beneficiary_id, customer_id, name, account_number, bank_code, created_at) VALUES (?, ?, ?, ?, ?, ?)",
            (r['beneficiary_id'], r['customer_id'], r['name'], r['account_number'], r['bank_code'], r['created_at'])
        )

    con_shard.close()

con_base.commit()

cur_base.execute("SELECT COUNT(*), SUM(balance_cents) FROM accounts")
acc_stat = cur_base.fetchone()
print(f"Synced baseline.db: Accounts={acc_stat[0]}, Total Balance={acc_stat[1]}")
con_base.close()
