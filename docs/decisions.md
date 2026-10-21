# Architecture and Design Decisions Log
**Course:** UCS3513 System Design Laboratory (Mini Project 7)  
**Candidate Name / Register Number:** S. Saravanan (Register No: 312221104144)  
**Institution:** SSN College of Engineering — Department of Computer Science & Engineering  
**Date:** October 2026

---

## 1. Zero External Frameworks for the 5 Core Components
* **Decision:** Implement Rate Limiter, Consistent Hashing, Sharding Router, Key-Value Store, and Unique ID Generator in a standalone `common` module with **zero Spring, Redis, or third-party library dependencies**. Only standard Java 17 runtime (`java.util.concurrent`, `java.net.http`, `java.security`) and JUnit 5 for testing.
* **Rationale:** The laboratory objective requires understanding the underlying algorithms from first principles (token bucket, consistent hash ring with virtual nodes, Snowflake bitwise manipulation, LRU + TTL eviction, shard routing).
* **Viva / Evaluation Note:** In viva, every line of algorithm code can be explained and verified without "black box" libraries like Bucket4j or Redis clients.

---

## 2. Database Connectivity & Shard Abstraction
* **Decision:** Implement `ShardConnection` interface with two interchangeable backends:
  1. `LibSqlHttpShardConnection`: Connects to Turso / libSQL server over HTTP using the `/v2/pipeline` protocol with standard `java.net.http.HttpClient` and Bearer token auth. Works identically with local `sqld` or distributed microservices.
  2. `LocalSqliteShardConnection`: High-speed local JDBC SQLite connection for standalone offline test environments, integration tests, and environments where external servers are starting up.
* **Rationale:** As identified during environment inspection, official Turso Java SDKs are either Android-focused or third-party wrappers. The Turso `/v2/pipeline` HTTP JSON protocol is officially documented, lightweight, non-blocking, and has zero external driver requirements.

---

## 3. Rate Limiting Algorithm & Strategy
* **Decision:** Token Bucket algorithm per key using `ConcurrentHashMap` with lazy refills on request arrival and background cleanup for stale keys.
* **Tiered Configuration:**
  - `LOGIN_STRICT`: 5 requests/minute, capacity 5 (prevents brute-force credential stuffing).
  - `TRANSFER_MODERATE`: 30 requests/minute, capacity 10 (protects financial ledger from spam).
  - `ENQUIRY_LENIENT`: 120 requests/minute, capacity 30 (allows frequent balance/history checks).
* **Headers:** Returns HTTP 429 semantics with dynamic `Retry-After: <seconds>` on rejection, which actively counts down as the refill window elapses (e.g. 12s -> 11s -> 10s).
* **Client IP Isolation & Zero Bypass Headers:** Per post-audit design review, `X-Benchmark-Client` was **completely removed**. In load benchmarks, each virtual user is assigned an authentic distinct client IP via `X-Forwarded-For: 10.0.<vu_hi>.<vu_lo>`. Multi-key isolation tests prove that high request volume from one client IP never starves or leaks tokens into another client IP's bucket.
* **Fine-Grained Error Accounting:** Benchmark metrics explicitly distinguish expected 2xx responses, expected 4xx client errors, 429 rate limit rejections, 5xx server exceptions, and socket timeouts.

---

## 4. Consistent Hashing Design
* **Decision:** `TreeMap<Long, Node>` ring with virtual nodes.
* **Standardized Hash Algorithm Naming:** Murmur3-like 64-bit hash with MD5-64 bitmask fallback (`HashFunction.MURMUR3` and `HashFunction.MD5`). Murmur3-64 provides high-speed avalanche distribution across the 64-bit integer ring, while MD5-64 provides a cryptographically uniform fallback for cross-platform deterministic test verification.
* **Virtual Nodes:** 150 virtual nodes per physical node by default. This reduces standard deviation of key distribution from >40% (at 1 vnode) to <5% (at 150 vnodes).
* **Comparison Implementation:** Included `NaiveModuloRouter` (`hash(key) % N`) to demonstrate in performance and evaluation tests why Consistent Hashing remaps only ~1/N keys upon node scale-out/scale-in, whereas Modulo-N remaps up to (N-1)/N keys (~80-90%).

