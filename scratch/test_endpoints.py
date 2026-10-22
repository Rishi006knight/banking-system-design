import urllib.request
import urllib.error
import json

def test(url, name):
    print(f"Testing {name} ({url})...")
    # 1. Login
    try:
        req = urllib.request.Request(
            f"{url}/auth/login",
            data=json.dumps({"username": "aarav.sharma1", "password": "Password@123"}).encode("utf-8"),
            headers={"Content-Type": "application/json", "X-Forwarded-For": "10.0.0.1"}
        )
        with urllib.request.urlopen(req) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            print("  Login:", resp.status, data.get("primaryAccountId"), str(data.get("token"))[:16])
            token = data.get("token")
            acc = data.get("primaryAccountId")
    except Exception as e:
        print("  Login failed:", e)
        return

    # 2. Balance
    try:
        req = urllib.request.Request(
            f"{url}/accounts/{acc}/balance",
            headers={"Authorization": f"Bearer {token}", "X-Account-Id": acc, "X-Forwarded-For": "10.0.0.1"}
        )
        with urllib.request.urlopen(req) as resp:
            print("  Balance:", resp.status, resp.read().decode("utf-8")[:60])
    except urllib.error.HTTPError as e:
        print("  Balance HTTP error:", e.code, e.read().decode("utf-8"))
    except Exception as e:
        print("  Balance error:", e)

    # 3. Random Account Balances
    for r in ["ACC-0000001", "ACC-0000050", "ACC-0000150", "ACC-0000250", "ACC-0000350"]:
        try:
            req = urllib.request.Request(
                f"{url}/accounts/{r}/balance",
                headers={"Authorization": f"Bearer {token}", "X-Account-Id": r, "X-Forwarded-For": "10.0.0.1"}
            )
            with urllib.request.urlopen(req) as resp:
                print(f"  Balance {r}:", resp.status, resp.headers.get("X-Shard"))
        except urllib.error.HTTPError as e:
            print(f"  Balance {r} HTTP error:", e.code, e.read().decode("utf-8")[:100])

    # 4. Transfers
    for src, dst in [("ACC-0000001", "ACC-0000002"), ("ACC-0000001", "ACC-0000150"), ("ACC-0000001", "ACC-0000250")]:
        try:
            payload = json.dumps({
                "sourceAccountId": src,
                "destAccountId": dst,
                "amountCents": 1,
                "description": "Diagnostic Transfer"
            }).encode("utf-8")
            req = urllib.request.Request(
                f"{url}/transfers",
                data=payload,
                headers={
                    "Content-Type": "application/json",
                    "Authorization": f"Bearer {token}",
                    "X-Account-Id": src,
                    "Idempotency-Key": f"DIAG-{src}-{dst}",
                    "X-Forwarded-For": "10.0.0.1"
                }
            )
            with urllib.request.urlopen(req) as resp:
                print(f"  Transfer {src}->{dst}:", resp.status, resp.read().decode("utf-8")[:60])
        except urllib.error.HTTPError as e:
            print(f"  Transfer {src}->{dst} HTTP error:", e.code, e.read().decode("utf-8")[:100])

    # 5. Bill Payment
    for bill_id in ["BILL-0000001", "BILL-0000002"]:
        try:
            payload = json.dumps({
                "accountId": "ACC-0000001",
                "billId": bill_id
            }).encode("utf-8")
            req = urllib.request.Request(
                f"{url}/billpayments",
                data=payload,
                headers={
                    "Content-Type": "application/json",
                    "Authorization": f"Bearer {token}",
                    "X-Account-Id": "ACC-0000001",
                    "Idempotency-Key": f"DIAG-BILL-{bill_id}",
                    "X-Forwarded-For": "10.0.0.1"
                }
            )
            with urllib.request.urlopen(req) as resp:
                print(f"  Bill {bill_id}:", resp.status, resp.read().decode("utf-8")[:60])
        except urllib.error.HTTPError as e:
            print(f"  Bill {bill_id} HTTP error:", e.code, e.read().decode("utf-8")[:100])

if __name__ == "__main__":
    test("http://localhost:8080", "PROPOSED")
    print("------------------------------------------")
    test("http://localhost:8090", "BASELINE")
