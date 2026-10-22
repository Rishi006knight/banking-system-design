import sqlite3

def find_acc(acc_id):
    for path in ["data/bank-shard-0.db", "data/bank-shard-1.db", "data/bank-shard-2.db", "data/baseline.db"]:
        conn = sqlite3.connect(path)
        cur = conn.cursor()
        cur.execute("SELECT * FROM accounts WHERE account_id = ?", (acc_id,))
        rows = cur.fetchall()
        if rows:
            print(f"Found {acc_id} in {path}: {rows}")
        conn.close()

for a in ['ACC-106655739363209216', 'ACC-106655740277567489', 'ACC-15961107', 'ACC-3b1cee72']:
    find_acc(a)
