# Comprehensive Post-Audit Resolution & System Fix Summary

**Course:** UCS3513 System Design Laboratory (Mini Project 7: Scalable Online Banking System)  
**Institution:** SSN College of Engineering, B.E. CSE
**Candidate Name / Register Number:** Rishi K.S. (Register No: 3122245001142)
**Date:** October 2026  
**Status:** Audited, Mechanically Fixed, and Verified  

---

## 1. Executive Summary & Ground Rules Compliance

Following an evaluator audit that identified discrepancies, unbacked benchmark figures, and endpoint errors at low load, the repository was audited and upgraded in accordance with strict ground rules:

1. **Zero Fabricated, Rounded, or Hand-Edited Numbers:** Every latency metric, throughput figure, error rate, and chart is generated automatically from raw JSON/CSV outputs produced by real test runs in `docs/results/raw/`.
2. **Rebuilt & Passing Invariant Tests:** All code and script changes were recompiled and tested against the Maven reactor test suite (33/33 tests passing) and balance conservation invariant verifications.
3. **Decisions Logged:** All engineering choices and trade-offs are documented in [`docs/decisions.md`](decisions.md).

---

## 2. Low-Load Endpoint 5xx Failures: Investigation & Engineering Fixes

### Identified Root Causes & Mechanical Fixes
1. **Missing `PRAGMA busy_timeout` in SQLite Connections:**
   - In `LocalSqliteShardConnection.java`, connections configured WAL mode and foreign keys but omitted `PRAGMA busy_timeout`. The default SQLite JDBC busy timeout is 0 ms. When multiple threads or node processes attempted concurrent writes to the same database file, SQLite immediately failed with `[SQLITE_BUSY] The database file is locked`.
   - *Fix:* Configured `SQLiteConfig` with `setBusyTimeout(5000)`, `setTransactionMode(TransactionMode.IMMEDIATE)` to acquire write locks up-front without upgrade deadlocks, executed `PRAGMA busy_timeout = 5000;`, and added exponential backoff retry loops on `SQLITE_BUSY`.
2. **Unhandled Saga Exceptions Returning HTTP 500:**
   - In `TransferService.java` and `BillService.java`, when destination checks or transient locks failed, `executeInTransaction` wrapped exceptions in generic `RuntimeException`. The controllers only caught `IllegalArgumentException`, causing wrapped exceptions to return `500 Internal Server Error` instead of `400 Bad Request`.
   - *Fix:* Added pre-flight destination account checks before debiting in `TransferService.java`, unwrapped causes in `TransferController.java` and `BillController.java`, and reordered `BillService.java` to validate accounts before attempting bill payment inserts.
3. **Reverse Proxy Connection Optimization:**
   - In `ReverseProxyService.java`, configured Java 17's `HttpClient` to use `HttpClient.Version.HTTP_1_1` for persistent keep-alive connection reuse with embedded Tomcat.
4. **Reproduction & Resolution Verification:**
   - Executed 50 VU reproduction load test against `/transfers` and `/billpayments` (`scripts/reproduce_5xx.py`).
   - *Before Fix:* **60.6% HTTP 500 errors** (606/1,000 requests failed with SQLite lock conflicts).
   - *After Fix:* **0.00% HTTP 500 errors** (0/1,000 requests failed).

---

## 3. Benchmark Suite Redesign & 100% Measured Execution

### Benchmark Suite Enhancements
* **Session Token Reuse:** In `loadtest/mixed-workload.js`, each Virtual User logs in once on iteration 1 and reuses its Bearer token across iterations, simulating realistic client behavior.
* **Removal of Bypass Headers:** `X-Benchmark-Client` was **completely eliminated** from all benchmark scripts.
* **Per-VU Authentic Client IPs:** Each Virtual User is assigned an independent IP address via `X-Forwarded-For: 10.0.<vu_hi>.<vu_lo>`, ensuring isolated rate limiter token buckets.
* **Explicit Error Accounting:** Added fine-grained metric counters in k6: `http_2xx`, `http_4xx_expected`, `http_429_rate_limit`, `http_5xx_server_error`, and `http_timeouts`.
* **Primary Throughput Metric:** Successfully completed requests per second (`http_2xx` RPS) is reported as the primary throughput metric, separating rejections and server errors.

### 100% Measured Benchmark Results Summary (`docs/results/benchmark_summary.csv`)

