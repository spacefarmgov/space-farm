# Start Space Farm Backend API locally
$ErrorActionPreference = "Stop"
$RepoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $RepoRoot
python -m uvicorn app.main:app --app-dir services/api --host 127.0.0.1 --port 8000 --reload
