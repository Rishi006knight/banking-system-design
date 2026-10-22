#!/usr/bin/env bash
# scripts/run-all-experiments.sh
# Complete Master Experiment Suite for UCS3513 System Design Laboratory (POSIX/Bash)

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

cd "${PROJECT_ROOT}"

PY_BIN="python"
if command -v python3 &>/dev/null; then
    PY_BIN="python3"
fi

echo "=========================================================="
echo "   UCS3513 SYSTEM DESIGN LAB: MASTER EXPERIMENT RUNNER    "
echo "=========================================================="

# 1. Clean and Seed Shard Databases
echo -e "\n[Step 1] Initializing fresh database shards..."
"${PY_BIN}" scripts/init_all_dbs.py

# 2. Launch all server processes
echo -e "\n[Step 2] Launching banking system microservices..."
"${PY_BIN}" scripts/manage_services.py start
sleep 6

# 3. Verify health via smoke tests
echo -e "\n[Step 3] Running smoke tests..."
"${PY_BIN}" scripts/smoke.py all

# 4. Run k6 Abusive Login Rate Limiter Test
echo -e "\n[Step 4] Running Abusive Login Rate Limiting Test (100 requests)..."
"${PY_BIN}" loadtest/run_abusive_test.py

# 5. Run 100k Transaction History Query Scalability Benchmark
echo -e "\n[Step 5] Running 100k History Query Scalability Benchmark..."
"${PY_BIN}" loadtest/test_10x_history_query.py

# 6. Run Server Node Failure & Failover Experiment
echo -e "\n[Step 6] Running Server Failure & Re-routing Experiment..."
if [ -f "bin/k6" ]; then
    bin/k6 run --env VUS=50 --env DURATION=15s loadtest/mixed-workload.js &
elif [ -f "bin/k6.exe" ]; then
    ./bin/k6.exe run --env VUS=50 --env DURATION=15s loadtest/mixed-workload.js &
fi
"${PY_BIN}" loadtest/test_real_node_kill_saga.py

# 7. Run Application Server Scale-out Experiment (3 -> 4 Nodes)
echo -e "\n[Step 7] Running Application Server Scale-out Experiment..."
"${PY_BIN}" loadtest/test_app_scaleout.py

# 8. Run Database Shard Scale-out & Balance Invariant Experiment
echo -e "\n[Step 8] Running Database Shard Scale-out & Balance Invariant Experiment..."
"${PY_BIN}" loadtest/test_10x_data_growth.py

# 9. Generate Evaluation Charts & Export CSV Results
echo -e "\n[Step 9] Generating visualization charts and building report tables..."
"${PY_BIN}" loadtest/generate_charts.py
"${PY_BIN}" scripts/build_report_tables.py
"${PY_BIN}" scripts/verify_report_claims.py

# 10. Teardown services
echo -e "\n[Step 10] Tearing down running services..."
"${PY_BIN}" scripts/manage_services.py stop

echo -e "\n=========================================================="
echo "   MASTER EXPERIMENTS COMPLETED SUCCESSFULLY!             "
echo "   - All CSVs saved to results/ and docs/results/         "
echo "   - All PNG Charts saved to docs/charts/                 "
echo "   - Evaluation logs saved to docs/results/               "
echo "=========================================================="
