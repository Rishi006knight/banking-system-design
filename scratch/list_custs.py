import sqlite3

c = sqlite3.connect("./data/baseline.db")
cur = c.cursor()
cur.execute("SELECT customer_id, username FROM customers ORDER BY customer_id LIMIT 10")
for row in cur.fetchall():
    print(row)
