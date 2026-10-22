import sqlite3

def check_keys(col):
    def get_col(db_path):
        conn = sqlite3.connect(db_path)
        cur = conn.cursor()
        cur.execute(f"SELECT {col} FROM accounts")
        res = set(row[0] for row in cur.fetchall())
        conn.close()
        return res

    s0 = get_col("data/bank-shard-0.db")
    s1 = get_col("data/bank-shard-1.db")
    s2 = get_col("data/bank-shard-2.db")
    base = get_col("data/baseline.db")

    shards_all = s0 | s1 | s2
    print(f"Col {col}: Shards total {len(shards_all)}, Base total {len(base)}")
    print(f"In shards but not base: {len(shards_all - base)}")
    print(f"In base but not shards: {len(base - shards_all)}")
    if len(shards_all - base) > 0:
        print("Sample diff in shards not base:", list(shards_all - base)[:5])
    if len(base - shards_all) > 0:
        print("Sample diff in base not shards:", list(base - shards_all)[:5])

check_keys("account_id")
check_keys("account_number")
check_keys("customer_id")