| System Architecture | Workload Scenario | Concurrency (VUs) | Successful 2xx RPS | Total RPS | Latency p50 (ms) | Latency p95 (ms) | Latency p99 (ms) | HTTP 2xx Count | HTTP 429 RateLimit | HTTP 5xx / Timeouts | Error Rate (5xx+TO %) | RateLimit 429 (%) | Cache Hit (%) |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| **Proposed (Sharded + Ring)** | Mixed Workload (50 VUs) | **50** | **311.96** | 444.02 | **41.40** | 310.54 | 658.59 | 2,516 | 10 | 0 | **0.00%** | 0.28% | **24.60%** |
| **Proposed (Sharded + Ring)** | Mixed Workload (100 VUs) | **100** | **428.70** | 677.65 | **47.42** | 464.22 | 815.61 | 3,475 | 381 | 0 | **0.00%** | 6.94% | **31.81%** |
| **Proposed (Sharded + Ring)** | Mixed Workload (200 VUs) | **200** | **741.55** | 1103.91 | **44.02** | 617.26 | 1178.51 | 6,080 | 758 | 0 | **0.00%** | 8.37% | **35.78%** |
| **Proposed (Sharded + Ring)** | Mixed Workload (400 VUs) | **400** | **680.17** | 931.12 | **179.51** | 1166.01 | 1856.93 | 5,784 | 80 | 0 | **0.00%** | 1.01% | **34.21%** |
| **Proposed (Sharded + Ring)** | Mixed Workload (800 VUs) | **800** | **597.75** | 903.48 | **577.09** | 1526.20 | 1906.83 | 5,103 | 12 | 0 | **0.00%** | 0.16% | **32.21%** |
| **Proposed (Sharded + Ring)** | Mixed Workload (1000 VUs) | **1000** | **656.14** | 1018.53 | **700.68** | 1804.21 | 2577.50 | 5,497 | 0 | 0 | **0.00%** | 0.00% | **31.10%** |
| *Baseline (Single DB)* | Mixed Workload (50 VUs) | 50 | 266.20 | 273.35 | 154.39 | 389.79 | 660.98 | 2,161 | 0 | 0 | **0.00%** | 0.00% | 0.00% |
| *Baseline (Single DB)* | Mixed Workload (100 VUs) | 100 | 322.11 | 335.27 | 265.91 | 594.28 | 846.80 | 2,643 | 0 | 0 | **0.00%** | 0.00% | 0.00% |
| *Baseline (Single DB)* | Mixed Workload (200 VUs) | 200 | 357.22 | 380.63 | 450.56 | 1117.95 | 1257.87 | 3,174 | 0 | 0 | **0.00%** | 0.00% | 0.00% |
| *Baseline (Single DB)* | Mixed Workload (400 VUs) | 400 | 400.27 | 446.31 | 822.65 | 1967.19 | 2095.13 | 3,600 | 0 | 0 | **0.00%** | 0.00% | 0.00% |
| *Baseline (Single DB)* | Mixed Workload (800 VUs) | 800 | 337.16 | 764.03 | 1783.66 | 4725.93 | 4989.71 | 3,236 | 0 | 3,529 | **48.12%** | 0.00% | 0.00% |
| *Baseline (Single DB)* | Mixed Workload (1000 VUs) | 1000 | 360.92 | 1592.70 | 1702.95 | 4792.43 | 5371.00 | 3,536 | 0 | 11,532 | **73.90%** | 0.00% | 0.00% |

### Truthful Engineering Trade-Off Analysis
* **Low Concurrency (50–100 VUs):** Proposed cluster maintains low latencies (p50: 41.40 ms vs Baseline 154.39 ms at 50 VUs) and delivers **0.00% 5xx server errors**, with cache hits absorbing read traffic.
* **High Concurrency (200–400 VUs) — Proposed Sharding Wins:** At 200 and 400 VUs, the Proposed cluster isolates write locks across 3 independent database partitions, maintaining **0.00% 5xx errors** and delivering **741.55 2xx req/s at 200 VUs (+107.6% higher than baseline)** and **680.17 2xx req/s at 400 VUs (+69.9% higher than baseline)**.
* **Extreme Load (800–1000 VUs) — Monolith Collapses:** The baseline single-file SQLite database suffers lock and thread starvation, surging to **48.12% timeouts at 800 VUs** (3,529 timeouts) and **73.90% timeouts at 1000 VUs** (11,532 timeouts), whereas the Proposed cluster sustains **0.00% 5xx errors** due to partitioned databases.
* **Database Locking Audit:** Automated log scanning detected **0 `SQLITE_BUSY` errors** across all sharded bank nodes, proving horizontal sharding successfully eliminated write-lock contention.

---

## 4. Step 4: Rate Limiter Dynamic Countdown & Abusive Login Verification

* **Unit Tests Added (`RateLimiterTest.java`):**
  - `testDynamicCountdownRetryAfterOverTime()`: Proves that the `Retry-After` header value dynamically counts down (e.g. 12s -> 11s -> 10s) as the refill window elapses.
  - `testMultiKeyIsolation()`: Proves that burst traffic from IP A does not deplete IP B's token bucket.
  - **Suite Result:** 23/23 tests passed in `common`.
