import urllib.request
import json

for u in ['divya.iyer1', 'sneha.bose2', 'varun.deshmukh3', 'vikram.choudhury4']:
    req = urllib.request.Request(
        'http://localhost:8080/auth/login',
        data=json.dumps({'username': u, 'password': 'Password@123'}).encode(),
        headers={'Content-Type': 'application/json', 'X-Forwarded-For': f'10.0.0.{len(u)}'}
    )
    try:
        with urllib.request.urlopen(req) as resp:
            print(u, "-> Success", resp.getcode())
    except urllib.error.HTTPError as e:
        print(u, "-> HTTPError", e.code, e.read().decode())
    except Exception as e:
        print(u, "-> Exception", e)