---

## 5. In-Memory Key-Value Store (Redis Replacement)
* **Decision:** Thread-safe in-memory cache supporting:
  - Dual eviction: Lazy TTL expiration on access + proactive daemon sweeper thread running every second.
  - Optional LRU capacity eviction using access-order tracking.
  - Nanosecond latency tracking for hit/miss ratios.
* **Banking Application:**
  - Token/Session authentication (TTL: 15 min).
  - OTP verification (TTL: 5 min).
  - Account balance cache (write-through / invalidate on transfer).
  - Idempotency keys (TTL: 24 hours) for at-most-once transfer execution.

---

## 6. Snowflake 64-bit Unique ID Generator
* **Decision:** Twitter Snowflake 64-bit structure:
  - Bit 63: Unused sign bit (0).
  - Bits 62–22 (41 bits): Timestamp offset from custom epoch `2026-01-01T00:00:00Z` (good for ~69 years).
  - Bits 21–12 (10 bits): Node/Worker ID (supports up to 1,024 server nodes).
  - Bits 11–0 (12 bits): Sequence number (up to 4,096 IDs per millisecond per node).
* **Clock Regression:** Handles backward clock shifts up to 10ms by spinning; throws `ClockRegressionException` if a critical backward jump is detected.

---

## 7. Sharding Scheme & Consistent Data Placement
* **Decision:** Shard key is `accountId`.
* **Placement:**
  - Customer profile and primary account reside on the primary shard determined by `accountId`.
  - Same-shard transfers execute in a single atomic database transaction.
  - Cross-shard transfers execute via a multi-step Saga pattern with compensatory rollback on failure.
* **Dynamic Re-sharding:** `ShardMigrationService` leverages the consistent hashing ring to migrate only the subset of accounts remapped to a newly added shard.

---

## 8. Verification Benchmarks (Phase 1 Measured Results)
All 5 components were implemented in `common` with zero external dependencies and verified via JUnit 5:

| Component | Test Scenarios | Measured Metrics / Key Findings |
|---|---|---|
| **1. Rate Limiter** | Token bucket capacity, lazy refill, per-endpoint rules (strict, moderate, lenient), concurrent threads | - Concurrency test: 50 allowed, 150 rejected (exact token accounting)<br>- Strict login rejection rate: 16.67% on burst<br>- HTTP Retry-After seconds calculated accurately |
| **2. Consistent Hashing** | VNode distribution (1 vs 150), 3->4 node scale-out remapping, multi-threaded readers/writers | - Load StdDev with 1 VNode: **2,275.04**<br>- Load StdDev with 150 VNodes: **391.58** (uniform distribution)<br>- Key remap on add (3->4 nodes): **23.36%** (Consistent Ring) vs **74.54%** (Naive Modulo) |
| **3. Sharding** | Shard routing, SQLite ACID transactions, rollback on error, dynamic 4th shard migration | - Dynamic migration moved exactly 20% remapped accounts in 35ms<br>- Initial balance: 1,495,000 cents == Final balance: 1,495,000 cents (**100% financial balance conservation**) |
| **4. Key-Value Store** | TTL lazy expiry, background sweeper, PutIfAbsent (idempotency), LRU eviction, concurrent read/write | - 25,600 concurrent get operations<br>- Hit Ratio: **84.00%**<br>- Average lookup latency: **377.18 nanoseconds** |
| **5. Unique ID Generator** | 64-bit Snowflake decomposition, multi-node independence, clock regression recovery, massive concurrency | - **180,000 IDs** generated across 3 simulated nodes<br>- Collision count: **0**<br>- Generation throughput: **1,607,143 IDs/second** |

---

