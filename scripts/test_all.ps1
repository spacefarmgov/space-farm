# Run full Space Farm verification suite (audit + unit/contract tests + live E2E)
$ErrorActionPreference = "Stop"
$RepoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $RepoRoot

Write-Host "=== 1. Data, Catalog & Contract Audit (C-04) ==="
python tools/data/audit_data.py
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "=== 2. Backend Unit & Contract Tests (T01-T16, T23) ==="
python -m unittest discover -s services/api/tests -t services/api -v
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "=== 3. Live NASA POWER E2E Test (T22) ==="
python -m unittest tests/e2e/verify_live_e2e.py -v
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "ALL SPACE FARM BACKEND CHECKS PASSED."
