#!/usr/bin/env python3
"""
Automated Smoke Test for UCS3513 System Design Laboratory (Mini Project 7)
Verifies that 100% of REST API endpoints respond with 200/201 and 0 errors:
- Registration & Login
- Account & Balance Inquiries
- Beneficiary Addition & Listing
- Same-Shard and Cross-Shard Transfers
- Bill Listing & Utility Bill Payment
- Transaction History
Can be executed against Proposed (:8080) and Monolithic Baseline (:8090).
"""

import sys
import json
import time
import uuid
import urllib.request
import urllib.error

def request(method, url, body=None, headers=None):
    if headers is None:
        headers = {}
    if 'Content-Type' not in headers and body is not None:
        headers['Content-Type'] = 'application/json'
    
    data = None
    if body is not None:
        if isinstance(body, (dict, list)):
            data = json.dumps(body).encode('utf-8')
        elif isinstance(body, str):
            data = body.encode('utf-8')
        else:
            data = body
            
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            resp_body = resp.read().decode('utf-8')
            try:
                parsed = json.loads(resp_body)
            except Exception:
                parsed = resp_body
            return resp.status, parsed
    except urllib.error.HTTPError as e:
        err_body = e.read().decode('utf-8')
        try:
            parsed = json.loads(err_body)
        except Exception:
            parsed = err_body
        return e.code, parsed
    except Exception as e:
        return 500, {"error": str(e)}

