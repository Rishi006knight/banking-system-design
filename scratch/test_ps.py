import subprocess
import json

ps = r"C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe"
ports = [8080, 8081, 8082, 8083, 8090]
svc_map = {}

cmd = 'Get-NetTCPConnection -State Listen | Where-Object { $_.LocalPort -in 8080,8081,8082,8083,8090 } | Select-Object LocalPort, OwningProcess | ConvertTo-Json'
res = subprocess.run([ps, "-Command", cmd], capture_output=True, text=True)
if res.stdout.strip():
    data = json.loads(res.stdout)
    if isinstance(data, dict):
        data = [data]
    for row in data:
        port = row.get("LocalPort")
        pid = row.get("OwningProcess")
        name = "gateway-8080" if port == 8080 else f"node-{port}" if port in (8081, 8082, 8083) else "baseline-8090"
        svc_map[pid] = (name, port)

print("Service Map by PID:", svc_map)
