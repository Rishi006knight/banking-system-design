import csv
import json
import random
import sys
import time
import urllib.request
import urllib.error
from concurrent.futures import ThreadPoolExecutor

BASE_URL = "http://localhost:8080"
OUTPUT_CSV = "docs/results/raw/proposed_5xx_breakdown.csv"

def get_random_account():
    num = random.randint(1, 400)
    return f"ACC-{num:07d}"

def execute_request(req_id, vu_id):
    endpoint_type = random.choice(["transfer", "billpayment"])
    timestamp = time.strftime("%Y-%m-%d %H:%M:%S")
    headers = {
        "Content-Type": "application/json",
        "X-Forwarded-For": f"10.0.{vu_id // 254}.{(vu_id % 254) + 1}",
        "Authorization": f"Bearer session-token-repro-{vu_id}"
    }

    if endpoint_type == "transfer":
        src = get_random_account()
        dst = get_random_account()
        while dst == src:
            dst = get_random_account()
        endpoint = "/transfers"
        headers["Idempotency-Key"] = f"REPRO-TRF-{vu_id}-{req_id}-{time.time()}"
        headers["X-Account-Id"] = src
        payload = {
            "sourceAccountId": src,
            "destAccountId": dst,
            "amountCents": 1,
            "description": "5xx Repro Transfer"
        }
    else:
        acc = get_random_account()
        bill_num = random.randint(1, 20)
        endpoint = "/billpayments"
        headers["Idempotency-Key"] = f"REPRO-BILL-{vu_id}-{req_id}-{time.time()}"
        headers["X-Account-Id"] = acc
        payload = {
            "accountId": acc,
            "billId": f"BILL-{bill_num:07d}"
        }

    url = BASE_URL + endpoint
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(url, data=data, headers=headers)

    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            return None
    except urllib.error.HTTPError as e:
        status = e.code
        body = e.read().decode("utf-8", errors="replace")
        if status >= 500:
            root_cause = "Unknown 5xx"
            try:
                parsed = json.loads(body)
                err_msg = parsed.get("error", "") or parsed.get("message", "")
                if "SQLITE_BUSY" in err_msg or "locked" in err_msg:
                    root_cause = "SQLite Database File Locked (SQLITE_BUSY)"
                elif "Compensating refund executed" in err_msg:
                    root_cause = "Cross-Shard Saga Destination Failure"
                elif "timeout" in err_msg.lower():
                    root_cause = "Proxy or Execution Timeout"
                else:
                    root_cause = err_msg[:120]
            except Exception:
                root_cause = body[:120]
            
            return {
                "Timestamp": timestamp,
                "VU_ID": vu_id,
                "Endpoint": endpoint,
                "HTTP_Status": status,
                "Root_Cause_Category": root_cause,
                "Response_Body": body.replace("\n", " ").replace(",", ";")[:250]
            }
        return None
    except Exception as e:
        return {
            "Timestamp": timestamp,
            "VU_ID": vu_id,
            "Endpoint": endpoint,
            "HTTP_Status": 504,
            "Root_Cause_Category": "Client Timeout or Connection Refused",
            "Response_Body": str(e).replace("\n", " ").replace(",", ";")[:250]
        }

def main():
    print("Starting 50 VU reproduction load test against Proposed Cluster...")
    errors = []
    total_requests = 1000
    vus = 50

    with ThreadPoolExecutor(max_workers=vus) as executor:
        futures = [executor.submit(execute_request, i, i % vus + 1) for i in range(total_requests)]
        for f in futures:
            res = f.result()
            if res:
                errors.append(res)
                print(f"[5xx DETECTED] {res['Endpoint']} -> Status {res['HTTP_Status']}: {res['Root_Cause_Category']}")

    print(f"\nCompleted {total_requests} requests. Found {len(errors)} 5xx errors ({len(errors)/total_requests*100:.2f}%).")
    
    with open(OUTPUT_CSV, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=["Timestamp", "VU_ID", "Endpoint", "HTTP_Status", "Root_Cause_Category", "Response_Body"])
        writer.writeheader()
        writer.writerows(errors)
    
    print(f"Logged 5xx breakdown to {OUTPUT_CSV}")

if __name__ == "__main__":
    main()
