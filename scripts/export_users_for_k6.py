import sqlite3
import json

con = sqlite3.connect('./data/baseline.db')
cur = con.cursor()
cur.execute("SELECT c.username, a.account_id FROM customers c JOIN accounts a ON c.customer_id = a.customer_id ORDER BY a.account_id LIMIT 250")
rows = cur.fetchall()

users = [{"username": r[0], "accountId": r[1]} for r in rows]

with open('loadtest/users.json', 'w') as f:
    json.dump(users, f, indent=2)

print(f"Exported {len(users)} users to loadtest/users.json")
