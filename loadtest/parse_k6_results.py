import json
import glob
import os
import csv

def parse_metrics():
    summary_rows = []
    # columns expected: Architecture,Concurrency,Throughput_req_s,p50_ms,p95_ms,p99_ms,Error_rate_pct
    configs = [
        ("Baseline (Single DB)", 50, "results/raw/raw_base_50.json"),
        ("Baseline (Single DB)", 200, "results/raw/raw_base_200.json"),
        ("Baseline (Single DB)", 1000, "results/raw/raw_base_1000.json"),
        ("Proposed (Sharded + Ring)", 50, "results/raw/raw_prop_50.json"),
        ("Proposed (Sharded + Ring)", 200, "results/raw/raw_prop_200.json"),
        ("Proposed (Sharded + Ring)", 1000, "results/raw/raw_prop_1000.json"),
    ]

    for arch, vus, path in configs:
        if not os.path.exists(path):
            print(f"File not found: {path}")
            continue
        with open(path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        metrics = data.get('metrics', {})
        reqs = metrics.get('http_reqs', {})
        dur = metrics.get('http_req_duration', {})
        failed = metrics.get('http_req_failed', {})
        checks = metrics.get('checks', {})
        print(f"DEBUG {arch} {vus}:")
        print(f"   dur: {dur}")
        print(f"   reqs: {reqs}")
        print(f"   failed: {failed}")
        print(f"   checks: {checks}")
        
        # In k6 json summary export:
        # metrics may be directly in values or direct keys
        rate = reqs.get('rate', reqs.get('values', {}).get('rate', 0.0))
        count = reqs.get('count', reqs.get('values', {}).get('count', 0))
        med = dur.get('med', dur.get('values', {}).get('med', 0.0))
        p95 = dur.get('p(95)', dur.get('values', {}).get('p(95)', 0.0))
        p99 = dur.get('p(99)', dur.get('values', {}).get('p(99)', 0.0))
        fail_rate = failed.get('rate', failed.get('values', {}).get('rate', 0.0))
        
        print(f"[{arch} - {vus} VUs] Rate: {rate:.2f} req/s, Count: {count}, p50: {med:.2f}ms, p95: {p95:.2f}ms, p99: {p99:.2f}ms, FailRate: {fail_rate*100:.2f}%")
        
        summary_rows.append({
            "Architecture": arch,
            "Concurrency": vus,
            "Throughput_req_s": round(rate, 2),
            "p50_ms": round(med, 2),
            "p95_ms": round(p95, 2),
            "p99_ms": round(p99, 2),
            "Error_rate_pct": round(fail_rate * 100, 2)
        })

    # Write to both results/benchmark_summary.csv and docs/results/benchmark_summary.csv
    fieldnames = ["Architecture", "Concurrency", "Throughput_req_s", "p50_ms", "p95_ms", "p99_ms", "Error_rate_pct"]
    for out_path in ["results/benchmark_summary.csv", "docs/results/benchmark_summary.csv"]:
        os.makedirs(os.path.dirname(out_path), exist_ok=True)
        with open(out_path, 'w', newline='', encoding='utf-8') as csvfile:
            writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
            writer.writeheader()
            for r in summary_rows:
                writer.writerow(r)
        print(f"Wrote updated summary to {out_path}")

if __name__ == "__main__":
    parse_metrics()
