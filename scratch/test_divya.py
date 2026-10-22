import urllib.request, urllib.error, json

for port in [8080, 8090]:
    url = f"http://localhost:{port}/auth/login"
    payload = json.dumps({"username": "divya.iyer1", "password": "Password@123"}).encode('utf-8')
    req = urllib.request.Request(url, data=payload, headers={"Content-Type": "application/json", "X-Forwarded-For": "10.0.0.1"})
    try:
        with urllib.request.urlopen(req) as resp:
            print(f"Port {port} login:", resp.status, resp.read().decode('utf-8'))
    except urllib.error.HTTPError as e:
        print(f"Port {port} error:", e.code, e.read().decode('utf-8'))
    except Exception as e:
        print(f"Port {port} fail:", e)
