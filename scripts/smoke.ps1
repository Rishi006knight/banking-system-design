# PowerShell wrapper for banking prototype smoke test
param(
    [string]$Target = "all"
)

python scripts/smoke.py $Target
