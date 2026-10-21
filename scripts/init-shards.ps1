# PowerShell script to initialize and seed database shards
param(
    [int]$Shards = 3,
    [string]$DataDir = "./data",
    [int]$Customers = 1000,
    [int]$Accounts = 2000,
    [int]$Transactions = 10000
)

$ErrorActionPreference = "Stop"

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "Initializing Database Shards for Online Banking Prototype" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

if (-not (Test-Path $DataDir)) {
    New-Item -ItemType Directory -Path $DataDir -Force | Out-Null
    Write-Host "Created data directory: $DataDir" -ForegroundColor Green
}

Write-Host "Building project and installing modules..." -ForegroundColor Yellow
mvn clean install -DskipTests

Write-Host "Running Synthetic Data Generator..." -ForegroundColor Yellow
mvn compile exec:java -pl data-tools "-Dexec.mainClass=com.banking.datatools.DataGeneratorCli" "-Dexec.args=--shards $Shards --data-dir $DataDir --customers $Customers --accounts $Accounts --transactions $Transactions"

Write-Host "`nShard initialization complete!" -ForegroundColor Green
Get-ChildItem -Path $DataDir -Filter "*.db" | ForEach-Object {
    Write-Host ("  " + $_.Name + " (" + [math]::Round($_.Length / 1KB, 2) + " KB)") -ForegroundColor Gray
}
