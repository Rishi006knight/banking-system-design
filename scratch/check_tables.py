import sqlite3

con = sqlite3.connect("data/baseline.db")
cur = con.cursor()
cur.execute("SELECT name FROM sqlite_master WHERE type='table'")
print("Baseline tables:", [r[0] for r in cur.fetchall()])
con.close()
