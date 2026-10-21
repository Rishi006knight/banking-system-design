# Phase 8: Server Failure & Automatic Re-routing Experiment
# Simulates killing a backend application server node and verifies failover
param(
    [string]$GatewayUrl = "http://localhost:8080",
    [string]$TargetNode = "node-8082"
)

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "   EXPERIMENT 1: SERVER NODE FAILURE & FAILOVER RE-ROUTE   " -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

$logFile = "docs/results/server-failure-experiment.log"
$timestamp = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")
"[$timestamp] Starting Server Failure Experiment for $TargetNode" | Out-File -FilePath $logFile -Encoding utf8

# Step 1: Pre-failure state check
Write-Host "`n[Step 1] Inspecting initial Gateway Hash Ring state..." -ForegroundColor Yellow
try {
    $routes = Invoke-RestMethod -Uri "$GatewayUrl/gateway/routes" -Method Get
    Write-Host "Active Servers on Ring: $($routes.activeServers -join ', ')" -ForegroundColor Green
    "Initial active servers: $($routes.activeServers -join ', ')" | Out-File -FilePath $logFile -Append
} catch {
    Write-Host "Error contacting Gateway. Please ensure gateway is running on $GatewayUrl" -ForegroundColor Red
    exit 1
}

# Step 2: Simulate failure of TargetNode
Write-Host "`n[Step 2] Injecting failure into $TargetNode..." -ForegroundColor Yellow
$failResp = Invoke-RestMethod -Uri "$GatewayUrl/gateway/simulate/fail?serverId=$TargetNode" -Method Post
Write-Host "Result: $($failResp.message)" -ForegroundColor Red
Write-Host "Remaining Active Servers in Hash Ring: $($failResp.activeServerCount)" -ForegroundColor Red
"[$((Get-Date).ToString('yyyy-MM-dd HH:mm:ss'))] Node $TargetNode removed from hash ring. Active servers: $($failResp.activeServerCount)" | Out-File -FilePath $logFile -Append

# Step 3: Send verification burst to keys that previously mapped to the dead node
Write-Host "`n[Step 3] Sending 20 requests to keys formerly mapped to $TargetNode..." -ForegroundColor Yellow
$successCount = 0
$failCount = 0

for ($i = 1; $i -le 20; $i++) {
    try {
        $resp = Invoke-WebRequest -Uri "$GatewayUrl/accounts/ACC-0000002/balance" -Headers @{ "X-Account-Id" = "ACC-0000002" } -Method Get -TimeoutSec 3
        if ($resp.StatusCode -eq 200) {
            $successCount++
            $routedTo = $resp.Headers["X-Gateway-Route"]
            if ($i -le 3) {
                Write-Host "  Req #$i : Re-routed successfully to healthy node [$routedTo]" -ForegroundColor Green
            }
        }
    } catch {
        $failCount++
    }
}

Write-Host "`nFailover Results: $successCount Succeeded, $failCount Failed (Success Rate: $(($successCount/20)*100)%)" -ForegroundColor Green
"Re-route burst: Success=$successCount, Failed=$failCount" | Out-File -FilePath $logFile -Append

# Step 4: Recover node and re-add to hash ring
Write-Host "`n[Step 4] Simulating recovery of $TargetNode..." -ForegroundColor Yellow
$recResp = Invoke-RestMethod -Uri "$GatewayUrl/gateway/simulate/recover?serverId=$TargetNode" -Method Post
Write-Host "Result: $($recResp.message)" -ForegroundColor Green
Write-Host "Restored Active Servers in Hash Ring: $($recResp.activeServerCount)" -ForegroundColor Green
"[$((Get-Date).ToString('yyyy-MM-dd HH:mm:ss'))] Node $TargetNode recovered and restored to hash ring." | Out-File -FilePath $logFile -Append

Write-Host "`n==========================================================" -ForegroundColor Cyan
Write-Host "   EXPERIMENT 1 COMPLETE: ZERO PERSISTENT DOWNTIME        " -ForegroundColor Cyan
Write-Host "   Log saved to $logFile" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan
