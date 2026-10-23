# Scalable Online Banking System
**UCS3513 System Design Laboratory — Mini Project 7**  
Department of Computer Science & Engineering, Sri Sivasubramaniya Nadar College of Engineering  

A complete, high-performance prototype of a **Scalable Online Banking System** designed from first principles with zero external black-box frameworks (NO Spring Cloud Gateway, NO Bucket4j, NO Redis, NO third-party sharding libraries).

---

## Complete Project Structure

```
├── common/        # The 5 Core System Design Components (100% first-principles Java 17)
├── data-tools/    # Synthetic banking data generator & shard seeding CLI
├── bank-service/  # Spring Boot 3 app running on :8081, :8082, :8083, :8084 (Saga, KV Cache, Shards)
├── gateway/       # Custom reverse proxy API Gateway on :8080 (Consistent Hash Ring + Static Assets)
├── frontend/      # Zero-build NetBanking web application (Vanilla HTML5/CSS3/ES Modules)
├── baseline/      # Monolithic single-DB reference application on :8090 (for A/B benchmarking)
├── data/          # Database shards (bank-shard-0.db, bank-shard-1.db, bank-shard-2.db, bank-shard-3.db)
├── bin/           # Pre-compiled k6 load testing binary (k6.exe)
├── loadtest/      # k6 test scripts & matplotlib chart generation scripts
├── results/       # Benchmark CSV outputs & generated performance PNG charts
├── scripts/       # Automation scripts (start-all, stop-all, run-all-experiments, init-shards)
└── docs/          # Full Lab Documentation, Decisions Log, Test Results, and Demo Script
    ├── report.md                  # Comprehensive System Design Report & Viva Voce Q&A
    ├── demo-script.md             # Step-by-step evaluator demo guide
    ├── decisions.md               # Complete architecture & design decisions log (Phases 1-9)
    ├── test-results-phase1-3.md   # Test execution logs for Phases 1-3
    ├── test-results-phase4-6.md   # Test execution logs for Phases 4-6
    ├── results/                   # Raw benchmark CSV logs
    └── charts/                    # 6 High-resolution matplotlib performance charts
```

---

## 5 Core System Design Components (Implemented from Scratch in `common`)

| Component | Purpose in Online Banking | Implementation Details |
|---|---|---|
| **1. Rate Limiter** | Restrict brute-force login attempts & burst traffic | Custom **Token Bucket** per key in `ConcurrentHashMap`, lazy refill based on elapsed wall-clock time, background sweeper for stale buckets, per-endpoint policies (`LOGIN_STRICT`: 5/min, `TRANSFER_MODERATE`: 30/min, `ENQUIRY_LENIENT`: 120/min), returns HTTP 429 with `Retry-After`. |
| **2. Consistent Hashing** | Distribute requests/accounts across servers and shards | Custom **`TreeMap` Hash Ring** with 150 Virtual Nodes per physical node using **Murmur3 64-bit** (and MD5). Includes academic comparison with `NaiveModuloRouter` (`hash % N`) showing only **23.36%** key remapping on ring vs **74.54%** on Modulo. Features persistent pointer needle and clockwise fall-through routing. |
| **3. Sharding** | Partition customer, account, and transaction data | `ShardRouter` mapping `accountId` to database shards (`bank-shard-0`, `bank-shard-1`, `bank-shard-2`, `bank-shard-3`). Includes `ShardConnection` abstraction supporting local SQLite and Turso/libSQL HTTP `/v2/pipeline`. Dynamic `ShardMigrationService` migrates only remapped accounts while strictly conserving initial financial balances. |
| **4. Key-Value Store** | In-memory cache for sessions, OTPs, balances, idempotency | Redis-equivalent cache built on `ConcurrentHashMap` with dual eviction (lazy TTL check + active daemon sweeper) and optional LRU capacity cap. Achieves **84–94% hit ratio** and sub-microsecond (**377 ns**) lookup latency. |
| **5. Unique ID Generator** | Unique transaction IDs for transfers & bill payments | Twitter **Snowflake 64-bit** (41-bit timestamp, 10-bit node ID, 12-bit sequence). Generates **1.6+ million IDs/sec** with **0 collisions** across multi-threaded nodes, featuring built-in clock-regression recovery. |

---

## Retail NetBanking & Cluster Simulation Features

The user interface delivers a production-grade retail NetBanking experience coupled with real-time distributed system telemetry:

* **28-Customer Directory across 4 Shards (`BANK_CUSTOMERS_DIRECTORY`)**:
  Realistic Indian banking identities (`ACC-0000001` through `ACC-0000028`) distributed across Shards 0, 1, 2, and 3 (`:8081`, `:8082`, `:8083`, `:8084`) with IFSC codes and branches (Erode, Coimbatore, Chennai, Salem, Bangalore, etc.).
* **Dynamic Beneficiary Management**:
  Interactive **"+ Add Beneficiary"** modal supporting 1-click addition from the 28-customer directory or custom payee registration with instant cluster ring verification and dropdown synchronization.
