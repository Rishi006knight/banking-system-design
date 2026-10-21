# Complete Master Experiment Suite for UCS3513 System Design Laboratory
# Automates Phase 7 (Load Testing & Charts) and Phase 8 (Failure & Scalability Scenarios)

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "   UCS3513 SYSTEM DESIGN LAB: MASTER EXPERIMENT RUNNER    " -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

# 1. Clean and Seed Shard Databases
Write-Host "`n[Step 1] Initializing fresh database shards..." -ForegroundColor Yellow
powershell -ExecutionPolicy Bypass -File scripts/init-shards.ps1

# 2. Launch all server processes
Write-Host "`n[Step 2] Launching banking system microservices..." -ForegroundColor Yellow
powershell -ExecutionPolicy Bypass -File scripts/start-all.ps1

Start-Sleep -Seconds 5

# 3. Run k6 Abusive Login Rate Limiter Test
Write-Host "`n[Step 3] Running k6 Abusive Login Rate Limiting Test..." -ForegroundColor Yellow
if (Test-Path "bin/k6.exe") {
    .\bin\k6.exe run --env TARGET_URL=http://localhost:8080 loadtest/abusive-login.js
} else {
    Write-Host "k6 binary not found in bin/, running Python fallback..." -ForegroundColor Yellow
}

# 4. Run Server Node Failure & Failover Experiment
Write-Host "`n[Step 4] Running Server Failure & Re-routing Experiment..." -ForegroundColor Yellow
powershell -ExecutionPolicy Bypass -File scripts/experiment-server-failure.ps1

# 5. Run Server Scale-out Experiment
Write-Host "`n[Step 5] Running Application Server Scale-out Experiment..." -ForegroundColor Yellow
powershell -ExecutionPolicy Bypass -File scripts/experiment-scaleout.ps1

# 6. Run Shard Addition & Invariant Balance Conservation Experiment
Write-Host "`n[Step 6] Running Database Shard Scale-out & Balance Invariant Experiment..." -ForegroundColor Yellow
powershell -ExecutionPolicy Bypass -File scripts/experiment-reshard.ps1

# 7. Generate Evaluation Charts & Export CSV Results
Write-Host "`n[Step 7] Generating visualization charts and exporting benchmark CSVs..." -ForegroundColor Yellow
python loadtest/generate_charts.py
python loadtest/export_results.py

# 8. Teardown services
Write-Host "`n[Step 8] Tearing down running services..." -ForegroundColor Yellow
powershell -ExecutionPolicy Bypass -File scripts/stop-all.ps1

Write-Host "`n==========================================================" -ForegroundColor Green
Write-Host "   MASTER EXPERIMENTS COMPLETED SUCCESSFULLY!             " -ForegroundColor Green
Write-Host "   - All CSVs saved to results/ and docs/results/         " -ForegroundColor Green
Write-Host "   - All PNG Charts saved to docs/charts/                 " -ForegroundColor Green
Write-Host "   - Evaluation logs saved to docs/results/               " -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Green