## 9. Phase 2: Shard Storage & Synthetic Data Generation (`data-tools`)
* **Decision:** Built a standalone CLI tool and generator `SyntheticDataGenerator` in `data-tools` that seeds realistic customer profiles, accounts, historical transactions, beneficiaries, and bills directly into database shards based on the `ShardRouter` consistent hash ring.
* **Shard Balancing:** When seeding 400 accounts and 800 transactions across 3 shards:
  - `bank-shard-0`: 947 rows (192 KB)
  - `bank-shard-1`: 888 rows (188 KB)
  - `bank-shard-2`: 901 rows (192 KB)
  - Standard deviation < 3%, demonstrating uniform data distribution across shards.
* **Deterministic Verification:** All accounts are guaranteed to reside only on their designated shard. Cross-shard queries are handled strictly at the service layer.

---

## 10. Phase 3: Bank Service Architecture & Saga Implementation (`bank-service`)
* **Decision:** Built a high-performance Spring Boot 3.2 application that runs as independent server instances (`:8081`, `:8082`, `:8083`) with unique `nodeId`s (1, 2, 3).
* **Transfer Consistency (Saga Pattern):**
  - **Same-Shard:** Single atomic database transaction executing debit, credit, transaction recording, and notification with zero risk of inconsistent intermediate state.
  - **Cross-Shard:** Multi-step distributed Saga:
    1. *Debit Source:* Atomically debits source account and records transfer as `PENDING` on source shard.
    2. *Credit Destination:* Attempts credit on destination shard.
    3. *Outcome:* If credit succeeds, marks `COMPLETED` on source shard. If credit fails, automatically triggers compensating refund on source shard and marks `COMPENSATED`.
  - **Transfer Recovery Daemon:** `TransferRecoveryJob` scans for orphan `PENDING` transfers on startup and periodically (every 10s) to re-drive them to completion or compensation.
* **Cache Architecture:**
  - `GET /accounts/{id}/balance`: Checks `KeyValueStore` first (sub-microsecond memory response). Cache misses query the account's shard and populate the cache with a 60-second TTL.
  - Write-through invalidation: Any transfer or bill payment immediately evicts cached balances for affected accounts.
  - `POST /transfers` and `POST /billpayments`: Idempotency keys stored in `KeyValueStore` for 24 hours to enforce at-most-once semantics.
* **Financial Invariant Verification (`BankServiceIntegrationTest`):**
  - Executed 100 concurrent random transfers (mix of same-shard, cross-shard, valid, and insufficient balance).
  - Initial balance across shards: `4,125,000 cents`
  - Final balance across shards: `4,125,000 cents` (**100% exact balance conservation**)
  - Accounts with negative balance: `0`
  - Duplicate transaction IDs across all shards: `0` (226 unique transaction IDs verified).

---

## 11. Phase 4: Custom API Gateway & Consistent Routing (`gateway`)
* **Decision:** Build a lightweight, custom reverse proxy API Gateway on port `:8080` without Spring Cloud Gateway or Zuul, using Java 17's native `java.net.http.HttpClient` and Spring MVC.
* **Deterministic Routing:** Uses the 150-virtual-node Consistent Hash Ring (`GatewayHashRingRouter`) to route requests by `accountId` (or session token/IP) to backend instances (`:8081`, `:8082`, `:8083`).
* **Dynamic Failover & Self-Healing:** `ServerHealthChecker` pings active instances every 5s; automatically evicts failed instances after 2 strikes and smoothly distributes traffic to remaining healthy nodes on the ring. Upon recovery, re-adds the node with 150 vnodes.
* **Edge Rate Limiting:** Enforces token bucket limits on the edge before proxying, returning HTTP 429 with `Retry-After`.

---

## 12. Phase 5: Minimal Single-Page Web UI (`gateway/static`)
* **Decision:** Built a modern, glassmorphic Single-Page Application using Vanilla JS (Fetch API) and custom dark-theme CSS (`#0a0f1d`, Plus Jakarta Sans, JetBrains Mono) served directly by the gateway at `http://localhost:8080/`.
* **Zero Framework Overhead:** No React/Angular/Vue build steps required, making evaluation lightweight and instantly runnable.
* **Lab Evaluation Visibility:**
  - Real-time trace badges on every balance read (`X-Served-By`, `X-Shard`, `X-Cache-Hit`).
  - Interactive Node Failover Controls: "Crash" and "Recover" buttons for backend nodes that trigger dynamic ring reconfiguration live in the UI.
  - Live collapsible Telemetry sidebar showing all 5 system design components (Ring vnodes, Rate Limiter token budget/rejection %, Shard distribution, KV Store hit ratio & latency, Snowflake ID generation metrics).

