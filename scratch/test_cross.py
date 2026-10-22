import urllib.request
import json

token = 'Q1VTVC0wMDAwMDE6ZGl2eWEuaXllcjE6QUNDLTAwMDAwMDE6MTc5MjY0NzYxNTg2OA.Vx9PhRPaANJ0TJQwAsEbW53VJfR7aRurahYf_MQmpHM'
req = urllib.request.Request(
    'http://localhost:8080/transfers',
    data=json.dumps({
        'sourceAccountId': 'ACC-0000005',
        'destAccountId': 'ACC-0000001',
        'amountCents': 100,
        'description': 'Cross shard smoke test'
    }).encode(),
    headers={
        'Authorization': 'Bearer ' + token,
        'Content-Type': 'application/json',
        'Idempotency-Key': 'SMOKE-CROSS-1'
    }
)

try:
    with urllib.request.urlopen(req) as resp:
        print("Success:", resp.getcode(), resp.read().decode())
except urllib.error.HTTPError as e:
    print("HTTPError Code:", e.code, "Body:", e.read().decode())
except Exception as e:
    print("Exception:", e)
