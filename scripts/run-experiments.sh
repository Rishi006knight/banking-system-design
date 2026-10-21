#!/usr/bin/env bash
# Complete Master Experiment Suite for UCS3513 System Design Laboratory
# Executes real benchmarks, 100k data growth tests, and chart generation.

set -e

echo "=========================================================="
echo "   UCS3513 SYSTEM DESIGN LAB: MASTER EXPERIMENT RUNNER    "
echo "=========================================================="

# Choose python interpreter
if command -v python3 &>/dev/null; then
    PY_BIN=python3
elif command -v python &>/dev/null; then
    PY_BIN=python
else
    echo "Error: Python 3 is required."
    exit 1
fi

# 1. Run live benchmark suite (mixed-workload stepped ramp + resource sampling)
echo ""
echo "[Step 1] Running live benchmark suite..."
$PY_BIN loadtest/run_real_benchmarks.py

# 2. Run 4th-shard scale-out and balance conservation invariant
echo ""
echo "[Step 2] Running shard migration balance invariant verification..."
$PY_BIN loadtest/test_10x_data_growth.py

# 3. Regenerate charts
echo ""
echo "[Step 3] Regenerating evaluation charts..."
$PY_BIN loadtest/generate_charts.py

echo ""
echo "=========================================================="
echo "   EXPERIMENTS COMPLETED SUCCESSFULLY!                    "
echo "   - All CSVs saved to results/ and docs/results/         "
echo "   - All PNG Charts saved to results/charts/ & docs/charts"
echo "=========================================================="
