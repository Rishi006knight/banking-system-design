import sqlite3

for p in ["./data/bank-shard-0.db", "./data/baseline.db"]:
    conn = sqlite3.connect(p)
    cur = conn.cursor()
    cur.execute("SELECT sql FROM sqlite_master WHERE name IN ('bills', 'bill_payments')")
    print(f"Schema for {p}:")
    for r in cur.fetchall():
        print(" ", r[0])
    cur.execute("SELECT count(*), coalesce(sum(amount_cents), 0) FROM bills WHERE status = 'PAID'")
    print("  Paid bills count & sum:", cur.fetchone())
    conn.close()
