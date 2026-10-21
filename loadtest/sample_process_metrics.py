import subprocess
import os
import json

def get_process_metrics(pid):
    cmd = ['powershell', '-NoProfile', '-Command', 
           f"$p = Get-Process -Id {pid} -ErrorAction SilentlyContinue; if ($p) {{ [PSCustomObject]@{{ CPU = [math]::Round($p.CPU, 2); MemMB = [math]::Round($p.WorkingSet64 / 1MB, 2) }} | ConvertTo-Json -Compress }}"]
    try:
        out = subprocess.check_output(cmd, text=True, timeout=3).strip()
        if out:
            data = json.loads(out)
            return float(data.get('CPU', 0.0)), float(data.get('MemMB', 0.0))
    except Exception:
        pass
    return 0.0, 0.0

if __name__ == '__main__':
    pid = os.getpid()
    cpu, mem = get_process_metrics(pid)
    print(f"PID {pid} -> CPU Sec: {cpu}, Mem MB: {mem}")
