import os
import sys
import time
import json
import csv
import subprocess
import threading

AFTER_TUNING_DIR = "docs/results/raw/after_tuning"
os.makedirs(AFTER_TUNING_DIR, exist_ok=True)
os.makedirs("results/raw/after_tuning", exist_ok=True)

PS_EXE = r"C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe"

def get_service_map():
    cmd = 'Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue | Where-Object { $_.LocalPort -in 8080,8081,8082,8083,8090 } | Select-Object LocalPort, OwningProcess | ConvertTo-Json'
    try:
        res = subprocess.run([PS_EXE, "-Command", cmd], capture_output=True, text=True, timeout=10)
        if res.stdout.strip():
            data = json.loads(res.stdout)
            if isinstance(data, dict):
                data = [data]
            svc_map = {}
            for row in data:
                port = row.get("LocalPort")
                pid = row.get("OwningProcess")
                name = "gateway-8080" if port == 8080 else f"node-{port}" if port in (8081, 8082, 8083) else "baseline-8090"
                svc_map[pid] = name
            return svc_map
    except Exception:
        pass
    return {}

def sample_resources(stop_event, out_csv_path):
    svc_map = get_service_map()
    with open(out_csv_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(["Elapsed_Sec", "Service_Name", "PID", "CPU_Percent", "Memory_WorkingSet_MB"])
        start_t = time.time()
        prev_cpu = {}
        prev_time = start_t
        while not stop_event.is_set():
            now = time.time()
            elapsed = round(now - start_t, 1)
            delta_t = max(0.1, now - prev_time)
            prev_time = now

            if not svc_map:
                svc_map = get_service_map()

            ps_cmd = 'Get-Process -Name java -ErrorAction SilentlyContinue | Select-Object Id, CPU, WorkingSet64 | ConvertTo-Json'
            try:
                res = subprocess.run([PS_EXE, "-Command", ps_cmd], capture_output=True, text=True, timeout=5)
                if res.stdout.strip():
                    data = json.loads(res.stdout)
                    if isinstance(data, dict):
                        data = [data]
                    for item in data:
                        pid = item.get("Id")
                        raw_cpu_sec = item.get("CPU", 0.0)
                        rss_mb = round(item.get("WorkingSet64", 0) / (1024 * 1024), 2)
                        svc_name = svc_map.get(pid, f"java-{pid}")
                        
                        # Calculate CPU % over interval
                        if pid in prev_cpu:
                            cpu_pct = round(((raw_cpu_sec - prev_cpu[pid]) / delta_t) * 100.0, 1)
                            cpu_pct = max(0.0, cpu_pct)
                        else:
                            cpu_pct = 0.0
                        prev_cpu[pid] = raw_cpu_sec

                        writer.writerow([elapsed, svc_name, pid, cpu_pct, rss_mb])
                        f.flush()
            except Exception:
                pass
            time.sleep(1.0)

def run_test(system, target_url, vus, duration="15s"):
    prefix = "prop" if system == "Proposed" else "base"
    summary_file = os.path.join(AFTER_TUNING_DIR, f"raw_{prefix}_{vus}.json")
    resource_file = os.path.join(AFTER_TUNING_DIR, f"resource_{prefix}_{vus}.csv")

    print(f"\n========================================================")
    print(f" Running {system} ({target_url}) at {vus} VUs for {duration}")
    print(f"========================================================")

    stop_event = threading.Event()
    sampler_thread = threading.Thread(target=sample_resources, args=(stop_event, resource_file))
    sampler_thread.start()

    cmd = [
        "bin\\k6.exe", "run",
        "--env", f"VUS={vus}",
        "--env", f"DURATION={duration}",
        "--env", f"TARGET_URL={target_url}",
        "--summary-export", summary_file,
        "loadtest/mixed-workload.js"
    ]

    t0 = time.time()
    try:
        proc = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
        print(f"Finished in {round(time.time() - t0, 2)}s with code {proc.returncode}")
    except Exception as e:
        print(f"Error running k6: {e}")
    finally:
        stop_event.set()
        sampler_thread.join()

    # Also copy to results/raw/after_tuning
    if os.path.exists(summary_file):
        with open(summary_file, "r") as src, open(os.path.join("results/raw/after_tuning", f"raw_{prefix}_{vus}.json"), "w") as dst:
            dst.write(src.read())
    if os.path.exists(resource_file):
        with open(resource_file, "r") as src, open(os.path.join("results/raw/after_tuning", f"resource_{prefix}_{vus}.csv"), "w") as dst:
            dst.write(src.read())

    return summary_file

def main():
    runs = [
        ("Proposed", "http://localhost:8080", 50),
        ("Proposed", "http://localhost:8080", 400),
        ("Baseline", "http://localhost:8090", 50),
        ("Baseline", "http://localhost:8090", 400)
    ]

    results = []
    for system, target_url, vus in runs:
        json_file = run_test(system, target_url, vus, duration="15s")
        if os.path.exists(json_file):
            with open(json_file, "r", encoding="utf-8") as f:
                data = json.load(f)
            m = data.get("metrics", {})
            reqs = m.get("http_reqs", {}).get("values", {}).get("count", m.get("http_reqs", {}).get("count", 0))
            rps = round(m.get("http_reqs", {}).get("values", {}).get("rate", m.get("http_reqs", {}).get("rate", 0.0)), 2)
            dur = m.get("http_req_duration", {}).get("values", m.get("http_req_duration", {}))
            p50 = round(dur.get("med", 0.0), 2)
            p95 = round(dur.get("p(95)", 0.0), 2)

            def get_cnt(metric_name):
                return int(m.get(metric_name, {}).get("values", {}).get("count", m.get(metric_name, {}).get("count", 0)))

            c2xx = get_cnt("http_2xx")
            c400 = get_cnt("http_400")
            c401 = get_cnt("http_401")
            c404 = get_cnt("http_404")
            c409 = get_cnt("http_409")
            c429 = get_cnt("http_429_rate_limit")
            c4xx = get_cnt("http_4xx_expected")
            c5xx = get_cnt("http_5xx_server_error")

            # Per endpoint
            login_2xx = get_cnt("ep_login_2xx")
            login_4xx = get_cnt("ep_login_4xx")
            login_429 = get_cnt("ep_login_429")

            bal_2xx = get_cnt("ep_balance_2xx")
            bal_4xx = get_cnt("ep_balance_4xx")
            bal_429 = get_cnt("ep_balance_429")

            trf_2xx = get_cnt("ep_transfer_2xx")
            trf_4xx = get_cnt("ep_transfer_4xx")
            trf_429 = get_cnt("ep_transfer_429")

            bill_2xx = get_cnt("ep_bill_2xx")
            bill_4xx = get_cnt("ep_bill_4xx")
            bill_429 = get_cnt("ep_bill_429")

            hist_2xx = get_cnt("ep_history_2xx")
            hist_4xx = get_cnt("ep_history_4xx")
            hist_429 = get_cnt("ep_history_429")

            results.append({
                "System": system,
                "VUs": vus,
                "Total_Reqs": reqs,
                "Total_RPS": rps,
                "Latency_p50_ms": p50,
                "Latency_p95_ms": p95,
                "HTTP_2xx": c2xx,
                "HTTP_400": c400,
                "HTTP_401": c401,
                "HTTP_404": c404,
                "HTTP_409": c409,
                "HTTP_429": c429,
                "HTTP_4xx_Expected": c4xx,
                "HTTP_5xx": c5xx,
                "Login_2xx": login_2xx, "Login_4xx": login_4xx, "Login_429": login_429,
                "Balance_2xx": bal_2xx, "Balance_4xx": bal_4xx, "Balance_429": bal_429,
                "Transfer_2xx": trf_2xx, "Transfer_4xx": trf_4xx, "Transfer_429": trf_429,
                "Bill_2xx": bill_2xx, "Bill_4xx": bill_4xx, "Bill_429": bill_429,
                "History_2xx": hist_2xx, "History_4xx": hist_4xx, "History_429": hist_429,
            })

    # Save to CSV
    csv_file = "docs/results/endpoint_4xx_breakdown.csv"
    if results:
        fieldnames = list(results[0].keys())
        with open(csv_file, "w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            writer.writerows(results)
        with open("results/endpoint_4xx_breakdown.csv", "w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            writer.writerows(results)
        print(f"\n[SAVED] {csv_file}")

    print("\n========================================================")
    print("   ENDPOINT 4XX BREAKDOWN RESULTS TABLE                  ")
    print("========================================================")
    print(f"{'System':<10} | {'VUs':<4} | {'Total':<6} | {'2xx':<6} | {'429':<5} | {'400':<4} | {'401':<4} | {'404':<4} | {'Trf 2xx':<8} | {'Bill 2xx':<8}")
    print("-" * 80)
    for r in results:
        print(f"{r['System']:<10} | {r['VUs']:<4} | {r['Total_Reqs']:<6} | {r['HTTP_2xx']:<6} | {r['HTTP_429']:<5} | {r['HTTP_400']:<4} | {r['HTTP_401']:<4} | {r['HTTP_404']:<4} | {r['Transfer_2xx']:<8} | {r['Bill_2xx']:<8}")

if __name__ == "__main__":
    main()