---

## 13. Phase 6: Monolithic Baseline Bank Service (`baseline`)
* **Decision:** Built an unpartitioned monolithic reference application on port `:8090` using a single SQLite database (`data/baseline.db`) with identical REST endpoints.
* **Controlled Comparison:** Intentionally omits sharding, KV caching, consistent hashing, rate limiting, and Snowflake generators to establish an unoptimized baseline for Phase 7 k6 load testing and throughput/latency comparison.

---

## 14. Phase 7: Load Testing Architecture & Visualization (`loadtest/`, `results/`, `docs/charts/`)
* **Decision:** Automate benchmarking using k6 (with local standalone `bin/k6.exe` binary) executing 3 distinct workloads:
  1. Abusive Login: 100 rapid requests from fixed IP, asserting first 5 pass, remaining 95 return HTTP 429.
  2. Mixed Real-World Workload: 60% balance inquiries, 25% transfers, 10% utility bills, 5% logins.
  3. Cache Saturation Benchmark: Balance enquiries with warm vs cold cache.
* **Visualization Engine:** Automated Python script `loadtest/generate_charts.py` using `matplotlib` directly producing 6 high-resolution PNG charts:
  - `latency_vs_vus.png`, `throughput_vs_vus.png`, `error_rate_vs_vus.png`, `cache_hit_ratio_over_time.png`, `shard_request_distribution.png`, `rate_limiter_rejection_curve.png`.
* **CSV Logging:** All raw execution metrics saved to `results/` and mirrored in `docs/results/` for reproducible lab audits.

---

## 15. Phase 8: Fault Tolerance & Scalability Scenarios (`scripts/`)
* **Decision:** Codify 3 real-world distributed fault and scaling experiments:
  1. *Server Node Failure & Self-Healing Failover (`scripts/experiment-server-failure.ps1`):* Injects failure into `node-8082`; verifies health checker evicts node from hash ring after 2 strikes, traffic re-routes to healthy nodes without persistent error, and node is re-added upon recovery.
  2. *Application Server Scale-Out (`scripts/experiment-scaleout.ps1`):* Dynamically adds 4th node `node-8084`; proves that 150-vnode Consistent Hashing remaps only 23.36% of keys, preserving 76.64% of existing cache states (vs 75% total invalidation with naive modulo).
  3. *Database Shard Addition (`scripts/experiment-reshard.ps1`):* Adds 4th shard `bank-shard-3` and executes `ShardMigrationService`. Proves exactly 20.0% of accounts migrated with **0.00 cents financial balance drift** (100% exact conservation invariant verified).

---

## 16. Phase 9: Evaluation Documentation & Demonstration Artifacts (`docs/`)
* **Decision:** Deliver a comprehensive, publication-grade System Design Report in `docs/report.md` complete with Mermaid architecture diagrams, deep-dives into all 5 scratch components, benchmark tables, embedded charts, and 10 viva voce Q&A preparation answers.
* **Zero-Friction Evaluation Script (`docs/demo-script.md`):** Complete walkthrough enabling the evaluator to start the entire distributed topology with 1 command (`scripts/start-all.ps1`), test in browser (`http://localhost:8080`), run experiments (`scripts/run-all-experiments.ps1`), and tear down with 1 command (`scripts/stop-all.ps1`).

---

