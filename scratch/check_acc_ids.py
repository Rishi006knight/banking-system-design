import sqlite3

for db in ["./data/bank-shard-0.db", "./data/bank-shard-1.db", "./data/bank-shard-2.db", "./data/baseline.db"]:
    conn = sqlite3.connect(db)
    cur = conn.cursor()
    cur.execute("SELECT account_id FROM accounts LIMIT 5")
    print(db, "->", [r[0] for r in cur.fetchall()])
    cur.execute("SELECT count(*) FROM accounts")
    print(db, "total accounts:", cur.fetchone()[0])
