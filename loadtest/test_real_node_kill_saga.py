#!/usr/bin/env python3
"""
loadtest/test_real_node_kill_saga.py
UCS3513 System Design Lab - Task 5: Real Node-Kill Mid-Saga Fault Recovery Test
1. Verifies initial balance invariant across all database shards.
2. Spawns concurrent cross-shard transfer requests targeting node-8082 with X-Saga-Delay-Ms.
3. Violently terminates the live process for node-8082 mid-flight.
4. Asserts count of PENDING transfers > 0 at crash time (retrying if needed).
5. Triggers TransferRecoveryJob on surviving node-8081.
6. Verifies every orphaned transfer transitions cleanly from PENDING -> COMPENSATED (Refunded).
7. Restarts node-8082.
8. Mathematically proves balance conservation (0.00 drift, 0 negatives, 0 duplicate txns).
Saves log to docs/results/real_node_kill_saga_invariant.log.
"""

import os
import sys
import time
import json
import sqlite3
import subprocess
import urllib.request
import urllib.parse
from concurrent.futures import ThreadPoolExecutor

PS_BIN = r"C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe"

SHARDS = [
    ('bank-shard-0', 'data/bank-shard-0.db'),
    ('bank-shard-1', 'data/bank-shard-1.db'),
    ('bank-shard-2', 'data/bank-shard-2.db')
]

OUT_LOGS = [
    'results/real_node_kill_saga_invariant.log',
    'docs/results/real_node_kill_saga_invariant.log'
]

def check_invariants():
    total_accs = 0
    total_cents = 0
    total_bills = 0
    neg_accs = 0
    all_txns = []

    for sid, db_path in SHARDS:
        if not os.path.exists(db_path):
            continue
        conn = sqlite3.connect(db_path)
        cur = conn.cursor()
        accs = cur.execute("SELECT count(*) FROM accounts").fetchone()[0]
        bal = cur.execute("SELECT coalesce(sum(balance_cents), 0) FROM accounts").fetchone()[0]
        negs = cur.execute("SELECT count(*) FROM accounts WHERE balance_cents < 0").fetchone()[0]
        bills = cur.execute("SELECT coalesce(sum(amount_cents), 0) FROM bills WHERE status = 'PAID'").fetchone()[0]
        txns = [r[0] for r in cur.execute("SELECT transaction_id FROM transactions").fetchall()]
        conn.close()

        total_accs += accs
        total_cents += bal
        total_bills += bills
        neg_accs += negs
        all_txns.extend(txns)

    dups = len(all_txns) - len(set(all_txns))
    reconciled_total = total_cents + total_bills
    return total_accs, total_cents, total_bills, reconciled_total, neg_accs, len(all_txns), dups

def find_pid_by_port(port):
    script = f"(Get-NetTCPConnection -LocalPort {port} -State Listen -ErrorAction SilentlyContinue).OwningProcess"
    try:
        out = subprocess.check_output([PS_BIN, "-NoProfile", "-Command", script], text=True).strip()
        lines = [line.strip() for line in out.splitlines() if line.strip().isdigit()]
        if lines:
            return int(lines[0])
    except Exception:
        pass
    return None

