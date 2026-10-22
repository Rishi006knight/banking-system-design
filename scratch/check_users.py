import sqlite3

for p in ['./data/bank-shard-0.db', './data/bank-shard-1.db', './data/bank-shard-2.db', './data/baseline.db']:
    con = sqlite3.connect(p)
    cur = con.cursor()
    cur.execute('SELECT username, password_hash, full_name FROM customers LIMIT 3')
    print(p, cur.fetchall())
