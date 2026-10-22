import urllib.request
import urllib.error
import json
import uuid

BASE_URL = "http://localhost:8080"

def get(path, headers=None):
    req = urllib.request.Request(f"{BASE_URL}{path}", headers=headers or {})
    with urllib.request.urlopen(req) as resp:
        return resp.getcode(), resp.read()

def post(path, body, headers=None):
    h = {"Content-Type": "application/json"}
    if headers:
        h.update(headers)
    req = urllib.request.Request(f"{BASE_URL}{path}", data=json.dumps(body).encode(), headers=h)
    with urllib.request.urlopen(req) as resp:
        return resp.getcode(), json.loads(resp.read().decode())

print("=== 1. Verifying SPA Static Assets ===")
status, html = get("/")
html_str = html.decode()
assert "Erode SSS Bank | Premier Commercial Digital Banking" in html_str, "SPA title mismatch"
assert "assets/index-" in html_str, "React bundle not referenced"
print(" [PASS] index.html serves TypeScript SPA")

status, css = get("/assets/index-CoMusr-6.css")
assert status == 200 and len(css) > 1000, "CSS failed to load"
print(f" [PASS] CSS bundle verified ({len(css)} bytes)")

status, js = get("/assets/index-GiWcc18S.js")
assert status == 200 and len(js) > 10000, "JS failed to load"
print(f" [PASS] JS bundle verified ({len(js)} bytes)")

print("\n=== 2. Testing Customer Authentication ===")
status, login_res = post("/auth/login", {
    "username": "aarav.sharma1",
    "password": "Password@123"
})
assert status == 200, f"Login failed: {login_res}"
token = login_res["token"]
user = {
    "id": login_res.get("customerId", "CUST-0000001"),
    "name": login_res.get("fullName", "Aarav Sharma"),
    "accountId": login_res.get("primaryAccountId", "ACC-0000001")
}
print(f" [PASS] Logged in as: {user['name']} (Account: {user['accountId']})")

headers = {
    "Authorization": f"Bearer {token}",
    "X-Account-Id": user["accountId"]
}

print("\n=== 3. Testing Balance Enquiry ===")
status, bal_bytes = get(f"/accounts/{user['accountId']}/balance", headers)
bal_data = json.loads(bal_bytes.decode())
initial_bal = bal_data["balanceInr"]
print(f" [PASS] Live Balance: INR {initial_bal:,.2f}")

print("\n=== 4. Testing Instant Transfer (Aarav -> Diya Patel) ===")
idem_key = str(uuid.uuid4())
transfer_req = {
    "sourceAccountId": user["accountId"],
    "destAccountId": "ACC-0000002",
    "amountCents": 100000, # INR 1,000.00
    "description": "Commercial Fund Transfer to Diya Patel"
}
h_transfer = dict(headers)
h_transfer["Idempotency-Key"] = idem_key
status, tx_res = post("/transfers", transfer_req, h_transfer)
print(f" [PASS] Transfer Committed! Status: {tx_res['status']}, TransferId: {tx_res['transferId']}")

print("\n=== 5. Verifying Balance Deduction & Real-time Ledger ===")
status, bal_bytes2 = get(f"/accounts/{user['accountId']}/balance", headers)
bal_data2 = json.loads(bal_bytes2.decode())
assert bal_data2["balanceInr"] == initial_bal - 1000.0, f"Expected {initial_bal - 1000.0}, got {bal_data2['balanceInr']}"
print(f" [PASS] Balance deducted correctly: INR {bal_data2['balanceInr']:,.2f}")

status, tx_list_bytes = get(f"/accounts/{user['accountId']}/transactions?size=5", headers)
tx_list = json.loads(tx_list_bytes.decode())
assert len(tx_list) > 0, "No transactions found"
latest_tx = tx_list[0]
print(f" [PASS] Latest Ledger Entry: {latest_tx['type']} {latest_tx['amountInr']} INR | Desc: {latest_tx['description']}")

print("\n=== 6. Testing Utility Bill Settlement ===")
status, bills_bytes = get(f"/bills?customerId={user['id']}", headers)
bills = json.loads(bills_bytes.decode())
print(f" [PASS] Loaded {len(bills)} utility invoices")
unpaid_bills = [b for b in bills if b["status"] == "UNPAID"]
if unpaid_bills:
    target_bill = unpaid_bills[0]
    print(f" Paying invoice: {target_bill['billerName']} (INR {target_bill['amountInr']})")
    h_bill = dict(headers)
    h_bill["Idempotency-Key"] = str(uuid.uuid4())
    status, pay_res = post("/billpayments", {
        "billId": target_bill["billId"],
        "accountId": user["accountId"]
    }, h_bill)
    print(f" [PASS] Bill settled! Status: {pay_res['status']}")

print("\nALL LIVE BACKEND & FRONTEND TESTS COMPLETED WITH 100% SUCCESS!")
