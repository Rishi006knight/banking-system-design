import sqlite3

con_base = sqlite3.connect('./data/baseline.db')
cur = con_base.cursor()
cur.execute("SELECT count(*) FROM accounts")
acc_cnt = cur.fetchone()[0]
cur.execute("SELECT sum(balance_cents) FROM accounts")
bal_sum = cur.fetchone()[0]
cur.execute("SELECT count(*) FROM transactions")
tx_cnt = cur.fetchone()[0]
cur.execute("SELECT count(*), sum(amount_cents) FROM transactions WHERE description LIKE 'Bill Payment%'")
bills_in_tx = cur.fetchone()
cur.execute("SELECT count(*), sum(amount_cents) FROM bills WHERE status = 'PAID'")
paid_bills = cur.fetchone()
print(f"BASELINE: accounts={acc_cnt}, bal_sum={bal_sum}")
print(f"  transactions total: {tx_cnt}")
print(f"  bill transactions: count={bills_in_tx[0]}, sum={bills_in_tx[1]}")
print(f"  paid bills in table: count={paid_bills[0]}, sum={paid_bills[1]}")
print(f"  reconciled with bill transactions: {bal_sum + (bills_in_tx[1] or 0)}")
con_base.close()