def run_smoke_test(target_url, name="Target"):
    print(f"\n{'='*65}")
    print(f" SMOKE TEST: {name} ({target_url})")
    print(f"{'='*65}")
    
    passes = 0
    failures = 0
    unique_suffix = str(int(time.time()))[-6:] + str(uuid.uuid4())[:4]
    
    # 1. Register User A
    user_a = f"smoke_user_a_{unique_suffix}"
    reg_payload_a = {
        "username": user_a,
        "password": "Password@123",
        "email": f"{user_a}@smoke.test",
        "fullName": "Smoke Tester Alpha",
        "initialDepositCents": 500000 # INR 5000.00
    }
    status, res = request("POST", f"{target_url}/auth/register", reg_payload_a)
    if status == 201 and "primaryAccountId" in res:
        print(f"  [PASS] POST /auth/register (User A): HTTP {status} (Account: {res.get('primaryAccountId')})")
        passes += 1
        account_a = res["primaryAccountId"]
        customer_a = res.get("customerId")
        token_a = res.get("token")
    else:
        print(f"  [FAIL] POST /auth/register (User A): HTTP {status} - {res}")
        failures += 1
        return False
        
    # 2. Register User B (for transfer target)
    user_b = f"smoke_user_b_{unique_suffix}"
    reg_payload_b = {
        "username": user_b,
        "password": "Password@123",
        "email": f"{user_b}@smoke.test",
        "fullName": "Smoke Tester Beta",
        "initialDepositCents": 100000 # INR 1000.00
    }
    status, res = request("POST", f"{target_url}/auth/register", reg_payload_b)
    if status == 201 and "primaryAccountId" in res:
        print(f"  [PASS] POST /auth/register (User B): HTTP {status} (Account: {res.get('primaryAccountId')})")
        passes += 1
        account_b = res["primaryAccountId"]
    else:
        print(f"  [FAIL] POST /auth/register (User B): HTTP {status} - {res}")
        failures += 1
        return False

    # 3. Login User A
    login_payload = {
        "username": user_a,
        "password": "Password@123"
    }
    status, res = request("POST", f"{target_url}/auth/login", login_payload)
    if status == 200 and "token" in res:
        print(f"  [PASS] POST /auth/login: HTTP {status} (Token: {str(res.get('token'))[:16]}...)")
        passes += 1
    else:
        print(f"  [FAIL] POST /auth/login: HTTP {status} - {res}")
        failures += 1

    # 4. Get Balance
    status, res = request("GET", f"{target_url}/accounts/{account_a}/balance", headers={"X-Account-Id": account_a})
    if status == 200 and "balanceCents" in res:
        print(f"  [PASS] GET /accounts/{{id}}/balance: HTTP {status} (Balance: {res.get('balanceCents')} paise)")
        passes += 1
    else:
        print(f"  [FAIL] GET /accounts/{{id}}/balance: HTTP {status} - {res}")
        failures += 1

    # 5. Add Beneficiary
    ben_payload = {
        "name": "Jane Beneficiary",
        "accountNumber": "999888777",
        "bankCode": "HDFC0001"
    }
    status, res = request("POST", f"{target_url}/beneficiaries?customerId={customer_a}", ben_payload)
    if status == 201:
        print(f"  [PASS] POST /beneficiaries: HTTP {status}")
        passes += 1
    else:
        print(f"  [FAIL] POST /beneficiaries: HTTP {status} - {res}")
        failures += 1

    # 6. List Beneficiaries
    status, res = request("GET", f"{target_url}/beneficiaries?customerId={customer_a}")
    if status == 200 and isinstance(res, list) and len(res) >= 1:
        print(f"  [PASS] GET /beneficiaries: HTTP {status} ({len(res)} items)")
        passes += 1
    else:
        print(f"  [FAIL] GET /beneficiaries: HTTP {status} - {res}")
        failures += 1

    # 7. Execute Transfer (Account A -> Account B)
    trf_payload = {
        "sourceAccountId": account_a,
        "destAccountId": account_b,
        "amountCents": 1000, # INR 10.00
        "description": "Smoke Test Transfer"
    }
    idem_key_trf = f"SMOKE-TRF-{uuid.uuid4()}"
    status, res = request("POST", f"{target_url}/transfers", trf_payload, headers={
        "Idempotency-Key": idem_key_trf,
        "X-Account-Id": account_a
    })
    if status == 200 and res.get("status") == "COMPLETED":
        print(f"  [PASS] POST /transfers: HTTP {status} (TransferId: {res.get('transferId')})")
        passes += 1
    else:
        print(f"  [FAIL] POST /transfers: HTTP {status} - {res}")
        failures += 1

    # 8. List Bills / Billers
    status, res = request("GET", f"{target_url}/bills?customerId={customer_a}")
    if status == 200:
        print(f"  [PASS] GET /bills: HTTP {status}")
        passes += 1
    else:
        print(f"  [FAIL] GET /bills: HTTP {status} - {res}")
        failures += 1

    # 9. Pay Utility Bill
    bill_payload = {
        "accountId": account_a,
        "billId": f"BILL-SMOKE-{unique_suffix}"
    }
    idem_key_bill = f"SMOKE-BILL-{uuid.uuid4()}"
    status, res = request("POST", f"{target_url}/billpayments", bill_payload, headers={
        "Idempotency-Key": idem_key_bill,
        "X-Account-Id": account_a
    })
    if status == 200 and res.get("status") == "PAID":
        print(f"  [PASS] POST /billpayments: HTTP {status} (Bill: {res.get('billId')}, Status: PAID)")
        passes += 1
    else:
        print(f"  [FAIL] POST /billpayments: HTTP {status} - {res}")
        failures += 1

    # 10. Check Transaction History
    status, res = request("GET", f"{target_url}/accounts/{account_a}/transactions", headers={"X-Account-Id": account_a})
    if status == 200 and isinstance(res, list) and len(res) >= 2:
        print(f"  [PASS] GET /accounts/{{id}}/transactions: HTTP {status} ({len(res)} transactions logged)")
        passes += 1
    else:
        print(f"  [FAIL] GET /accounts/{{id}}/transactions: HTTP {status} - {res}")
        failures += 1

    print(f"\nSummary for {name}: {passes} Passed, {failures} Failed")
    return failures == 0

def main():
    target = sys.argv[1] if len(sys.argv) > 1 else "all"
    
    all_ok = True
    if target in ("proposed", "all"):
        ok = run_smoke_test("http://localhost:8080", "Proposed System (API Gateway + Shards)")
        if not ok:
            all_ok = False
            
    if target in ("baseline", "all"):
        ok = run_smoke_test("http://localhost:8090", "Monolithic Baseline (Single SQLite DB)")
        if not ok:
            all_ok = False
            
    if all_ok:
        print("\n[SUCCESS] ALL SMOKE TESTS PASSED WITH 0 ERRORS!\n")
        sys.exit(0)
    else:
        print("\n[FAILURE] SMOKE TESTS FAILED!\n")
        sys.exit(1)

if __name__ == "__main__":
    main()
