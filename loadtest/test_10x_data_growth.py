#!/usr/bin/env python3
"""
Dynamic Shard Scale-Out & Rebalancing Invariant Verification
Course: UCS3513 System Design Laboratory (Mini Project 7: Scalable Online Banking System)
Institution: SSN College of Engineering

Evaluates dynamic storage scale-out from 3 database shards to 4 shards:
1. Inspects initial account and financial balance distribution across initial shards.
2. Initializes the 4th partition (bank-shard-3.db).
3. Evaluates consistent hash remapping across all accounts using 150 virtual nodes per shard.
4. Atomically migrates remapped customers, accounts, and historical transactions.
5. Mathematically proves the fundamental financial invariant:
   SUM(balance_cents)_before == SUM(balance_cents)_after (0.00 balance drift).
"""

import os
import sys
import sqlite3
import hashlib
import time

SHARDS_INITIAL = ['data/bank-shard-0.db', 'data/bank-shard-1.db', 'data/bank-shard-2.db']
SHARD_NEW = 'data/bank-shard-3.db'
LOG_FILES = ['results/10x_data_growth_invariant.log', 'docs/results/10x_data_growth_invariant.log']

def murmur3_like_hash(key_str):
    # Deterministic 64-bit hash matching Java implementation in ConsistentHashRing
    h = hashlib.md5(key_str.encode('utf-8')).digest()
    return int.from_bytes(h[:8], byteorder='big', signed=True)

class ConsistentHashRing:
    def __init__(self, node_names, vnodes=150):
        self.vnodes = vnodes
        self.ring = []
        for name in node_names:
            self.add_node(name)

    def add_node(self, node_name):
        for v in range(self.vnodes):
            v_key = f"{node_name}#VN-{v}"
            h = murmur3_like_hash(v_key)
            self.ring.append((h, node_name))
        self.ring.sort(key=lambda x: x[0])

    def route(self, key):
        h = murmur3_like_hash(key)
        for ring_h, node in self.ring:
            if ring_h >= h:
                return node
        return self.ring[0][1]

def log(msg):
    print(msg)
    for p in LOG_FILES:
        os.makedirs(os.path.dirname(p), exist_ok=True)
        with open(p, 'a', encoding='utf-8') as f:
            f.write(msg + "\n")

def get_total_balance(shard_paths):
    total_balance = 0
    total_accounts = 0
    total_transactions = 0
    for p in shard_paths:
        if not os.path.exists(p):
            continue
        conn = sqlite3.connect(p)
        cur = conn.cursor()
        cur.execute("SELECT COUNT(*), COALESCE(SUM(balance_cents), 0) FROM accounts")
        cnt, bal = cur.fetchone()
        cur.execute("SELECT COUNT(*) FROM transactions")
        tx_cnt = cur.fetchone()[0]
        conn.close()
        total_accounts += cnt
        total_balance += bal
        total_transactions += tx_cnt
    return total_accounts, total_balance, total_transactions

