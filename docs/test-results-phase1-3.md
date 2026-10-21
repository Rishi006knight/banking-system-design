# Test Output and Verification Summary (Phases 1 - 3)
**Project:** Scalable Online Banking System (Mini Project 7 - UCS3513 System Design Laboratory)  
**Date:** October 2026  
**Status:** All 27 Tests Passed (100% Success Rate)

---

## 1. Executive Summary

| Module | Test Classes | Tests Run | Failures | Errors | Result |
|---|---|---|---|---|---|
| **common** | `ConsistentHashRingTest`<br>`KeyValueStoreTest`<br>`RateLimiterTest`<br>`ShardingTest`<br>`SnowflakeIdGeneratorTest` | 21 | 0 | 0 | **SUCCESS** |
| **data-tools** | `SyntheticDataGeneratorTest` | 1 | 0 | 0 | **SUCCESS** |
| **bank-service** | `BankServiceIntegrationTest` | 5 | 0 | 0 | **SUCCESS** |
| **TOTAL** | **7 Test Classes** | **27** | **0** | **0** | **100% PASS** |

---

## 2. Component Benchmark & Metric Outputs

### 2.1 Consistent Hashing (`ConsistentHashRingTest`)
```
==================================================================
CONSISTENT HASHING REMAP (3 -> 4 nodes): 23.36%
NAIVE MODULO HASHING REMAP (3 -> 4 nodes): 74.54%
==================================================================
Load Distribution with 1 VNode:   {node-A=342,  node-B=5855, node-C=3803} (StdDev: 2275.04)
Load Distribution with 150 VNodes: {node-A=2782, node-B=3654, node-C=3564} (StdDev: 391.58)
[INFO] Tests run: 4, Failures: 0, Errors: 0, Skipped: 0
```
* **Key Finding:** Scaling from 3 to 4 nodes caused only **23.36%** of keys to be remapped on the Consistent Hash Ring (near the theoretical minimum $1 / (N+1) = 25\%$), compared to **74.54%** on naive modulo-N hashing. Virtual nodes (150/node) reduced key variance by **82.8%** (StdDev dropped from 2,275 to 391).

---

### 2.2 Key-Value Store (`KeyValueStoreTest`)
```
==================================================================
KV STORE CONCURRENCY METRICS:
Total Gets: 25,600 | Hits: 21,504 | Misses: 4,096 | Hit Ratio: 84.00%
Total Puts: 6,500  | Evictions: 0  | Avg Latency: 377.18 ns
==================================================================
[INFO] Tests run: 5, Failures: 0, Errors: 0, Skipped: 0
```
* **Key Finding:** In-memory `ConcurrentHashMap` with lazy TTL and active sweeper achieved sub-microsecond lookup latency (**377.18 nanoseconds**) under 16 concurrent worker threads, with an **84%** hit ratio on cached balances.

---

### 2.3 Token Bucket Rate Limiter (`RateLimiterTest`)
```
Login Metrics:   RateLimiterMetrics{total=6,  allowed=5,  rejected=1,   rejectionRate=16.67%}
Enquiry Metrics: RateLimiterMetrics{total=20, allowed=20, rejected=0,   rejectionRate=0.00%}
Concurrency:     20 threads, 200 requests -> Allowed=50, Rejected=150 (Exact token accounting)
RateLimiter Metrics: RateLimiterMetrics{total=4, allowed=3, rejected=1, rejectionRate=25.00%}
[INFO] Tests run: 5, Failures: 0, Errors: 0, Skipped: 0
```
* **Key Finding:** Token bucket enforced exact token consumption under heavy multi-threaded contention. Strict rules prevented brute-force logins and returned HTTP 429 semantics with accurate `Retry-After` seconds.

---

### 2.4 Sharding & Migration (`ShardingTest`)
```
Dynamic Shard Migration: Accounts Migrated=20 / 100 (20.00%), Rows Moved=40, Duration=37ms
Initial Balance Across Shards: 1,495,000 cents
Final Balance Across Shards:   1,495,000 cents
[INFO] Tests run: 3, Failures: 0, Errors: 0, Skipped: 0
```
* **Key Finding:** Dynamically scaling from 3 to 4 shards triggered automated migration of only the remapped accounts (20% moved in 37ms). The financial balance sum across all shards was **100% conserved** before and after migration.

---

### 2.5 Snowflake 64-bit ID Generator (`SnowflakeIdGeneratorTest`)
```
Formatted ID: ID[106379176809877504: Time=2026-10-21T13:12:52.181Z, Node=5, Seq=0]
==================================================================
SNOWFLAKE CONCURRENCY BENCHMARK RESULTS:
Total IDs Generated: 180,000 across 3 simulated nodes
Collision Count:     0
Duration:            112 ms
Generation Rate:     1,607,143 IDs/sec
==================================================================
[INFO] Tests run: 4, Failures: 0, Errors: 0, Skipped: 0
```
* **Key Finding:** Across 18 parallel threads simulating 3 independent bank service nodes, 180,000 unique 64-bit IDs were generated in 112ms with **zero collisions** and a throughput of **1.60 million IDs/sec**.

---

### 2.6 Synthetic Data Generation (`SyntheticDataGeneratorTest` & CLI)
```
==================================================================
SYNTHETIC BANKING DATA GENERATOR
Shards: 3 | Data Directory: ./data
==================================================================
SEEDING COMPLETED SUCCESSFULLY!
Duration:              683 ms
Customers Created:     200
Accounts Created:      400
Transactions Created:  800
Beneficiaries Created: 598
Utility Bills Created: 598
Total Initial Balance: 10,087,100,000 paise (100,871,000.00 INR)

ROW DISTRIBUTION PER SHARD:
  bank-shard-0: 947 rows (192 KB)
  bank-shard-1: 888 rows (188 KB)
  bank-shard-2: 901 rows (192 KB)
==================================================================
```
* **Key Finding:** Shards received an almost perfectly uniform 33.3% share of data (StdDev < 3%).

---

### 2.7 Bank Service & Distributed Saga Invariant (`BankServiceIntegrationTest`)
```
==================================================================
CONCURRENT TRANSFERS INVARIANT TEST RESULTS:
Total Attempts:        100
Successful Transfers:  90
Rejected Transfers:    10 (due to injected insufficient balance tests)
Initial Total Balance: 4,125,000 cents
Final Total Balance:   4,125,000 cents (Exact match — 100% conserved)
==================================================================
Verified 226 unique transaction IDs with zero duplicates across all shards.
[INFO] Tests run: 5, Failures: 0, Errors: 0, Skipped: 0
```
* **Key Finding:** High concurrency testing proved transfer consistency across both same-shard atomic transactions and cross-shard distributed Sagas. No balances became negative, no funds were created or destroyed, and no duplicate transaction IDs occurred.
