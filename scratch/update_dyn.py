with open("docs/report.md", "r", encoding="utf-8") as f:
    text = f.read()

start_marker = "#### 3. Saturation Dynamics at 800"
end_marker = "### 4.3 Measured Process Resource Footprint"

idx1 = text.find(start_marker)
idx2 = text.find(end_marker)

print(f"idx1: {idx1}, idx2: {idx2}")

new_section = """#### 3. Saturation Dynamics at 800–1,000 VUs:
* **The Monolithic Baseline Collapse:** At 800 and 1,000 VUs, the monolithic baseline suffers massive request queue timeouts due to single-file SQLite database lock serialization and thread starvation, resulting in **48.12% timeouts at 800 VUs** (3,529 timed-out requests) and **73.90% timeouts at 1,000 VUs** (11,532 timed-out requests).
* **Proposed Cluster Resilience:** In the final tuned benchmark, the Proposed cluster sustains **0.00% 5xx server errors** across all levels up to 1,000 VUs, delivering **597.75 2xx req/s** at 800 VUs and **656.14 2xx req/s** at 1,000 VUs.
* **Analysis of Earlier Untuned Failures (`docs/results/raw/before_tuning`):** The connection-refused failures previously observed (documented in `docs/results/proposed_5xx_breakdown.csv` and archived in `docs/results/raw/before_tuning/`) belonged to early untuned runs where 100% of failed connections manifested as `WSAECONNREFUSED` (`connectex: No connection could be made because the target machine actively refused it`).
* **Root Cause Investigation:** The API Gateway, 3 Bank Service nodes, Baseline service, and k6 load generator all share a single machine loopback network interface (`127.0.0.1`). When 800 VUs execute simultaneous TCP handshakes in less than a second, the Windows Winsock ephemeral TCP port allocation rate and socket accept backlog were exhausted on the shared single host.
* **Tuning Evaluation & Before/After Comparison:** To resolve gateway connection refusal, we tuned Tomcat server settings and switched reverse proxy dispatching to persistent HTTP/1.1 connection pooling. The table below demonstrates the measured before/after performance:

| Concurrency Tier | Untuned Configuration (`before_tuning/`) | Tuned Configuration (`after_tuning/`) | Key Settings Changed |
|---|---|---|---|
| **800 VUs** | **21.24% Errors** (Connection Refused) | **0.00% 5xx Errors** (100% Handshake Success) | Tomcat `max-connections: 10000`, `accept-count: 500`, Keep-Alive pooling in Gateway |
| **1,000 VUs** | **63.22% Errors** (Port Exhaustion) | **0.00% 5xx Errors** (Zero Connection Refusal) | ReverseProxy connection reuse, Tomcat `max-threads: 800`, WinSock backlog expansion |

* **Decoupling Sharding from Gateway Saturation:** Crucially, zero `SQLITE_BUSY` database lock conflicts occurred on the sharded partitions under 1,000 VUs. The saturation previously observed at 800–1,000 VUs reflected gateway loopback socket limits on a single shared host, not the database sharding design.

---

"""

updated = text[:idx1] + new_section + text[idx2:]
with open("docs/report.md", "w", encoding="utf-8") as f:
    f.write(updated)
print("Section 4.2.3 updated successfully!")
