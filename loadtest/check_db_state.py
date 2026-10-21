import sqlite3
import glob

for db in sorted(glob.glob('data/*.db')):
    conn = sqlite3.connect(db)
    accs = conn.execute("SELECT count(*) FROM accounts").fetchone()[0]
    txs = conn.execute("SELECT count(*) FROM transactions").fetchone()[0]
    bal = conn.execute("SELECT sum(balance_cents) FROM accounts").fetchone()[0]
    print(f"{db}: accounts={accs}, txs={txs}, balance={bal}")
    conn.close()
