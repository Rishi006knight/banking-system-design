import sqlite3

shards_accs = set()
for s in [0, 1, 2]:
    con = sqlite3.connect(f"data/bank-shard-{s}.db")
    cur = con.cursor()
    cur.execute("SELECT account_id FROM accounts")
    for row in cur.fetchall():
        shards_accs.add(row[0])
    con.close()

con_base = sqlite3.connect("data/baseline.db")
cur_base = con_base.cursor()
cur_base.execute("SELECT account_id FROM accounts")
base_accs = set(r[0] for r in cur_base.fetchall())
con_base.close()

common = shards_accs.intersection(base_accs)
print(f"Shards unique accounts: {len(shards_accs)}")
print(f"Baseline unique accounts: {len(base_accs)}")
print(f"Common accounts: {len(common)}")
missing_in_base = shards_accs - base_accs
print(f"In shards but not in baseline: {len(missing_in_base)}")
missing_in_shards = base_accs - shards_accs
print(f"In baseline but not in shards: {len(missing_in_shards)}: {list(missing_in_shards)[:10]}")
