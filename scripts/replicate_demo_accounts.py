import sqlite3
import time

BCRYPT_HASH = "$2a$10$lfAwpx4cfwAmdvRoHbI.O.8s1u1KQ0IE/IF3VCYGl2Mjw6eQDf0Xe"
NOW = int(time.time() * 1000)

DEMO_USERS = [
    {
        "customer_id": "CUST-0000001",
        "username": "aarav.sharma1",
        "full_name": "Aarav Sharma",
        "email": "aarav.sharma1@erodesbank.com",
        "account_id": "ACC-0000001",
        "account_number": "1000000001",
        "balance_cents": 5000000, # ₹ 50,000.00
    },
    {
        "customer_id": "CUST-0000002",
        "username": "diya.patel2",
        "full_name": "Diya Patel",
        "email": "diya.patel2@erodesbank.com",
        "account_id": "ACC-0000002",
        "account_number": "1000000002",
        "balance_cents": 5000000, # ₹ 50,000.00
    },
    {
        "customer_id": "CUST-0000004",
        "username": "kavya.nair4",
        "full_name": "Kavya Nair",
        "email": "kavya.nair4@erodesbank.com",
        "account_id": "ACC-0000004",
        "account_number": "1000000004",
        "balance_cents": 5000000, # ₹ 50,000.00
    }
]

# Insert into ALL 3 active shards AND all golden backups AND baseline
all_dbs = [
    "data/bank-shard-0.db", "data/bank-shard-1.db", "data/bank-shard-2.db",
    "data/golden_bank-shard-0.db", "data/golden_bank-shard-1.db", "data/golden_bank-shard-2.db",
    "data/baseline.db", "data/golden_baseline.db"
]

for db_path in all_dbs:
    conn = sqlite3.connect(db_path)
    cur = conn.cursor()
    for u in DEMO_USERS:
        # 1. Customer
        cur.execute("DELETE FROM customers WHERE customer_id = ? OR username = ?", (u["customer_id"], u["username"]))
        cur.execute("""
            INSERT INTO customers (customer_id, username, password_hash, email, full_name, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
        """, (u["customer_id"], u["username"], BCRYPT_HASH, u["email"], u["full_name"], NOW))
        
        # 2. Account
        cur.execute("DELETE FROM accounts WHERE account_id = ? OR account_number = ?", (u["account_id"], u["account_number"]))
        cur.execute("""
            INSERT INTO accounts (account_id, customer_id, account_number, balance_cents, currency, status, created_at, updated_at)
            VALUES (?, ?, ?, ?, 'INR', 'ACTIVE', ?, ?)
        """, (u["account_id"], u["customer_id"], u["account_number"], u["balance_cents"], NOW, NOW))
        
        # 3. Initial deposit transaction
        cur.execute("DELETE FROM transactions WHERE account_id = ?", (u["account_id"],))
        cur.execute("""
            INSERT INTO transactions (transaction_id, account_id, type, amount_cents, balance_after_cents, description, idempotency_key, created_at)
            VALUES (?, ?, 'CREDIT', ?, ?, 'Initial Account Opening Balance', 'INIT-DEP', ?)
        """, ("TX-" + u["account_id"] + "-INIT", u["account_id"], u["balance_cents"], u["balance_cents"], NOW))
        
        # 4. Beneficiaries
        cur.execute("DELETE FROM beneficiaries WHERE customer_id = ?", (u["customer_id"],))
        cur.execute("""
            INSERT INTO beneficiaries (beneficiary_id, customer_id, name, account_number, bank_code, created_at)
            VALUES ('BEN-001-' || ?, ?, 'Diya Patel (ACC-0000002)', '1000000002', 'ESSS0001', ?)
        """, (u["customer_id"], u["customer_id"], NOW))
        cur.execute("""
            INSERT INTO beneficiaries (beneficiary_id, customer_id, name, account_number, bank_code, created_at)
            VALUES ('BEN-002-' || ?, ?, 'Kavya Nair (ACC-0000004)', '1000000004', 'ESSS0001', ?)
        """, (u["customer_id"], u["customer_id"], NOW))
        
        # 5. Pending Bills
        cur.execute("DELETE FROM bills WHERE customer_id = ?", (u["customer_id"],))
        cur.execute("""
            INSERT INTO bills (bill_id, customer_id, biller_code, biller_name, amount_cents, status, paid_at, created_at)
            VALUES ('BILL-EB-' || ?, ?, 'TNEB_POWER', 'Tamil Nadu Electricity Board (TNEB)', 185000, 'UNPAID', NULL, ?)
        """, (u["customer_id"], u["customer_id"], NOW))
        cur.execute("""
            INSERT INTO bills (bill_id, customer_id, biller_code, biller_name, amount_cents, status, paid_at, created_at)
            VALUES ('BILL-WTR-' || ?, ?, 'ERODE_CORP_WATER', 'Erode Municipal Corporation Water Supply', 45000, 'UNPAID', NULL, ?)
        """, (u["customer_id"], u["customer_id"], NOW))
        cur.execute("""
            INSERT INTO bills (bill_id, customer_id, biller_code, biller_name, amount_cents, status, paid_at, created_at)
            VALUES ('BILL-FIBER-' || ?, ?, 'JIO_FIBER_CORP', 'High-Speed Commercial Optical Fiber Internet', 99900, 'UNPAID', NULL, ?)
        """, (u["customer_id"], u["customer_id"], NOW))
        
    conn.commit()
    conn.close()

print("All demo users, accounts, beneficiaries, and bills replicated across ALL shards!")
