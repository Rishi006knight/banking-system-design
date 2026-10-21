import subprocess

ps_path = r"C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe"
cmd = f'"{ps_path}" -NoProfile -Command "Get-Process -Name python -ErrorAction SilentlyContinue | Select-Object Id, CPU, WorkingSet64 | ConvertTo-Json -Compress"'
out = subprocess.check_output(cmd, shell=True, text=True).strip()
print("POWERSHELL OUT:", out)
