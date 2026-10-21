import sqlite3

shards = ['data/bank-shard-0.db', 'data/bank-shard-1.db', 'data/bank-shard-2.db']
current_bal = sum(sqlite3.connect(s).execute("SELECT sum(balance_cents) FROM accounts").fetchone()[0] for s in shards)
bill_paid = sum(sqlite3.connect(s).execute("SELECT sum(amount_cents) FROM transactions WHERE type='BILL_PAY'").fetchone()[0] or 0 for s in shards)
net_trf_diff = sum(
    (sqlite3.connect(s).execute("SELECT coalesce(sum(amount_cents), 0) FROM transactions WHERE type='TRANSFER_IN'").fetchone()[0]) -
    (sqlite3.connect(s).execute("SELECT coalesce(sum(amount_cents), 0) FROM transactions WHERE type='TRANSFER_OUT'").fetchone()[0])
    for s in shards
)
print(f"Current Balance: {current_bal}")
print(f"Total Bill Paid: {bill_paid}")
print(f"Net Transfer Difference (Credit - Debit): {net_trf_diff}")
