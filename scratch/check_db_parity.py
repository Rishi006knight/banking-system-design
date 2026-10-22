import sqlite3

def get_accounts(db_path):
    conn = sqlite3.connect(db_path)
    cur = conn.cursor()
    cur.execute("SELECT account_number, balance_cents FROM accounts")
    res = {row[0]: row[1] for row in cur.fetchall()}
    conn.close()
    return res

s0 = get_accounts("data/bank-shard-0.db")
s1 = get_accounts("data/bank-shard-1.db")
s2 = get_accounts("data/bank-shard-2.db")
base = get_accounts("data/baseline.db")

total_shards = {}
total_shards.update(s0)
total_shards.update(s1)
total_shards.update(s2)

print(f"Shard 0: {len(s0)}, Shard 1: {len(s1)}, Shard 2: {len(s2)}, Total Shards: {len(total_shards)}")
print(f"Baseline accounts: {len(base)}")
print(f"Sets match: {set(total_shards.keys()) == set(base.keys())}")
print(f"Balances match: {total_shards == base}")
