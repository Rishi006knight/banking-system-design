import urllib.request, urllib.error, json

token = "Q1VTVC0wMDAwMDE6ZGl2eWEuaXllcjE6QUNDLTAwMDAwMDE6MTc5MjY0NjI0MTMwMw.NGwb2LuopzdCEU46Nz_pULfdJ3azAD63_0GKASE_OZg"

for port in [8081, 8082, 8083]:
    url = f"http://localhost:{port}/accounts/ACC-0000001/balance"
    req = urllib.request.Request(url, headers={"Authorization": f"Bearer {token}", "X-Account-Id": "ACC-0000001"})
    try:
        with urllib.request.urlopen(req) as resp:
            print(f"Node :{port} balance check:", resp.status, resp.read().decode('utf-8'))
    except urllib.error.HTTPError as e:
        print(f"Node :{port} error:", e.code, e.read().decode('utf-8'))
