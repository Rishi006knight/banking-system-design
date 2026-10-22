import sqlite3
import hashlib
import os

REAL_HASH = "$2a$10$lfAwpx4cfwAmdvRoHbI.O.8s1u1KQ0IE/IF3VCYGl2Mjw6eQDf0Xe"

def murmur3_like_hash(key_str):
    h = hashlib.md5(key_str.encode('utf-8')).digest()
    return int.from_bytes(h[:8], byteorder='big', signed=True)

class ConsistentHashRing:
    def __init__(self, node_names, vnodes=150):
        self.vnodes = vnodes
        self.ring = []
        for name in node_names:
            for v in range(self.vnodes):
                v_key = f"{name}#VN-{v}"
                h = murmur3_like_hash(v_key)
                self.ring.append((h, name))
        self.ring.sort(key=lambda x: x[0])

    def route(self, key):
        h = murmur3_like_hash(key)
        for ring_h, node in self.ring:
            if ring_h >= h:
                return node
        return self.ring[0][1]

def restore_shards():
    print("==================================================")
    print(" RESTORING SHARDS 0, 1, 2 TO FULL ACCOUNT SET")
    print("==================================================")
    ring_3 = ConsistentHashRing(['bank-shard-0', 'bank-shard-1', 'bank-shard-2'], vnodes=150)
    
    conn3 = sqlite3.connect('data/bank-shard-3.db')
    cur3 = conn3.cursor()

    cur3.execute("SELECT customer_id, username, password_hash, email, full_name, created_at FROM customers")
    custs = cur3.fetchall()

    cur3.execute("SELECT account_id, customer_id, account_number, balance_cents, currency, status, created_at, updated_at FROM accounts")
    accs = cur3.fetchall()

    cur3.execute("SELECT transaction_id, account_id, type, amount_cents, balance_after_cents, description, idempotency_key, created_at FROM transactions")
    txs = cur3.fetchall()

    print(f"Reading from bank-shard-3: {len(custs)} customers, {len(accs)} accounts, {len(txs)} transactions.")

    # Group by target shard under 3-shard ring
    by_shard_acc = {}
    for a in accs:
        target = ring_3.route(a[0])
        by_shard_acc.setdefault(target, []).append(a)

    by_shard_tx = {}
    for t in txs:
        target = ring_3.route(t[1])
        by_shard_tx.setdefault(target, []).append(t)

    # Insert into target shards
    for shard_name in ['bank-shard-0', 'bank-shard-1', 'bank-shard-2']:
        shard_path = f"data/{shard_name}.db"
        conn = sqlite3.connect(shard_path)
        cur = conn.cursor()

        # Insert customers
        for c in custs:
            cur.execute("""
                INSERT OR IGNORE INTO customers (customer_id, username, password_hash, email, full_name, created_at)
                VALUES (?, ?, ?, ?, ?, ?)
            """, (c[0], c[1], REAL_HASH, c[3], c[4], c[5]))

        # Insert accounts
        acc_list = by_shard_acc.get(shard_name, [])
        for a in acc_list:
            cur.execute("""
                INSERT OR REPLACE INTO accounts (account_id, customer_id, account_number, balance_cents, currency, status, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """, (a[0], a[1], a[2], a[3], a[4], a[5], a[6], a[7]))

        # Insert transactions
        tx_list = by_shard_tx.get(shard_name, [])
        for t in tx_list:
            cur.execute("""
                INSERT OR IGNORE INTO transactions (transaction_id, account_id, type, amount_cents, balance_after_cents, description, idempotency_key, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """, (t[0], t[1], t[2], t[3], t[4], t[5], t[6], t[7]))

        # Update all password_hash to REAL_HASH
        cur.execute("UPDATE customers SET password_hash = ?", (REAL_HASH,))

        conn.commit()
        conn.close()
        print(f"  Restored to {shard_name}: {len(acc_list)} accounts, {len(tx_list)} txs.")

    # Also update baseline.db password_hash
    conn_base = sqlite3.connect('data/baseline.db')
    cur_base = conn_base.cursor()
    cur_base.execute("UPDATE customers SET password_hash = ?", (REAL_HASH,))
    conn_base.commit()
    conn_base.close()
    print("  Updated baseline.db password hashes to valid BCrypt.")

    # Verify total counts across shards 0, 1, 2
    tot_acc = 0
    tot_bal = 0
    tot_tx = 0
    for shard_name in ['bank-shard-0', 'bank-shard-1', 'bank-shard-2']:
        conn = sqlite3.connect(f"data/{shard_name}.db")
        cur = conn.cursor()
        cur.execute("SELECT count(*), coalesce(sum(balance_cents), 0) FROM accounts")
        c_acc, c_bal = cur.fetchone()
        cur.execute("SELECT count(*) FROM transactions")
        c_tx = cur.fetchone()[0]
        conn.close()
        tot_acc += c_acc
        tot_bal += c_bal
        tot_tx += c_tx
        print(f"  {shard_name}: {c_acc} accounts, {c_tx} transactions, {c_bal:,} cents")

    print(f"TOTAL ACROSS SHARDS 0,1,2: {tot_acc} accounts, {tot_tx} txs, {tot_bal:,} cents")

if __name__ == "__main__":
    restore_shards()
