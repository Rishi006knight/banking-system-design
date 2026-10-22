import sqlite3
import os

for db_path in ['data/bank-shard-0.db', 'data/bank-shard-1.db', 'data/bank-shard-2.db', 'data/baseline.db']:
    if not os.path.exists(db_path):
        print(f"Missing {db_path}")
        continue
    con = sqlite3.connect(db_path)
    cur = con.cursor()
    cur.execute('SELECT COUNT(*), SUM(balance_cents) FROM accounts')
    row = cur.fetchone()
    print(db_path, 'Accounts:', row[0], 'Total Balance:', row[1])
    cur.execute('SELECT COUNT(*), SUM(amount_cents) FROM bills WHERE status = "PAID"')
    paid_bills = cur.fetchone()
    print(db_path, 'Paid Bills:', paid_bills)
    cur.execute('SELECT COUNT(*) FROM transactions')
    txs = cur.fetchone()[0]
    print(db_path, 'Transactions:', txs)
    con.close()
