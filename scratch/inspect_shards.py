import sqlite3

total_acc = 0
total_bal = 0
total_tx = 0
total_cust = 0

for i in range(4):
    p = f"./data/bank-shard-{i}.db"
    con = sqlite3.connect(p)
    cur = con.cursor()
    cur.execute("SELECT count(*) FROM accounts")
    acc = cur.fetchone()[0]
    cur.execute("SELECT coalesce(sum(balance_cents), 0) FROM accounts")
    bal = cur.fetchone()[0]
    cur.execute("SELECT count(*) FROM transactions")
    tx = cur.fetchone()[0]
    cur.execute("SELECT count(*) FROM customers")
    cust = cur.fetchone()[0]
    print(f"SHARD-{i}: {cust} customers, {acc} accounts, {tx} transactions, {bal} cents")
    total_acc += acc
    total_bal += bal
    total_tx += tx
    total_cust += cust

print(f"SHARD TOTAL: {total_cust} customers, {total_acc} accounts, {total_tx} transactions, {total_bal} cents")
