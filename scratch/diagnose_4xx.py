import urllib.request
import urllib.error
import json
import random

def simulate_vu_workload(target_url, vu_count=5, iterations=20):
    print(f"\n========================================================")
    print(f" Simulating Workload against {target_url} ({vu_count} VUs, {iterations} iters)")
    print(f"========================================================")
    status_counts = {}
    endpoint_status = {}

    for vu_id in range(1, vu_count + 1):
        octet2 = vu_id // 254
        octet3 = (vu_id % 254) + 1
        client_ip = f"10.0.{octet2}.{octet3}"
        headers = {"X-Forwarded-For": client_ip}

        # 1. Login attempt
        user_num = ((vu_id - 1) % 200) + 1
        login_payload = json.dumps({"username": f"aarav.sharma{user_num}", "password": "Password@123"}).encode('utf-8')
        req = urllib.request.Request(f"{target_url}/auth/login", data=login_payload, headers=dict(headers, **{"Content-Type": "application/json"}))
        try:
            with urllib.request.urlopen(req) as resp:
                st = resp.status
                body = json.loads(resp.read().decode('utf-8'))
                token = body.get('token', f"session-token-{vu_id}")
                acc_id = body.get('primaryAccountId', f"ACC-{random.randint(1, 400):07d}")
        except urllib.error.HTTPError as e:
            st = e.code
            err_body = e.read().decode('utf-8')[:80]
            token = f"session-token-{vu_id}"
            acc_id = f"ACC-{random.randint(1, 400):07d}"
        except Exception as e:
            st = 0
            token = f"session-token-{vu_id}"
            acc_id = f"ACC-{random.randint(1, 400):07d}"

        ep_key = ("/auth/login", st)
        endpoint_status[ep_key] = endpoint_status.get(ep_key, 0) + 1
        status_counts[st] = status_counts.get(st, 0) + 1

        auth_headers = dict(headers, **{"Authorization": f"Bearer {token}"})

        for it in range(iterations):
            r = random.random()
            if r < 0.60:
                # Balance
                acc = acc_id
                req = urllib.request.Request(f"{target_url}/accounts/{acc}/balance", headers=dict(auth_headers, **{"X-Account-Id": acc}))
                uri = "/accounts/:id/balance"
            elif r < 0.85:
                # Transfer
                src = acc_id
                dst = f"ACC-{random.randint(1, 400):07d}"
                while dst == src:
                    dst = f"ACC-{random.randint(1, 400):07d}"
                payload = json.dumps({"sourceAccountId": src, "destAccountId": dst, "amountCents": 1, "description": "Benchmark Transfer"}).encode('utf-8')
                req = urllib.request.Request(f"{target_url}/transfers", data=payload, headers=dict(auth_headers, **{
                    "Content-Type": "application/json",
                    "Idempotency-Key": f"K6-TRF-{vu_id}-{it}-{random.randint(1000,9999)}",
                    "X-Account-Id": src
                }))
                uri = "/transfers"
            elif r < 0.95:
                # Bill
                acc = acc_id
                bill_id = f"BILL-{random.randint(1, 20):07d}"
                payload = json.dumps({"accountId": acc, "billId": bill_id}).encode('utf-8')
                req = urllib.request.Request(f"{target_url}/billpayments", data=payload, headers=dict(auth_headers, **{
                    "Content-Type": "application/json",
                    "Idempotency-Key": f"K6-BILL-{vu_id}-{it}-{random.randint(1000,9999)}",
                    "X-Account-Id": acc
                }))
                uri = "/billpayments"
            else:
                # Transactions
                acc = acc_id
                req = urllib.request.Request(f"{target_url}/accounts/{acc}/transactions", headers=dict(auth_headers, **{"X-Account-Id": acc}))
                uri = "/accounts/:id/transactions"

            try:
                with urllib.request.urlopen(req) as resp:
                    st = resp.status
            except urllib.error.HTTPError as e:
                st = e.code
                err_body = e.read().decode('utf-8')[:60]
                if st != 429:
                    # Print first 5 non-429 errors
                    print(f"  [4xx] {uri} -> HTTP {st}: {err_body}")
            except Exception as e:
                st = 0

            ep_key = (uri, st)
            endpoint_status[ep_key] = endpoint_status.get(ep_key, 0) + 1
            status_counts[st] = status_counts.get(st, 0) + 1

    print("\nStatus code distribution:")
    for st, count in sorted(status_counts.items()):
        print(f"  HTTP {st}: {count}")

    print("\nEndpoint breakdown:")
    for (ep, st), count in sorted(endpoint_status.items()):
        print(f"  {ep} -> HTTP {st}: {count}")

if __name__ == "__main__":
    simulate_vu_workload("http://localhost:8080", vu_count=5, iterations=30)
    simulate_vu_workload("http://localhost:8090", vu_count=5, iterations=30)
