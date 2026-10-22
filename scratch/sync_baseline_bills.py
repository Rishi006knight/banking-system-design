import sqlite3

con_base = sqlite3.connect('./data/baseline.db')
cur = con_base.cursor()
cur.execute("""
    INSERT OR REPLACE INTO bills (bill_id, customer_id, biller_code, biller_name, amount_cents, status, created_at, paid_at)
    SELECT substr(description, 15), 'CUST-BASE', 'UTIL_BILL', 'Utility Service Provider', amount_cents, 'PAID', created_at, created_at
    FROM transactions
    WHERE description LIKE 'Bill Payment: %'
""")
con_base.commit()
print("Updated baseline bills from transactions. Rows affected:", cur.rowcount)

cur.execute("SELECT sum(balance_cents) FROM accounts")
bal = cur.fetchone()[0]
cur.execute("SELECT sum(amount_cents) FROM bills WHERE status = 'PAID'")
paid = cur.fetchone()[0]
print(f"Baseline balance={bal}, paid bills={paid}, total reconciled={bal + paid}")
con_base.close()
