import sqlite3

tot_bal = 0
tot_bills = 0
tot_debits = 0
tot_credits = 0
for s in ['data/bank-shard-0.db', 'data/bank-shard-1.db', 'data/bank-shard-2.db']:
    c = sqlite3.connect(s)
    tot_bal += c.execute("SELECT coalesce(sum(balance_cents), 0) FROM accounts").fetchone()[0]
    tot_bills += c.execute("SELECT coalesce(sum(amount_cents), 0) FROM bills WHERE status = 'PAID'").fetchone()[0]
    tot_debits += c.execute("SELECT coalesce(sum(amount_cents), 0) FROM transactions WHERE type IN ('DEBIT', 'TRANSFER_OUT', 'BILL_PAY')").fetchone()[0]
    tot_credits += c.execute("SELECT coalesce(sum(amount_cents), 0) FROM transactions WHERE type IN ('CREDIT', 'TRANSFER_IN', 'COMPENSATION_REFUND')").fetchone()[0]
    c.close()

print(f"Total Balances: {tot_bal}")
print(f"Total Paid Bills: {tot_bills}")
print(f"Sum (Bal + Paid Bills): {tot_bal + tot_bills}")
print(f"Total Debits: {tot_debits}")
print(f"Total Credits: {tot_credits}")
print(f"Debits - Credits: {tot_debits - tot_credits}")
