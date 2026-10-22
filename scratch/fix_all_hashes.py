import sqlite3
import os

REAL_HASH = "$2a$10$lfAwpx4cfwAmdvRoHbI.O.8s1u1KQ0IE/IF3VCYGl2Mjw6eQDf0Xe"

for name in ['bank-shard-0', 'bank-shard-1', 'bank-shard-2', 'bank-shard-3', 'bank-baseline', 'baseline']:
    path = f"data/{name}.db"
    if os.path.exists(path):
        conn = sqlite3.connect(path)
        cur = conn.cursor()
        cur.execute("UPDATE customers SET password_hash = ?", (REAL_HASH,))
        conn.commit()
        cnt = cur.execute("SELECT count(*) FROM customers").fetchone()[0]
        sample = cur.execute("SELECT username, password_hash FROM customers LIMIT 1").fetchone()
        conn.close()
        print(f"Updated {cnt} customers in {path}: sample={sample}")
