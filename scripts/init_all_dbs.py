#!/usr/bin/env python3
"""
Clean Database Initializer and Seeder
Initializes 3 shards (bank-shard-0, bank-shard-1, bank-shard-2) and clones into data/baseline.db.
"""

import os
import glob
import sqlite3
import subprocess
import sys

def init_databases():
    print("==========================================================")
    print("   INITIALIZING BANKING DATABASES (SHARDS + BASELINE)     ")
    print("==========================================================")
    
    os.makedirs("data", exist_ok=True)
    
    # 1. Clean old database files
    for f in glob.glob("data/*.db*"):
        try:
            os.remove(f)
            print(f"  Removed old file: {f}")
        except Exception as e:
            print(f"  Warning: could not remove {f}: {e}")
            
    # 2. Run DataGeneratorCli to seed 3 shards
    cmd = (
        'mvn compile exec:java -pl data-tools '
        '-Dexec.mainClass=com.banking.datatools.DataGeneratorCli '
        '"-Dexec.args=--shards 3 --data-dir ./data --customers 416 --accounts 416 --transactions 4000"'
    )
    print(f"\nSeeding 3 shards with SyntheticDataGenerator...")
    subprocess.check_call(cmd, shell=True)
    
    # 3. Clone shards into data/baseline.db
    print("\nCloning shards into monolithic baseline.db...")
    base_path = 'data/baseline.db'
    
    # Get schema from shard 0
    conn_s0 = sqlite3.connect('data/bank-shard-0.db')
    schema = conn_s0.execute("SELECT sql FROM sqlite_master WHERE type='table'").fetchall()
    conn_s0.close()
    
    conn_b = sqlite3.connect(base_path)
    conn_b.execute("PRAGMA journal_mode = WAL;")
    conn_b.execute("PRAGMA synchronous = NORMAL;")
    for s in schema:
        if s[0]:
            conn_b.execute(s[0])
    conn_b.commit()
    
    for shard in ['data/bank-shard-0.db', 'data/bank-shard-1.db', 'data/bank-shard-2.db']:
        conn_s = sqlite3.connect(shard)
        for tbl in ['customers', 'accounts', 'bills', 'beneficiaries', 'transactions']:
            rows = conn_s.execute(f"SELECT * FROM {tbl}").fetchall()
            if rows:
                placeholders = ','.join(['?'] * len(rows[0]))
                conn_b.executemany(f"INSERT OR IGNORE INTO {tbl} VALUES ({placeholders})", rows)
        conn_s.close()
    conn_b.commit()
    conn_b.close()
    
    # 4. Rebalance shards to match Gateway Consistent Hash Ring
    print("\nRebalancing shards to match Gateway Consistent Hash Ring...")
    rebalance_cmd = 'mvn compile exec:java -pl data-tools "-Dexec.mainClass=com.banking.datatools.RebalanceToRing"'
    subprocess.check_call(rebalance_cmd, shell=True)

    # 5. Verify integrity
    total_shard_bal = 0
    total_shard_accs = 0
    for shard in ['data/bank-shard-0.db', 'data/bank-shard-1.db', 'data/bank-shard-2.db']:
        c = sqlite3.connect(shard)
        accs = c.execute("SELECT count(*) FROM accounts").fetchone()[0]
        bal = c.execute("SELECT sum(balance_cents) FROM accounts").fetchone()[0] or 0
        total_shard_accs += accs
        total_shard_bal += bal
        c.close()
        
    cb = sqlite3.connect(base_path)
    base_accs = cb.execute("SELECT count(*) FROM accounts").fetchone()[0]
    base_bal = cb.execute("SELECT sum(balance_cents) FROM accounts").fetchone()[0] or 0
    cb.close()
    
    print("\nDATABASE INTEGRITY CHECK:")
    print(f"  Shards (0+1+2): Accounts = {total_shard_accs}, Total Balance = {total_shard_bal} cents")
    print(f"  Baseline DB:    Accounts = {base_accs}, Total Balance = {base_bal} cents")
    assert total_shard_accs == base_accs, f"Account mismatch: {total_shard_accs} vs {base_accs}"
    assert total_shard_bal == base_bal, f"Balance mismatch: {total_shard_bal} vs {base_bal}"
    print("  [SUCCESS] Shards and Baseline DB 100% synchronized and aligned to ring!\n")

if __name__ == "__main__":
    init_databases()
