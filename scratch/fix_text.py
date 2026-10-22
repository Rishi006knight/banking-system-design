import re

# 1. Fix report.md LaTeX
with open("docs/report.md", "r", encoding="utf-8") as f:
    content = f.read()

# Replace corrupted \text{ ms}
content = re.sub(r'\\le 10\s*ext\{\s*ms\}', r'\\le 10\\,\\text{ms}', content)
# Replace corrupted \times and \approx
content = re.sub(r'O\(\\log\(N\s*imes 150\)\)\s*pprox 9\)', r'O(\\log(N \\times 150)) \\approx 9)', content)

with open("docs/report.md", "w", encoding="utf-8") as f:
    f.write(content)

print("docs/report.md LaTeX formulas successfully cleaned!")

# 2. Update docs/demo-script.md checkpoint lines 162-163
with open("docs/demo-script.md", "r", encoding="utf-8") as f:
    demo_content = f.read()

# Replace old hand-typed text with dynamic values
old_c6 = "| **6. Failover & Self-Healing** | Gateway detects dead node in 8.92s, adjusts ring, requests re-route with 20/20 success, node recovers in 8.64s | `ServerHealthChecker.java`, `docs/results/failover_metrics.csv` |"
new_c6 = "| **6. Failover & Self-Healing** | Gateway detects dead node in 7.49s, adjusts ring, requests re-route with 20/20 success, node recovers in 9.33s | `ServerHealthChecker.java`, `docs/results/failover_metrics.csv` |"

old_c7 = "| **7. Comparative Performance** | High-concurrency scaling up to 5,529 req/s, 100% balance conservation across 400 accounts with +0.00 drift | `docs/report.md`, `docs/results/benchmark_summary.csv`, Charts in `docs/charts/` |"
new_c7 = "| **7. Comparative Performance** | High-concurrency scaling up to 1,103.91 total req/s (741.55 2xx req/s), 100% balance conservation across 414 accounts with +0.00 drift | `docs/report.md`, `docs/results/benchmark_summary.csv`, Charts in `docs/charts/` |"

demo_content = demo_content.replace(old_c6, new_c6).replace(old_c7, new_c7)

with open("docs/demo-script.md", "w", encoding="utf-8") as f:
    f.write(demo_content)

print("docs/demo-script.md checkpoints successfully updated!")
