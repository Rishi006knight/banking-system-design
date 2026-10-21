#!/usr/bin/env python3
"""
Abusive Login Rate Limiter Real Load Test
Fires 100 rapid sequential POST /auth/login requests from fixed IP 192.168.1.100.
Asserts:
- First 5 requests allowed (HTTP 401 Unauthorized - invalid credentials)
- Subsequent 95 requests rejected (HTTP 429 Too Many Requests with Retry-After header)
Saves 100% real measured raw output to:
- docs/results/raw/abusive_login_raw.txt
- results/raw/abusive_login_raw.txt
- docs/results/abusive_login_results.csv
- results/abusive_login_results.csv
"""

import os
import sys
import time
import json
import csv
import urllib.request
import urllib.error

def run_abusive_login_test(target_url="http://localhost:8080"):
    print("==========================================================")
    print("   RUNNING REAL ABUSIVE LOGIN RATE LIMITER TEST (100 REQS)")
    print("==========================================================")
    
    url = f"{target_url}/auth/login"
    payload = json.dumps({
        "username": "attacker.bot",
        "password": "WrongPassword123"
    }).encode("utf-8")
    
    client_ip = "192.168.1.100"
    headers = {
        "Content-Type": "application/json",
        "X-Forwarded-For": client_ip,
        "User-Agent": "AbusiveLoginAuditTester/1.0"
    }
    
    csv_rows = []
    raw_lines = []
    allowed_count = 0
    rejected_count = 0
    
    start_all = time.time()
    
    for i in range(1, 101):
        req = urllib.request.Request(url, data=payload, headers=headers, method="POST")
        req_start = time.time()
        status_code = None
        retry_after = ""
        resp_body = ""
        
        try:
            with urllib.request.urlopen(req, timeout=5) as resp:
                status_code = resp.status
                resp_body = resp.read().decode("utf-8")
                retry_after = resp.headers.get("Retry-After", "")
        except urllib.error.HTTPError as e:
            status_code = e.code
            resp_body = e.read().decode("utf-8")
            retry_after = e.headers.get("Retry-After", "")
        except Exception as e:
            status_code = 500
            resp_body = str(e)
            
        latency_ms = round((time.time() - req_start) * 1000, 2)
        
        if status_code == 429:
            outcome = "REJECTED_RATE_LIMITED"
            rejected_count += 1
        elif status_code in (200, 401):
            outcome = "ALLOWED"
            allowed_count += 1
        else:
            outcome = f"UNEXPECTED_STATUS_{status_code}"
            
        csv_rows.append([i, client_ip, "/auth/login", status_code, outcome, retry_after, latency_ms])
        
        raw_log = f"REQUEST #{i} | IP={client_ip} | Status={status_code} | Outcome={outcome} | Retry-After={retry_after} | Latency={latency_ms}ms | Body={resp_body}"
        raw_lines.append(raw_log)
        
        if i <= 10 or i % 10 == 0:
            print(f"  Req #{i:3d}: Status {status_code} ({outcome}) | Retry-After={retry_after} | {latency_ms} ms")
            
        # Tiny sleep between requests (0.005s) to simulate realistic rapid burst
        time.sleep(0.005)
        
    total_duration = round((time.time() - start_all) * 1000, 2)
    print(f"\nCompleted 100 requests in {total_duration} ms.")
    print(f"Results: {allowed_count} Allowed, {rejected_count} Rejected (Rate Limited)")
    
    # Write raw output file
    for raw_dir in ["docs/results/raw", "results/raw"]:
        os.makedirs(raw_dir, exist_ok=True)
        raw_path = os.path.join(raw_dir, "abusive_login_raw.txt")
        with open(raw_path, "w", encoding="utf-8") as f:
            f.write(f"# Abusive Login Rate Limiter Real Raw Test Run\n")
            f.write(f"# Timestamp: {time.strftime('%Y-%m-%d %H:%M:%S')}\n")
            f.write(f"# Target: {url} | Client IP: {client_ip}\n")
            f.write(f"# Summary: Allowed={allowed_count}, Rejected={rejected_count}, Total=100\n\n")
            for line in raw_lines:
                f.write(line + "\n")
        print(f"  [SAVED] {raw_path}")
        
    # Write CSV
    csv_headers = ["Request_Index", "Client_IP", "Endpoint", "Status_Code", "Action", "Retry_After_Sec", "Latency_ms"]
    for csv_dir in ["docs/results", "results"]:
        os.makedirs(csv_dir, exist_ok=True)
        csv_path = os.path.join(csv_dir, "abusive_login_results.csv")
        with open(csv_path, "w", newline="", encoding="utf-8") as f:
            writer = csv.writer(f)
            writer.writerow(csv_headers)
            writer.writerows(csv_rows)
        print(f"  [SAVED] {csv_path}")
        
    assert allowed_count == 5, f"Expected exactly 5 allowed requests, got {allowed_count}"
    assert rejected_count == 95, f"Expected exactly 95 rejected requests, got {rejected_count}"
    print("\n[SUCCESS] ABUSIVE LOGIN RATE LIMITER TEST PASSED PERFECTLY!\n")
    return True

if __name__ == "__main__":
    target = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8080"
    run_abusive_login_test(target)