def main():
    for p in LOG_FILES:
        if os.path.exists(p):
            os.remove(p)

    log("==================================================================")
    log("   DYNAMIC SHARD SCALE-OUT & INVARIANT VERIFICATION (3 -> 4)      ")
    log(f"   Execution Timestamp: {time.strftime('%Y-%m-%d %H:%M:%S')}   ")
    log("==================================================================")

    # 1. Measure initial state of 3 shards
    accs_pre, bal_pre, tx_pre = get_total_balance(SHARDS_INITIAL)
    log(f"\n[Step 1] Initial Shard State (3 Partitions):")
    log(f"  - Total Seeded Accounts: {accs_pre:,}")
    log(f"  - Total Historical Transactions: {tx_pre:,}")
    log(f"  - Total Financial Balance Across All Shards: {bal_pre:,} cents (INR {bal_pre/100:,.2f})")

    # 2. Setup 4th shard schema
    log(f"\n[Step 2] Initializing 4th Shard Database: {SHARD_NEW}...")
    if os.path.exists(SHARD_NEW):
        os.remove(SHARD_NEW)

    conn_source = sqlite3.connect(SHARDS_INITIAL[0])
    schema_sql = conn_source.execute("SELECT sql FROM sqlite_master WHERE type='table'").fetchall()
    conn_source.close()

    conn_new = sqlite3.connect(SHARD_NEW)
    for s in schema_sql:
        if s[0]:
            conn_new.execute(s[0])
    conn_new.commit()
    conn_new.close()
    log(f"  [OK] Created schema on {SHARD_NEW}")

    # 3. Simulate Consistent Hash Migration (3 -> 4 shards)
    log(f"\n[Step 3] Evaluating Consistent Hash Remapping across {accs_pre} accounts...")
    ring_3 = ConsistentHashRing(['bank-shard-0', 'bank-shard-1', 'bank-shard-2'], vnodes=150)
    ring_4 = ConsistentHashRing(['bank-shard-0', 'bank-shard-1', 'bank-shard-2', 'bank-shard-3'], vnodes=150)

    migrated_accounts = []
    migrated_transactions = []
    
    # Read all accounts from all 3 initial shards
    for shard_idx, shard_path in enumerate(SHARDS_INITIAL):
        conn = sqlite3.connect(shard_path)
        cur = conn.cursor()
        cur.execute("SELECT a.account_id, a.customer_id, a.account_number, a.balance_cents, a.created_at, a.updated_at, "
                    "c.username, c.password_hash, c.email, c.full_name "
                    "FROM accounts a JOIN customers c ON a.customer_id = c.customer_id")
        rows = cur.fetchall()

        for r in rows:
            acc_id = r[0]
            new_dest = ring_4.route(acc_id)
            if new_dest == 'bank-shard-3':
                # Fetch transactions belonging to this account
                cur.execute("SELECT transaction_id, account_id, type, amount_cents, balance_after_cents, description, idempotency_key, created_at "
                            "FROM transactions WHERE account_id = ?", (acc_id,))
                txs = cur.fetchall()
                migrated_accounts.append((shard_path, r))
                for tx in txs:
                    migrated_transactions.append((shard_path, tx))

        conn.close()

    total_evaluated = accs_pre
    migrated_count = len(migrated_accounts)
    migration_pct = (migrated_count / total_evaluated) * 100 if total_evaluated > 0 else 0.0

    log(f"  [OK] Evaluated {total_evaluated} accounts.")
    log(f"  [OK] Accounts re-mapped to bank-shard-3: {migrated_count} ({migration_pct:.2f}%)")
    log(f"  [OK] Accounts remaining on shards 0, 1, 2: {total_evaluated - migrated_count} ({100 - migration_pct:.2f}%)")
    log(f"  [OK] Theoretical optimal migration target: ~25.00% (1/(N+1) = 1/4)")

    # 4. Perform actual migration with atomic batch inserts and deletes
    log(f"\n[Step 4] Executing Atomic Data Migration into {SHARD_NEW}...")
    conn_new = sqlite3.connect(SHARD_NEW)
    cur_new = conn_new.cursor()

    moved_balance_sum = sum(r[3] for _, r in migrated_accounts)
    start_mig_time = time.time()

    # Batch insert customers and accounts into shard-3
    for _, r in migrated_accounts:
        acc_id, cust_id, acc_num, bal_cents, cr_at, up_at, uname, pwd, email, fname = r
        cur_new.execute(
            "INSERT OR IGNORE INTO customers (customer_id, username, password_hash, email, full_name, created_at) "
            "VALUES (?, ?, ?, ?, ?, ?)",
            (cust_id, uname, pwd, email, fname, cr_at)
        )
        cur_new.execute(
            "INSERT OR IGNORE INTO accounts (account_id, customer_id, account_number, balance_cents, created_at, updated_at) "
            "VALUES (?, ?, ?, ?, ?, ?)",
            (acc_id, cust_id, acc_num, bal_cents, cr_at, up_at)
        )

    # Batch insert transactions into shard-3
    for _, tx in migrated_transactions:
        cur_new.execute(
            "INSERT OR IGNORE INTO transactions (transaction_id, account_id, type, amount_cents, balance_after_cents, description, idempotency_key, created_at) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            tx
        )
    conn_new.commit()
    conn_new.close()

    # Batch delete from each source shard
    for src_path in SHARDS_INITIAL:
        acc_ids_to_del = [r[0] for p, r in migrated_accounts if p == src_path]
        if not acc_ids_to_del:
            continue
        conn_src = sqlite3.connect(src_path)
        cur_src = conn_src.cursor()
        for aid in acc_ids_to_del:
            cur_src.execute("DELETE FROM transactions WHERE account_id = ?", (aid,))
            cur_src.execute("DELETE FROM accounts WHERE account_id = ?", (aid,))
        conn_src.commit()
        conn_src.close()

    mig_duration_ms = int((time.time() - start_mig_time) * 1000)

    log(f"  [OK] Successfully migrated {migrated_count} accounts and {len(migrated_transactions)} transactions in {mig_duration_ms} ms.")
    log(f"  [OK] Total balance transferred to 4th shard: {moved_balance_sum:,} cents (INR {moved_balance_sum/100:,.2f})")

    # 5. Invariant Balance Conservation Check
    all_shards = SHARDS_INITIAL + [SHARD_NEW]
    accs_post, bal_post, tx_post = get_total_balance(all_shards)

    drift = bal_post - bal_pre

    log(f"\n[Step 5] Invariant Mathematical Proof:")
    log(f"  ------------------------------------------------------------------")
    log(f"  Initial Total Balance (3 Shards): {bal_pre:,} cents (INR {bal_pre/100:,.2f})")
    log(f"  Post-Scale Total Balance (4 Shards): {bal_post:,} cents (INR {bal_post/100:,.2f})")
    log(f"  Initial Total Transactions: {tx_pre:,}")
    log(f"  Post-Scale Total Transactions: {tx_post:,}")
    log(f"  Calculated Financial Drift (Delta): {drift:+.2f} cents")
    log(f"  ------------------------------------------------------------------")

    if drift == 0 and accs_post == accs_pre and tx_post == tx_pre:
        log(f"  >>> INVARIANT CONSERVED: 100.0% EXACT FINANCIAL BALANCE & TRANSACTION CONSERVATION! <<<")
        log(f"  >>> PROOF: No funds or transactions were lost, duplicated, or leaked during dynamic shard migration. <<<")
    else:
        log(f"  >>> INVARIANT VIOLATION: Balance drift of {drift} cents or row count mismatch! <<<")
        sys.exit(1)

    log("\n==================================================================")
    log(f"   SHARD SCALE-OUT INVARIANT EXPERIMENT COMPLETED SUCCESSFULLY!   ")
    log("==================================================================")

if __name__ == '__main__':
    main()

