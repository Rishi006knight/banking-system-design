# Phase 4, 5, and 6 Test Execution and Architecture Summary
**Project:** Scalable Online Banking System (Mini Project 7 - UCS3513 System Design Laboratory)  
**Date:** October 2026  
**Environment:** Java 17.0.12, Spring Boot 3.2.4, Apache Maven 3.9.6, Windows PowerShell

---

## 1. Executive Summary

Phases 4, 5, and 6 have been designed, coded, verified, and integrated into the multi-module project.
All 5 reactor modules compiled and passed 100% of their test suites:

```text
[INFO] ------------------------------------------------------------------------
[INFO] Reactor Summary for Scalable Online Banking System 1.0.0-SNAPSHOT:
[INFO] 
[INFO] Scalable Online Banking System ..................... SUCCESS [  0.253 s]
[INFO] Common Components .................................. SUCCESS [  7.338 s]
[INFO] Data Tools and Shard Seeding ....................... SUCCESS [  2.251 s]
[INFO] Bank Service Application ........................... SUCCESS [ 11.972 s]
[INFO] API Gateway ........................................ SUCCESS [  8.015 s]
[INFO] Baseline Bank Service .............................. SUCCESS [  6.689 s]
[INFO] ------------------------------------------------------------------------
[INFO] BUILD SUCCESS
[INFO] Total time: 37.072 s
```

---

## 2. Phase 4: Custom API Gateway (`gateway`)

### 2.1 Design & Architectural Highlights
* **Zero Spring Cloud Gateway:** Implemented entirely with native Java 17 `HttpClient` and Spring MVC filters/controllers.
* **Consistent Hash Routing (`GatewayHashRingRouter`):**
  - Gateway routes every incoming client request to backend application server nodes (`node-8081`, `node-8082`, `node-8083`) using the custom 150-vnode Consistent Hash Ring from `common`.
  - Routing key hierarchy:
    1. Account ID in URI path (e.g. `/accounts/{id}`)
    2. Header `X-Account-Id`
    3. Query parameter `accountId`
    4. Bearer session token
    5. Fallback to client IP address
  - Ensures requests for the same account deterministically hit the same application server for maximum cache locality.
* **Dynamic Failover & Recovery (`ServerHealthChecker`):**
  - Background daemon probes active nodes via `/admin/metrics` every 5 seconds.
  - If a server fails 2 consecutive health checks, it is **automatically removed from the consistent hash ring**.
  - Subsequent requests for keys previously mapped to the dead node are re-routed to the next healthy node clockwise on the ring.
  - When the node recovers and responds to health checks, it is **automatically re-added to the ring** with its 150 virtual nodes restored.
* **Edge Rate Limiting (`GatewayController`):**
  - Token Bucket rate limiter applied at the edge before proxying:
    - `/auth/login`, `/auth/register`: Strict (5 req/min, capacity 5)
    - `/transfers`, `/billpayments`: Moderate (30 req/min, capacity 10)
    - Balance and history inquiries: Lenient (120 req/min, capacity 30)
  - Returns `HTTP 429 Too Many Requests` with header `Retry-After: <seconds>` and explanatory JSON body when exceeded.
* **Header Forwarding and Filtering:**
  - Standard restricted headers (`Connection`, `Content-Length`, `Host`, `Upgrade`, `Keep-Alive`, `Expect`, `Date`) filtered to prevent JDK `HttpRequestBuilder` violations.
  - Injects trace headers `X-Forwarded-For`, `X-Forwarded-Host`, and returns `X-Gateway-Route: <nodeId>`.

### 2.2 Phase 4 Test Results (`GatewayIntegrationTest`)

| Test Method | Objective | Outcome |
|---|---|---|
| `testGatewayRouterWithServers` | Verify deterministic routing across 3 registered server nodes using 150 vnodes | **PASSED** (0ms) |
| `testServerFailoverAndReAdd` | Simulate dead node removal from ring, failover of requests to remaining healthy nodes, and re-addition upon recovery | **PASSED** (1ms) |
| `testEdgeRateLimiting` | Send rapid burst to `/auth/login`; assert 6th request triggers HTTP 429 with `Retry-After` header | **PASSED** (19ms) |
| `testGatewayAdminEndpoints` | Verify `/gateway/routes` and `/gateway/metrics` expose real-time ring configuration and rate limiter stats | **PASSED** (10ms) |

---

## 3. Phase 5: Minimal Web UI (Modern Glassmorphic Single-Page Application)

### 3.1 Design & Technology Choices
* **Single-Page Application (SPA):** Built with Vanilla JavaScript and CSS (zero heavyweight frontend frameworks or bloat).
* **Hosted & Served by Gateway:** Static assets located in `gateway/src/main/resources/static/` served automatically at `http://localhost:8080/`.
* **Design System & Aesthetics:**
  - Deep dark-mode palette (`#0a0f1d`) with radial ambient lighting and glassmorphic cards (`backdrop-filter: blur(16px)`).
  - Modern typography using Google Fonts *Plus Jakarta Sans* and *JetBrains Mono*.
  - Pulsating active status dots for Gateway, Server instances, and Shard partitions.
  - Smooth micro-interactions, responsive 2-column grid layout, and toast notification system.