* **Instant Account Deposit (+ ₹1,000 to ₹50,000)**:
  Direct deposit modal supporting multiple payment channels (UPI, Instant IMPS, Cash Deposit Machine, NEFT/RTGS) with real-time balance updates, Snowflake ID generation (`DEP-...`), and immutable ledger CREDIT statements.
* **Optional Remarks / Purpose for Fund Transfers**:
  Annotate transfers with purpose (e.g., "Monthly Rent", "Dinner Treat"), embedded in the double-entry transaction record and displayed in the statement.
* **Variable BBPS Utility Bills (Up to 5 Bills Max)**:
  Dynamic utility and card bills per account (TNEB electricity, broadband, municipal water tax, gas cylinder, credit card) with automated clearing settlement and debit execution.
* **Quorum-Protected Admin Cluster Drawer**:
  - Remove/revive up to 3 individual nodes (`:8081`, `:8082`, `:8083`) with quorum safety (minimum 1 active node enforced).
  - Dynamic scale-out with **Node 4 (`:8084` / Shard 3)** expanding the ring from 450 to 600 virtual nodes.
  - Live Consistent Hash Ring needle pointer visualization showing instantaneous traffic rerouting upon node eviction.
* **Live Telemetry Stream**:
  Toggleable right-hand panel visualizing Token Bucket replenishment, 2-Phase Saga cross-shard settlements, KV store RAM hits, Snowflake ID bit decomposition, and live audit event logs.

---

## Quick Start & Evaluation Demo

### 1. Start All System Instances (1 Command):
```powershell
.\powershell.bat -File scripts/start-all.ps1
```
*(On Linux/macOS: `./scripts/start-all.sh`)*

### 2. Open the Web UI in Browser:
👉 **[http://localhost:8080/](http://localhost:8080/)** (or deployed live on Vercel: **https://frontend-eight-ashy-27.vercel.app/**)

#### Running Frontend Standalone (No Node Build Step):
The frontend is built using standard **vanilla HTML5 + CSS + ES Modules** (< 80 KB bundle) and requires zero build steps or transpilation.
To serve it standalone on any port (e.g. port 3000, 5173, or on Vercel):
```bash
# Using Python built-in HTTP server:
cd frontend
python -m http.server 3000
```
Open `http://localhost:3000/?gateway=http://localhost:8080` or configure:
```bash
# In shell environment or .env:
GATEWAY_URL=http://localhost:8080
```
The frontend automatically detects `GATEWAY_URL`, `?gateway=...` query parameter, or `localStorage.getItem('GATEWAY_URL')`. If the gateway is offline, it safely renders in cached demo mode.

* Click **"Aarav Sharma (ACC-0000001)"** &rarr; **"Sign In to Account"**.
* View live response trace badges: `→ gateway:8080 · routed → node:8081 · shard:0 · cache:HIT · 0.4ms`.
* Test **"+ Deposit Money"** to credit funds via UPI or IMPS and view the updated balance and ledger statement.
* Go to **"Beneficiaries"** &rarr; **"+ Add Beneficiary"** and select any of the 28 pre-configured accounts.
* Execute cross-shard transfers with optional **Remarks** and live 2-Phase Saga step visualizer.
* Use the **⚙ Admin Drawer** to test `[Remove :8082]`, `[Revive :8082]`, and `[➕ Add Node 4]` with live animated hash ring migration!

### 3. Run Automated Benchmarks & Generate Charts (1 Command):
```powershell
.\powershell.bat -File scripts/run-all-experiments.ps1
```

### 4. Stop All System Instances:
```powershell
.\powershell.bat -File scripts/stop-all.ps1
```

---

## Key Performance Results: Proposed vs Monolithic Baseline

| Concurrency Level | Proposed System Throughput | Baseline Throughput | Proposed p50 Latency | Baseline p50 Latency | Proposed Error Rate | Baseline Error Rate |
|---|---|---|---|---|---|---|
| **Low (50 VUs)** | **842.5 req/s** | 410.0 req/s | **4.2 ms** | 18.4 ms | **0.00%** | 0.00% |
| **Medium (200 VUs)** | **2,180.0 req/s** | 890.5 req/s | **7.8 ms** | 68.2 ms | **0.00%** | 3.40% |
| **High (1,000 VUs)** | **4,850.2 req/s** | 1,120.0 req/s | **18.5 ms** | 285.0 ms | **0.12%** | **28.60%** |

* **Throughput:** 4.3x higher capacity under 1,000 VUs.
* **Latency:** 15.4x lower p50 response time under heavy concurrency.
* **Error Rate:** Eliminates database lock contention (`SQLITE_BUSY`).
* **Financial Ledger Conservation:** 0.00 balance drift across all tests and migrations.

For complete architectural details, performance graphs, and viva voce preparation, consult [`docs/report.md`](file:///d:/projects/banking/docs/report.md) and [`docs/demo-script.md`](file:///d:/projects/banking/docs/demo-script.md).

