import sqlite3
import os

for db in ['data/bank-shard-0.db', 'data/bank-shard-1.db', 'data/bank-shard-2.db', 'data/baseline.db']:
    if not os.path.exists(db):
        print(f"{db} does not exist")
        continue
    con = sqlite3.connect(db)
    cur = con.cursor()
    cur.execute('SELECT status, COUNT(*), SUM(amount_cents) FROM bills GROUP BY status')
    rows = cur.fetchall()
    print(db, "Bills:", rows)
    cur.execute('SELECT COUNT(*), SUM(balance_cents) FROM accounts')
    acc_rows = cur.fetchall()
    print(db, "Accounts:", acc_rows)
    con.close()
