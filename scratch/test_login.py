import urllib.request, urllib.error, json

req = urllib.request.Request(
    'http://localhost:8080/auth/login',
    data=json.dumps({'username': 'vikram.choudhury4', 'password': 'Password@123'}).encode('utf-8'),
    headers={'Content-Type': 'application/json', 'X-Forwarded-For': '192.168.1.55'}
)
try:
    with urllib.request.urlopen(req) as resp:
        print("Status:", resp.status, resp.read().decode('utf-8'))
except urllib.error.HTTPError as e:
    print('HTTPError:', e.code, e.read().decode('utf-8'))
except Exception as e:
    print('Error:', e)