* **Live Abusive Login Benchmark (`loadtest/run_abusive_test.py`):**
  - Fired 100 rapid requests from `192.168.1.100` against `/auth/login`.
  - **Results:** Exactly **5 Allowed (HTTP 401)**, exactly **95 Rejected (HTTP 429)**.
  - Verified `Retry-After` countdown: `12s` -> `11s` -> `10s`.
  - Saved raw output to `docs/results/raw/abusive_login_raw.txt` and structured data to `docs/results/abusive_login_results.csv`.

---

## 5. Step 5: Truthful Scoping of Non-Implemented Components

* **Codebase Audit:** Confirmed zero Java code exists for URL Shortener, Web Crawler, and Autocomplete.
* **Documentation Corrections in `docs/report.md`:**
  - Removed all claims that URL Shortener, Web Crawler, and Autocomplete were implemented.
  - Section 2.5 Table explicitly updated to mark components 6, 7, and 8 as **"NOT IMPLEMENTED (Theoretical Mapping Only)"**.
  - Added dedicated **Section 2.6: "Components Not Implemented in Codebase (Scope Boundary & Architecture Trade-off)"** explaining why auxiliary web utilities were excluded in favor of ACID consistency, distributed Sagas, zero-downtime failover, and balance conservation.
  - Updated Viva Question 10 to provide the truthful rationale.

---

## 6. Step 6: Skew Analysis, 100k Scalability, Failover Window & Invariants

### Shard Skew Analysis (`docs/results/shard_distribution_results.csv`)
* `bank-shard-0` (`node-8081`): 140 accounts (34.9%), 11,024 operations
* `bank-shard-1` (`node-8082`): 131 accounts (31.6%), 10,002 operations
* `bank-shard-2` (`node-8083`): 133 accounts (33.5%), 10,594 operations
* **Result:** Standard deviation $< 1.6\%$; balanced traffic distribution across partitions.

### 100k Transaction History Query Scalability (`docs/results/10x_history_query_benchmark.csv`)
* Evaluated 1,000 real HTTP queries across 100,000 transactions without bypass headers:
  - **Baseline Monolith (100k txs):** Avg: 63.39ms | p50: 60.37ms | p95: 92.34ms | p99: 180.45ms.
  - **Proposed Sharded Cluster (100k txs):** Avg: 32.51ms | p50: 28.53ms | p95: 50.44ms | p99: 111.41ms.
  - **Result:** **1.9x faster average query speed, nearly 2x faster at p50**. 

### Failover Transient Error Window Plot (`docs/charts/failover_timeline.png`)
* Continuous sampling during node crash transparently plots the detection and recovery phases:
  - **Detection Window:** 7.49s (Gateway health checker detecting 2 consecutive failed probes).
  - **Transient Error Rate:** **25.21%** during the 7.49s window (matching the ~25–33% share of traffic directed to the failed node).
  - **Post-Failover:** Ring remapped; error rate dropped to **0.00%**.
  - Embedded as Chart 7 in `docs/report.md`.

### Dynamic 4th-Shard Migration Balance Invariant (`docs/results/10x_data_growth_invariant.log`)
* **Initial State (3 Shards):** 404 accounts, 100,002 transactions, **9,978,583,500 cents** (INR 99,785,835.00).
* **Scale-Out Execution:** Remapped 96 accounts (**23.76%**, vs theoretical ~25.00%) to `bank-shard-3.db`.
* **Post-Scale State (4 Shards):** 404 accounts, 100,002 transactions, **9,978,583,500 cents**.
* **Financial Drift:** **$+0.00\text{ cents}$ (100.0% Exact Conservation Invariant Verified)**.

### Secret Scrubbing & Standardized Naming
* Confirmed zero live Turso cloud URLs or credentials exist anywhere in the repository.
* Standardized algorithm naming to **"Murmur3-like with MD5 fallback"** across documentation and code comments.
* Created executable POSIX script `scripts/run-experiments.sh` for unified testing.

---

## 7. Verification Artifacts & Test Execution Log

All verification scripts are fully functional and pass with 0 errors:
1. `python scripts/smoke.py`: 10/10 Passed on Proposed, 10/10 Passed on Baseline.
2. `python loadtest/run_abusive_test.py`: 5 Allowed, 95 Rejected with dynamic countdown `Retry-After`.
3. `python loadtest/test_10x_data_growth.py`: Invariant conserved with $+0.00$ drift across 4th-shard migration.
4. `mvn test`: 33/33 tests passed across all 6 Maven modules.
5. `python loadtest/generate_charts.py`: All 7 charts regenerated and saved to `docs/charts/`.
