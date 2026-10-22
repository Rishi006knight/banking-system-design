import sqlite3
conn = sqlite3.connect('./data/bank-shard-3.db')
cur = conn.cursor()
cur.execute("SELECT account_id FROM accounts WHERE account_id = 'ACC-0000065'")
print('bank-shard-3 has ACC-0000065:', cur.fetchone())
cur.execute('SELECT count(*) FROM accounts')
print('bank-shard-3 total accounts:', cur.fetchone()[0])
