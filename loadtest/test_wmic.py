import subprocess
import os

def test_wmic(pid):
    cmd = f'wmic path Win32_PerfFormattedData_PerfProc_Process where IDProcess={pid} get PercentProcessorTime /value'
    try:
        out = subprocess.check_output(cmd, shell=True, text=True, timeout=3).strip()
        print("WMIC OUT:", out)
    except Exception as e:
        print("WMIC ERR:", e)

if __name__ == '__main__':
    test_wmic(os.getpid())
