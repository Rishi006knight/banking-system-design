import json
import time
import urllib.request
import urllib.error

def main():
    url = "http://localhost:8080/auth/login"
    client_ip = "192.168.1.188"
    headers = {
        "Content-Type": "application/json",
        "X-Forwarded-For": client_ip
    }
    payload = json.dumps({"username": "attacker.bot", "password": "WrongPassword123"}).encode("utf-8")

    results = []
    print(f"==================================================================")
    print(f"VERIFYING ABUSIVE LOGIN & DYNAMIC RETRY-AFTER COUNTDOWN (100 REQS)")
    print(f"Target: {url} | Client IP: {client_ip}")
    print(f"Policy: STRICT_LOGIN (Capacity: 5 tokens, Refill: 5 tokens/min)")
    print(f"==================================================================")

    for i in range(1, 101):
        req = urllib.request.Request(url, data=payload, headers=headers)
        t0 = time.time()
        try:
            with urllib.request.urlopen(req, timeout=5) as resp:
                status = resp.status
                retry_after = resp.headers.get("Retry-After", "")
        except urllib.error.HTTPError as e:
            status = e.code
            retry_after = e.headers.get("Retry-After", "")
        except Exception as e:
            status = 500
            retry_after = ""
        
        latency_ms = int((time.time() - t0) * 1000)
        decision = "REJECTED_RATE_LIMITED" if status == 429 else "ALLOWED"
        line = f"TRACE_REQ:{i},{client_ip},/auth/login,{status},{decision},{retry_after},{latency_ms}ms"
        results.append(line)
        print(line)

        # Pace requests after initial burst to demonstrate dynamic countdown
        if i >= 5:
            time.sleep(0.18)

    output_path = "docs/results/raw/abusive_login_raw.txt"
    with open(output_path, "w", encoding="utf-8") as f:
        f.write("\n".join(results) + "\n")
    print("==================================================================")
    print(f"Saved full 100-request raw log to {output_path}")

if __name__ == "__main__":
    main()
