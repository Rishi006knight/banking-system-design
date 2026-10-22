import sqlite3

for db in ["./data/bank-shard-0.db", "./data/bank-shard-1.db", "./data/bank-shard-2.db"]:
    conn = sqlite3.connect(db)
    cur = conn.cursor()
    cur.execute("SELECT account_id, balance_cents FROM accounts WHERE account_id = 'ACC-0000065'")
    row = cur.fetchone()
    print(db, "->", row)
