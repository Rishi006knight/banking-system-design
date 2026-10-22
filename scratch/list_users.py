import sqlite3

for p in ["./data/bank-shard-0.db", "./data/bank-shard-1.db", "./data/bank-shard-2.db"]:
    c = sqlite3.connect(p)
    cur = c.cursor()
    cur.execute("SELECT username FROM customers LIMIT 5")
    print(p, cur.fetchall())

c = sqlite3.connect("./data/baseline.db")
cur = c.cursor()
cur.execute("SELECT username FROM customers LIMIT 10")
print("baseline:", cur.fetchall())