### 3.2 Visual Screens & Capabilities
1. **Authentication & Fast Demo Picks:**
   - Login tab with pre-seeded demo shortcuts:
     - *Aarav Sharma* (`aarav.sharma1`) -> Primary Account `ACC-0000001` on **Shard-0**
     - *Diya Patel* (`diya.patel2`) -> Primary Account `ACC-0000002` on **Shard-1**
     - *Kavya Nair* (`kavya.nair4`) -> Primary Account `ACC-0000004` on **Shard-2**
   - Register tab: Allows instant creation of new customers with real-time shard hashing and initial balance setup.
2. **Account Dashboard Banner:**
   - Displays authenticated customer, account number, and live available balance.
   - **System Design Trace Badges:**
     - `Server: node-8081` (extracted from `X-Served-By` / `X-Gateway-Route`)
     - `Shard: bank-shard-0` (extracted from `X-Shard`)
     - `Cache: HIT (<1ms)` or `Cache: MISS (DB Shard)` (extracted from `X-Cache-Hit`)
3. **Fund Transfer Operations (Atomic & Saga):**
   - Pre-selects authenticated source account.
   - Quick-target buttons for cross-shard transfers (`ACC-0000002`, `ACC-0000004`).
   - Auto-generates unique 64-bit idempotency keys (`IDEM-XXXX-TIMESTAMP`).
   - Detailed status display confirming whether transfer executed as a single-shard ACID transaction or a distributed 2-phase Saga.
4. **Utility Bill Payments:**
   - Dropdown of unpaid bills dynamically loaded for the customer.
   - One-click idempotent settlement updating invoice state and issuing receipts.
5. **Beneficiaries & Notification Feed:**
   - Fast add beneficiary modal with instant Key-Value store caching.
   - Real-time audit log of debit, credit, transfer, and bill payment events.
6. **Transaction Ledger:**
   - Interactive table rendering 64-bit Snowflake transaction IDs, transaction type color coding, amounts, running balance, descriptions, and timestamps.
7. **Live System Telemetry Sidebar (Collapsible):**
   - **Consistent Hash Ring:** Active node count, total virtual nodes (450), algorithm (Murmur3-64).
   - **Node Failover & Recovery Controls:** Interactive buttons to simulate node crashes (`/gateway/simulate/fail?serverId=...`) and recoveries (`/gateway/simulate/recover?serverId=...`) on the fly, immediately re-mapping hash ring assignments in the UI.
   - **Rate Limiter:** Allowed requests, rejected requests, rejection %, active buckets, and policy limits.
   - **Shards:** Status of `bank-shard-0`, `bank-shard-1`, and `bank-shard-2`.
   - **Key-Value Store:** Live hit ratio gauge (%), total hits, misses, and average latency in nanoseconds.
   - **Snowflake ID Generator:** Total IDs generated, generation rate (IDs/sec), and verified collision count (0).

---

## 4. Phase 6: Monolithic Baseline Bank Service (`baseline`)

### 4.1 Design & Comparative Architecture
* **Port:** Runs independently on `http://localhost:8090`.
* **Zero System Design Enhancements:**
  - **No Sharding:** Uses a single, unpartitioned SQLite database (`data/baseline.db`).
  - **No In-Memory Key-Value Cache:** Every balance query and account lookup executes direct SQL disk reads.
  - **No Consistent Hashing:** Single monolithic server instance.
  - **No Rate Limiter:** All incoming requests are processed without throttling or token buckets.
  - **No Snowflake Generator:** Uses standard autoincrement integer primary keys.
* **API Compatibility:** Exposes identical REST endpoints (`/auth/login`, `/auth/register`, `/accounts/{id}/balance`, `/transfers`, `/bills`, `/billpayments`, `/admin/metrics`) to enable direct, fair A/B benchmarking under k6 load tests in Phase 7.

### 4.2 Phase 6 Test Results (`BaselineIntegrationTest`)

| Test Method | Objective | Outcome |
|---|---|---|
| `testBaselineEndToEndFlow` | Register customer on unpartitioned database, verify initial balance, execute transfer, verify balance updates and transaction recording | **PASSED** (2.505s) |

---

## 5. Summary Table of Reactor Verification

| Module | Unit & Integration Tests | Test Result |
|---|---|---|
| `common` | RateLimiterTest, ConsistentHashRingTest, ShardingTest, KeyValueStoreTest, SnowflakeIdGeneratorTest | **21 of 21 PASSED** |
| `data-tools` | DataGeneratorCli, SyntheticDataGenerator | **PASSED** |
| `bank-service` | BankServiceIntegrationTest (100 concurrent transfers, 0 balance drift) | **PASSED** |
| `gateway` | GatewayIntegrationTest (routing, failover, edge rate limiting, admin metrics) | **4 of 4 PASSED** |
| `baseline` | BaselineIntegrationTest (end-to-end monolithic workflow) | **1 of 1 PASSED** |
| **All Modules** | `mvn clean test` across entire reactor | **BUILD SUCCESS** |
