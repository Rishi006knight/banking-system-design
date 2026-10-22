import sqlite3

conn = sqlite3.connect("data/bank-shard-0.db")
cur = conn.cursor()
cur.execute("PRAGMA table_info(accounts)")
print("accounts columns:", cur.fetchall())
conn.close()
