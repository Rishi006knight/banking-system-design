# scripts/run-experiments.ps1
# Master Experiment Suite for UCS3513 System Design Laboratory (PowerShell)

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "   UCS3513 SYSTEM DESIGN LAB: MASTER EXPERIMENT RUNNER    " -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

# 1. Run live benchmark suite (mixed-workload stepped ramp + resource sampling)
Write-Host "`n[Step 1] Running live benchmark suite..." -ForegroundColor Yellow
python loadtest/run_real_benchmarks.py

# 2. Run 4th-shard scale-out and balance conservation invariant
Write-Host "`n[Step 2] Running shard migration balance invariant verification..." -ForegroundColor Yellow
python loadtest/test_10x_data_growth.py

# 3. Regenerate charts
Write-Host "`n[Step 3] Regenerating evaluation charts..." -ForegroundColor Yellow
python loadtest/generate_charts.py

Write-Host "`n==========================================================" -ForegroundColor Green
Write-Host "   EXPERIMENTS COMPLETED SUCCESSFULLY!                    " -ForegroundColor Green
Write-Host "   - All CSVs saved to results/ and docs/results/         " -ForegroundColor Green
Write-Host "   - All PNG Charts saved to docs/charts/                 " -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Green