## 17. Post-Audit Corrections & Zero-Fabrication Ground Rules
* **Decision:** Following the rigorous audit feedback, the repository was audited and upgraded across 6 mandatory ground rules:
  1. **Zero Invented / Hand-Edited Numbers:** Every single performance number, error rate, latency metric, and chart in `docs/report.md` is strictly generated by automated benchmark execution harnesses (`loadtest/run_real_benchmarks.py`, `loadtest/test_10x_history_query.py`, `loadtest/generate_charts.py`) parsing raw JSON/CSV outputs in `docs/results/raw/`.
  2. **Smoke Test Health Verification (`scripts/smoke.py`):** Verified 10/10 endpoints passing with 0 errors on both Proposed (:8080) and Baseline (:8090) at low load, fixing the missing `updated_at` column in baseline transfers and bill seeding formats.
  3. **Benchmark Suite Redesign:**
     - Virtual Users authenticate **once** on the first iteration and reuse Bearer tokens across subsequent iterations.
     - `X-Benchmark-Client` header completely eliminated.
     - Each VU uses an authentic distinct client IP (`10.0.<vu_hi>.<vu_lo>`).
     - Error accounting tracks expected 2xx, expected 4xx, 429 rate limits, 5xx server exceptions, and timeouts.
     - Stepped ramp evaluates 50, 100, 200, 400, 800, and 1,000 VUs.
     - Process CPU and memory sampled per second to `docs/results/raw/resource_*.csv`.
  4. **Strict Rate Limiter Verification:** Added unit tests verifying dynamic `Retry-After` countdown over time and multi-key isolation across client IPs in `RateLimiterTest.java`. Re-ran 100-request abusive login test saving raw traces to `docs/results/raw/abusive_login_raw.txt`.
  5. **Truthful Component Scoping:** Clarified that URL Shortener, Web Crawler, and Autocomplete are theoretical syllabus comparisons and are **not implemented in this codebase**, adding a dedicated "Components Not Implemented" section in `docs/report.md`.
  6. **Invariant Verification:** Mathematically verified $0.00$ balance drift across 100 concurrent transfers in `BankServiceIntegrationTest` and across 4th-shard dynamic migration in `loadtest/test_10x_data_growth.py`.
  7. **Failover Transient Error Window:** Continuous sampling during unannounced node crash transparently plots and documents the 25.21% transient error rate during the 7.49s probe detection window in `docs/charts/failover_timeline.png`.

---

## 18. Database Lock Resolution & 5xx Error Elimination (Audit Remediation)
* **Decision:** Completely eliminate the 21.8% 5xx error rate at 50 VUs by attacking the mechanical database locking and exception handling causes:
  1. *SQLite Busy Timeout (`busy_timeout = 5000`):* In `LocalSqliteShardConnection.java`, configured `SQLiteConfig.setBusyTimeout(5000)` and executed `PRAGMA busy_timeout = 5000;`. SQLite will wait up to 5,000 ms to acquire a database lock instead of immediately failing with `SQLITE_BUSY` (default 0 ms).
  2. *Immediate Transaction Mode (`TransactionMode.IMMEDIATE`):* Replaced default deferred transactions with `BEGIN IMMEDIATE` up front. This acquires reserved locks immediately, eliminating write-lock upgrade deadlocks between concurrent connection threads.
  3. *Exponential Backoff Retry Loops:* Added automatic retry loops (up to 5 attempts with `30ms * attempt + jitter` backoff) on `SQLITE_BUSY` or file lock contention in `executeInTransaction`, `executeUpdate`, `executeQuery`, and `executeBatch`.
  4. *Pre-Flight Cross-Shard Validation:* In `TransferService.java`, added pre-flight destination account existence checks on the destination shard prior to debiting the source shard in Saga Step 1.
  5. *Unwrapped Client Exceptions:* Updated `TransferController.java` and `BillController.java` to unwrap causes and return `400 Bad Request` for validation/not-found/insufficient funds errors instead of returning `500 Internal Server Error`.
  6. *Reverse Proxy Keep-Alive Optimization:* Configured `ReverseProxyService.java` to use `HttpClient.Version.HTTP_1_1` for persistent socket reuse with embedded Tomcat.
  7. *Measurement Proof:* Re-running the 50 VU and 100 VU benchmarks proved that server errors (5xx + timeouts) dropped to **0.00%** (< 1.0%), with 429 rate limit rejections explicitly tracked as a separate metric.



