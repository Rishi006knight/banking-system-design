import urllib.request
import json
import time

url = 'https://banking-rishi006knight.aws-ap-south-1.turso.io/v2/pipeline'
token = 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3OTI3MjA2MzgsImlkIjoiMDFhMTVlNzctNjMwMS03NTY2LWEyZDktNzgyZDZhOTdlZDQyIiwia2lkIjoiUk1JODM3Y1dFWmVtbEEtRjc0S3VPOW92Mm1kcXFHZS1GRnl2dFNwcWdHWSIsInJpZCI6IjkzNTJkMzNhLTBiMjItNGJlOC04M2M5LWU5NzYzYTBkOGQ3MCJ9.uBibRlXWXLPEX8F_3aUfqydeGQf6prI4kl6i_SEldFe8igPgNysfh9Tyt5XvMW_vdPHL0GYaM-_uydkZ0XYaAQ'

ddl_statements = [
    """CREATE TABLE IF NOT EXISTS customers (
        customer_id TEXT PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        email TEXT NOT NULL,
        full_name TEXT NOT NULL,
        created_at INTEGER NOT NULL
    );""",
    """CREATE TABLE IF NOT EXISTS accounts (
        account_id TEXT PRIMARY KEY,
        customer_id TEXT NOT NULL,
        account_number TEXT UNIQUE NOT NULL,
        balance_cents INTEGER NOT NULL DEFAULT 0,
        currency TEXT NOT NULL DEFAULT 'INR',
        status TEXT NOT NULL DEFAULT 'ACTIVE',
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        FOREIGN KEY (customer_id) REFERENCES customers(customer_id)
    );""",
    """CREATE TABLE IF NOT EXISTS transactions (
        transaction_id TEXT PRIMARY KEY,
        account_id TEXT NOT NULL,
        type TEXT NOT NULL,
        amount_cents INTEGER NOT NULL,
        balance_after_cents INTEGER NOT NULL,
        description TEXT,
        idempotency_key TEXT,
        created_at INTEGER NOT NULL,
        FOREIGN KEY (account_id) REFERENCES accounts(account_id)
    );""",
    """CREATE TABLE IF NOT EXISTS transfers (
        transfer_id TEXT PRIMARY KEY,
        source_account_id TEXT NOT NULL,
        dest_account_id TEXT NOT NULL,
        amount_cents INTEGER NOT NULL,
        status TEXT NOT NULL,
        idempotency_key TEXT UNIQUE,
        error_message TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
    );""",
    """CREATE TABLE IF NOT EXISTS beneficiaries (
        beneficiary_id TEXT PRIMARY KEY,
        customer_id TEXT NOT NULL,
        name TEXT NOT NULL,
        account_number TEXT NOT NULL,
        bank_code TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        FOREIGN KEY (customer_id) REFERENCES customers(customer_id)
    );""",
    """CREATE TABLE IF NOT EXISTS bills (
        bill_id TEXT PRIMARY KEY,
        customer_id TEXT NOT NULL,
        biller_code TEXT NOT NULL,
        biller_name TEXT NOT NULL,
        amount_cents INTEGER NOT NULL,
        status TEXT NOT NULL DEFAULT 'UNPAID',
        paid_at INTEGER,
        created_at INTEGER NOT NULL
    );""",
    """CREATE TABLE IF NOT EXISTS notifications (
        notification_id TEXT PRIMARY KEY,
        customer_id TEXT NOT NULL,
        message TEXT NOT NULL,
        read INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL
    );"""
]

def execute_pipeline(requests):
    req_body = {
        'requests': requests + [{'type': 'close'}]
    }
    req = urllib.request.Request(url, data=json.dumps(req_body).encode('utf-8'), headers={
        'Authorization': f'Bearer {token}',
        'Content-Type': 'application/json'
    })
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read().decode('utf-8'))

# 1. Execute DDL
print("Initializing tables in Turso database...")
requests = [{'type': 'execute', 'stmt': {'sql': sql, 'want_ret': False}} for sql in ddl_statements]
res = execute_pipeline(requests)
print("DDL response results count:", len(res.get('results', [])))

# 2. Seed basic demo accounts
now = int(time.time() * 1000)
seed_stmts = [
    "INSERT OR IGNORE INTO customers (customer_id, username, password_hash, email, full_name, created_at) VALUES ('1', 'aarav.sharma', 'Password@123', 'aarav@erodesss.com', 'Aarav Sharma', " + str(now) + ");",
    "INSERT OR IGNORE INTO accounts (account_id, customer_id, account_number, balance_cents, currency, status, created_at, updated_at) VALUES ('ACC-0000001', '1', '1000000001', 2542050, 'INR', 'ACTIVE', " + str(now) + ", " + str(now) + ");",
    "INSERT OR IGNORE INTO customers (customer_id, username, password_hash, email, full_name, created_at) VALUES ('2', 'diya.patel', 'Password@123', 'diya@erodesss.com', 'Diya Patel', " + str(now) + ");",
    "INSERT OR IGNORE INTO accounts (account_id, customer_id, account_number, balance_cents, currency, status, created_at, updated_at) VALUES ('ACC-0000002', '2', '1000000002', 1875000, 'INR', 'ACTIVE', " + str(now) + ", " + str(now) + ");",
    "INSERT OR IGNORE INTO customers (customer_id, username, password_hash, email, full_name, created_at) VALUES ('3', 'kavya.nair', 'Password@123', 'kavya@erodesss.com', 'Kavya Nair', " + str(now) + ");",
    "INSERT OR IGNORE INTO accounts (account_id, customer_id, account_number, balance_cents, currency, status, created_at, updated_at) VALUES ('ACC-0000004', '3', '1000000004', 3210000, 'INR', 'ACTIVE', " + str(now) + ", " + str(now) + ");"
]

print("Seeding demo accounts into Turso...")
seed_requests = [{'type': 'execute', 'stmt': {'sql': sql, 'want_ret': False}} for sql in seed_stmts]
execute_pipeline(seed_requests)

# 3. Verify tables
verify_req = [{'type': 'execute', 'stmt': {'sql': "SELECT name FROM sqlite_master WHERE type='table';", 'want_ret': True}}]
v_res = execute_pipeline(verify_req)
tables = [row[0]['value'] for row in v_res['results'][0]['response']['result']['rows']]
print("Tables in Turso:", tables)

# 4. Verify accounts
acc_req = [{'type': 'execute', 'stmt': {'sql': "SELECT account_id, balance_cents FROM accounts;", 'want_ret': True}}]
a_res = execute_pipeline(acc_req)
accounts = [(row[0]['value'], row[1]['value']) for row in a_res['results'][0]['response']['result']['rows']]
print("Accounts in Turso:", accounts)
