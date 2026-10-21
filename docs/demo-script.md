# Scalable Online Banking System: Demonstration & Evaluation Script
**Course:** UCS3513 System Design Laboratory (Mini Project 7)  
**Evaluation Target:** Complete Runnable Prototype & Lab Viva Demonstration  
**Platform:** Windows PowerShell (or Linux/macOS Bash)  

---

## 1. Quick Demonstration Workflow

Follow these steps to demonstrate the entire system to the lab evaluator in under 5 minutes:

### Step 1: Start All System Microservices (1 Command)
Open a PowerShell terminal in the repository root (`d:\projects\banking`) and execute:

```powershell
.\powershell.bat -File scripts/start-all.ps1
```
*(On Linux/macOS: `./scripts/start-all.sh`)*

This launches:
* **API Gateway** on `http://localhost:8080`
* **Bank Service Node 1** on `http://localhost:8081` (Shard 0)
* **Bank Service Node 2** on `http://localhost:8082` (Shard 1)
* **Bank Service Node 3** on `http://localhost:8083` (Shard 2)
* **Monolithic Baseline Service** on `http://localhost:8090` (Single unpartitioned DB)

---

### Step 2: Open the Web UI in Browser
Open your browser and navigate to:
👉 **[http://localhost:8080/](http://localhost:8080/)**

#### In the Web UI:
1. **Fast Demo Login:**
   * Click the **"Aarav (Shard-0 / ACC-0000001)"** button to load credentials.
   * Click **"Authenticate via Gateway"**.
2. **Inspect System Design Badges:**
   * Notice the live response trace badges on the balance card:
     * `Server: node-8081`
     * `Shard: bank-shard-0`
     * `Cache: HIT (<1ms)`
3. **Execute a Fund Transfer (Atomic / Saga):**
   * Click **"ACC-2 (Cross)"** to set destination to `ACC-0000002` (Diya Patel on Shard-1).
   * Notice the auto-generated Snowflake `Idempotency-Key`.
   * Click **"Execute Fund Transfer"**.
   * Observe the green alert confirming a **2-Phase Distributed Saga** execution with unique 64-bit Snowflake ID.
4. **Pay a Utility Bill:**
   * Select an unpaid electricity or water bill from the dropdown.
   * Click **"Pay Selected Utility Bill"** (instant idempotent settlement).
5. **Interactive Failure Simulation (In Telemetry Sidebar):**
   * Expand the **Live System Telemetry** sidebar on the right.
   * Under *Node Failover & Recovery Controls*, click **"Crash"** on `node-8082`.
   * Notice the status turns red `node-8082 (DOWN)` and active servers drop to `2 / 3`.
   * Click **"Refresh Balance"** — observe that requests now automatically failover to `node-8081` or `node-8083` with zero errors!
   * Click **"Recover"** on `node-8082` — the server is seamlessly re-added to the hash ring with 150 virtual nodes restored.

---

### Step 3: Run the Automated Master Experiments & Generate Charts
To run all load tests, failure scenarios, and generate charts:

```powershell
.\powershell.bat -File scripts/run-all-experiments.ps1
```

This automatically:
1. Re-seeds fresh database shards (`scripts/init-shards.ps1`).
2. Runs the k6 Abusive Login test (`loadtest/abusive-login.js`).
3. Executes the Server Crash Failover experiment (`scripts/experiment-server-failure.ps1`).
4. Executes the Server Scale-out experiment (`scripts/experiment-scaleout.ps1`).
5. Executes the Database Shard Scale-out & Balance Invariant experiment (`scripts/experiment-reshard.ps1`).
6. Generates all 6 visualization charts in `docs/charts/` and exports CSV metrics to `docs/results/`.

---

### Step 4: Inspect Generated Charts and Benchmark CSVs
All results and charts are saved directly in `docs/`:
* **Charts:**
  * `docs/charts/latency_vs_vus.png` (p50/p95/p99 vs Concurrency)
  * `docs/charts/throughput_vs_vus.png` (Requests/sec vs Concurrency)
  * `docs/charts/error_rate_vs_vus.png` (Error Rate vs Concurrency)
  * `docs/charts/cache_hit_ratio_over_time.png` (KV Cache Hit Progression)
  * `docs/charts/shard_request_distribution.png` (Uniform Shard Split)
  * `docs/charts/rate_limiter_rejection_curve.png` (Token Bucket Enforcement)
* **CSVs:**
  * `docs/results/benchmark_summary.csv`
  * `docs/results/abusive_login_results.csv`
  * `docs/results/shard_distribution_results.csv`
  * `docs/results/failover_metrics.csv`

---

### Step 5: Stop All System Instances (1 Command)
When the evaluation demo is complete, clean up all background processes by executing:

```powershell
.\powershell.bat -File scripts/stop-all.ps1
```
*(On Linux/macOS: `./scripts/stop-all.sh`)*

---

## 2. Terminal / cURL API Demo Commands

If the evaluator wishes to test endpoints via terminal or Postman:

### 1. Authenticate & Obtain Session Token
```bash
curl -X POST http://localhost:8080/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"aarav.sharma1","password":"Password@123"}'
```

### 2. Check Account Balance (Inspect Trace Headers)
```bash
curl -i -X GET http://localhost:8080/accounts/ACC-0000001/balance \
  -H "X-Account-Id: ACC-0000001"
```
*Observe response headers:* `X-Served-By`, `X-Shard`, `X-Cache-Hit`, `X-Gateway-Route`.

### 3. Execute Idempotent Cross-Shard Transfer
```bash
curl -X POST http://localhost:8080/transfers \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: DEMO-IDEM-001" \
  -H "X-Account-Id: ACC-0000001" \
  -d '{"sourceAccountId":"ACC-0000001","destAccountId":"ACC-0000002","amountCents":25000,"description":"Demo Transfer"}'
```

### 4. Trigger Edge Rate Limiter (Burst of 10 Requests)
```powershell
1..10 | ForEach-Object {
    curl.exe -s -o /dev/null -w "%{http_code}`n" -X POST http://localhost:8080/auth/login `
      -H "Content-Type: application/json" `
      -d '{"username":"bot","password":"bad"}'
}
```
*Expected Output:* First 5 requests return `401/200`; requests 6 to 10 return `429` (Rate Limited).

---

## 3. Evaluation Checkpoints Summary

| Checkpoint | What Evaluator Looks For | Where It Is Demonstrated |
|---|---|---|
| **1. Rate Limiting** | Token Bucket algorithm, strict 5/min limit on login, HTTP 429 + `Retry-After` header | `loadtest/abusive-login.js`, `GatewayController.java`, Web UI |
| **2. Consistent Hashing** | 150 vnodes, Murmur3 hashing, deterministic routing, minimal key remap on scale-out | `GatewayHashRingRouter.java`, `scripts/experiment-scaleout.ps1`, Chart 5 |
| **3. Sharding** | Partitioned databases, atomic same-shard transfers, 2-phase cross-shard Saga, 0 balance drift | `ShardRouter.java`, `TransferService.java`, `BankServiceIntegrationTest.java` |
| **4. Key-Value Store** | In-memory cache, dual eviction (lazy TTL + active sweeper), sub-microsecond latency | `InMemoryTtlKeyValueStore.java`, `GET /accounts/{id}/balance`, Chart 4 |
| **5. Snowflake IDs** | 64-bit Twitter Snowflake structure, clock regression handling, zero collisions | `SnowflakeIdGenerator.java`, Transaction ledger table in UI |
| **6. Failover & Self-Healing** | Gateway detects dead node in 8.92s, adjusts ring, requests re-route with 20/20 success, node recovers in 8.64s | `ServerHealthChecker.java`, `docs/results/failover_metrics.csv` |
| **7. Comparative Performance** | High-concurrency scaling up to 5,529 req/s, 100% balance conservation across 400 accounts with +0.00 drift | `docs/report.md`, `docs/results/benchmark_summary.csv`, Charts in `docs/charts/` |
