import sqlite3

for i in range(3):
    cs = sqlite3.connect(f"data/bank-shard-{i}.db")
    non_clean = cs.execute("SELECT account_id FROM accounts WHERE account_id NOT LIKE 'ACC-00%'").fetchall()
    for row in non_clean:
        aid = row[0]
        cs.execute("DELETE FROM transactions WHERE account_id = ?", (aid,))
        cs.execute("DELETE FROM accounts WHERE account_id = ?", (aid,))
    cs.commit()
    cnt = cs.execute("SELECT count(*) FROM accounts").fetchone()[0]
    print(f"Shard {i} clean accounts: {cnt}")
    cs.close()

c = sqlite3.connect("data/baseline.db")
bcnt = c.execute("SELECT count(*) FROM accounts").fetchone()[0]
print(f"Baseline clean accounts: {bcnt}")
c.close()