def login_user(username, password="Password@123"):
    url = "http://localhost:8081/auth/login"
    payload = json.dumps({"username": username, "password": password}).encode("utf-8")
    req = urllib.request.Request(url, data=payload, headers={"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=5) as resp:
            data = json.loads(resp.read().decode())
            return data.get("token")
    except Exception as e:
        print(f"Login failed: {e}")
        return None

def execute_transfer(src_acc, dst_acc, amount_cents, token, saga_delay_ms=2000):
    url = "http://localhost:8082/transfers"
    payload = json.dumps({
        "sourceAccountId": src_acc,
        "destAccountId": dst_acc,
        "amountCents": amount_cents,
        "description": "Live Node Kill Mid-Saga Test"
    }).encode("utf-8")
    headers = {
        "Content-Type": "application/json",
        "Idempotency-Key": f"KILL-TEST-{src_acc}-{int(time.time()*1000)}-{os.getpid()}",
        "X-Saga-Delay-Ms": str(saga_delay_ms)
    }
    if token:
        headers["Authorization"] = f"Bearer {token}"
    req = urllib.request.Request(url, data=payload, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            return resp.status, json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()
    except Exception as e:
        return 0, str(e)

def run_experiment(attempt, max_attempts, log):
    log(f"\n>>> Attempt {attempt}/{max_attempts} to capture in-flight Sagas during node termination...")

    # 1. Pre-check
    pre_acc, pre_bal, pre_bills, pre_tot, pre_neg, pre_txns, pre_dup = check_invariants()
    log(f"  - Initial Shard State: Accounts={pre_acc}, Balances={pre_bal:,} cents, Bills={pre_bills:,} cents, Reconciled={pre_tot:,} cents")
    assert pre_neg == 0, "Invariant violation: negative accounts present!"
    assert pre_dup == 0, "Invariant violation: duplicate transactions present!"

    # 2. Select source (Shard 1, served by node-8082) and dest (Shard 0)
    conn1 = sqlite3.connect('data/bank-shard-1.db')
    src_row = conn1.execute("SELECT account_id, customer_id FROM accounts WHERE balance_cents > 100000 LIMIT 1").fetchone()
    src_acc, src_cust = src_row
    conn1.close()

    conn0 = sqlite3.connect('data/bank-shard-0.db')
    dst_row = conn0.execute("SELECT account_id FROM accounts LIMIT 1").fetchone()
    dst_acc = dst_row[0]
    conn0.close()

    log(f"  - Routing: Source={src_acc} (Shard 1 / Node :8082) -> Dest={dst_acc} (Shard 0 / Node :8081)")

    # 3. Authenticate
    token = login_user("divya.iyer1")
    log(f"  - Authenticated session token obtained: {token[:30]}...")

    # 4. Check node-8082 PID
    node_8082_pid = find_pid_by_port(8082)
    log(f"  - Verified live PID for node-8082: {node_8082_pid}")
    if not node_8082_pid:
        log("  [Error] node-8082 is not running. Aborting.")
        return False

    # 5. Spawn concurrent transfers targeting node-8082 with 2000ms injected delay
    log(f"  - Spawning 4 concurrent cross-shard transfers with 2000ms Saga delay...")
    executor = ThreadPoolExecutor(max_workers=4)
    futures = []
    for i in range(4):
        f = executor.submit(execute_transfer, src_acc, dst_acc, 25000, token, 2000)
        futures.append(f)

    # Allow Step 1 (debit + PENDING write) to execute on node-8082
    time.sleep(0.35)

    # 6. Violently kill node-8082 mid-flight
    log(f"  - Terminating process PID {node_8082_pid} violently (taskkill /F)...")
    subprocess.run(["taskkill", "/F", "/PID", str(node_8082_pid)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    time.sleep(0.5)

    # 7. Check for PENDING transfers in bank-shard-1.db
    conn1 = sqlite3.connect('data/bank-shard-1.db')
    pending_rows = conn1.execute("SELECT transfer_id, source_account_id, dest_account_id, amount_cents, status, created_at FROM transfers WHERE status = 'PENDING'").fetchall()
    conn1.close()

    log(f"  - Interrupted transfers recorded in PENDING state at kill time: {len(pending_rows)}")
    for r in pending_rows:
        log(f"      * Transfer {r[0]}: {r[1]} -> {r[2]} | Amount: {r[3]} cents | Status: {r[4]}")

    if len(pending_rows) == 0:
        log("  [Notice] 0 PENDING transfers captured in this iteration. Retrying experiment...")
        # Restart node-8082 before retry
        restart_node_8082(log)
        return False

    # 8. Wait 3.5s so cutoffTime (now - 3000ms) passes
    log("  - Waiting 3.5s for TransferRecoveryJob cutoff window...")
    time.sleep(3.5)

    # 9. Trigger TransferRecoveryJob on surviving node-8081
    log("  - Triggering TransferRecoveryJob on surviving node (:8081)...")
    try:
        rec_req = urllib.request.Request("http://localhost:8081/admin/recover-transfers", data=b"", headers={"Content-Type": "application/json"})
        with urllib.request.urlopen(rec_req, timeout=5) as rec_resp:
            rec_data = json.loads(rec_resp.read().decode())
            log(f"  - Recovery Job Response: {rec_data}")
    except Exception as e:
        log(f"  - HTTP trigger error: {e}")

    # 10. Audit Shard 1 to verify each transfer transitioned PENDING -> COMPENSATED
    conn1 = sqlite3.connect('data/bank-shard-1.db')
    cur1 = conn1.cursor()
    recovered_rows = cur1.execute(
        "SELECT transfer_id, source_account_id, dest_account_id, amount_cents, status, error_message FROM transfers WHERE transfer_id IN (" +
        ",".join(f"'{r[0]}'" for r in pending_rows) + ")"
    ).fetchall()
    conn1.close()

    log("\n[Step 5 Audit] Post-Recovery Transfer Status Transitions:")
    for r in recovered_rows:
        log(f"  - Transfer {r[0]}: Transitioned to {r[4]} | Reason: {r[5]}")
        assert r[4] in ('COMPENSATED', 'COMPLETED'), f"Transfer {r[0]} was not resolved! Status={r[4]}"

    # 11. Restart node-8082 to restore cluster
    restart_node_8082(log)

    # 12. Final Invariant Verification
    post_acc, post_bal, post_bills, post_tot, post_neg, post_txns, post_dup = check_invariants()
    drift = post_tot - pre_tot

    log("\n[Step 7 Audit] Reconciled Invariant Verification After Recovery:")
    log("------------------------------------------------------------------")
    log(f"  Pre-Crash Total Reconciled:  {pre_tot:,} cents (INR {pre_tot/100:,.2f})")
    log(f"  Post-Recovery Reconciled:    {post_tot:,} cents (INR {post_tot/100:,.2f})")
    log(f"  Calculated Financial Drift:  {drift:+.2f} cents")
    log(f"  Negative Balances Found:     {post_neg}")
    log(f"  Duplicate Transactions:      {post_dup}")
    log("------------------------------------------------------------------")

    assert post_neg == 0, f"Invariant violation: Found {post_neg} negative balances!"
    assert post_dup == 0, f"Invariant violation: Found {post_dup} duplicate transactions!"
    assert drift == 0, f"Invariant violation: Financial balance drift detected: {drift} cents!"

    log("  >>> INVARIANT CONSERVED: 100.0% EXACT BALANCE CONSERVATION! <<<")
    log("  >>> PROOF: Real live process crash resolved by TransferRecoveryJob with +0.00 balance drift. <<<")
    log("==================================================================")
    return True

def restart_node_8082(log):
    log("  - Restarting node-8082 instance on port 8082...")
    cmd = [
        "java",
        "-Djava.io.tmpdir=D:/projects/banking/.tmp",
        "-Dorg.sqlite.tmpdir=D:/projects/banking/.tmp",
        "-Dserver.port=8082",
        "-Dbanking.node-id=2",
        "-Dbanking.shards.db-path=./data/bank-shard-1.db",
        "-jar",
        "bank-service/target/bank-service-1.0.0-SNAPSHOT.jar"
    ]
    out_f = open("logs/node-8082.log", "a")
    err_f = open("logs/node-8082-err.log", "a")
    proc = subprocess.Popen(cmd, stdout=out_f, stderr=err_f)
    log(f"  - Launched new node-8082 process (PID {proc.pid}). Waiting for port 8082...")
    for _ in range(40):
        time.sleep(1)
        if find_pid_by_port(8082):
            log(f"  - [READY] node-8082 listening on port 8082.")
            return
    log("  [Warning] node-8082 did not bind within 40 seconds.")

def main():
    log_lines = []
    def log(msg):
        print(msg)
        log_lines.append(msg)

    log("==================================================================")
    log("   REAL PROCESS KILL SAGA CRASH & RECOVERY EXPERIMENT            ")
    log(f"   Execution Timestamp: {time.strftime('%Y-%m-%d %H:%M:%S')}")
    log("   Candidate: Rishi K.S. | Register No: 3122245001142            ")
    log("   SSN College of Engineering - B.E. Computer Science & Engg      ")
    log("==================================================================")

    success = False
    for attempt in range(1, 4):
        if run_experiment(attempt, 3, log):
            success = True
            break

    if not success:
        log("\n[FAILURE] Failed to capture in-flight Sagas after 3 attempts.")
        sys.exit(1)

    for out_path in OUT_LOGS:
        os.makedirs(os.path.dirname(out_path), exist_ok=True)
        with open(out_path, "w", encoding="utf-8") as f:
            f.write("\n".join(log_lines) + "\n")
        print(f"  [SAVED] {out_path}")

if __name__ == "__main__":
    main()
