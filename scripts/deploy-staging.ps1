#!/usr/bin/env pwsh
# deploy-staging.ps1 — Deploy the latest master to the local staging stack
# Usage: pwsh scripts/deploy-staging.ps1

Set-StrictMode -Off
$ErrorActionPreference = "Stop"

$RepoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $RepoRoot

Write-Host "=== FHIR Platform — Staging Deployment ===" -ForegroundColor Cyan
Write-Host "Repo: $RepoRoot"
Write-Host "Time: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
Write-Host ""

# ── 1. Pull latest master ──────────────────────────────────────────────────────
Write-Host "[1/4] Pulling latest master..." -ForegroundColor Yellow
git fetch origin master
git reset --hard origin/master
Write-Host "      HEAD: $(git --no-pager log -1 --format='%h %s')" -ForegroundColor Green

# ── 2. Build & restart staging containers ─────────────────────────────────────
Write-Host "[2/4] Building staging images..." -ForegroundColor Yellow
docker compose `
  -f docker-compose.yml `
  -f docker-compose.staging.yml `
  -p fhir-staging `
  build --no-cache

# ── 3. Bring up the staging stack ─────────────────────────────────────────────
Write-Host "[3/4] Starting staging stack..." -ForegroundColor Yellow
docker compose `
  -f docker-compose.yml `
  -f docker-compose.staging.yml `
  -p fhir-staging `
  up -d --remove-orphans

# ── 4. Health check ───────────────────────────────────────────────────────────
Write-Host "[4/4] Waiting for staging health checks..." -ForegroundColor Yellow
$timeout = 120; $elapsed = 0; $ready = $false
while ($elapsed -lt $timeout) {
    Start-Sleep -Seconds 5; $elapsed += 5
    try {
        $r = Invoke-RestMethod "http://localhost:8081/fhir/metadata" -TimeoutSec 3
        if ($r.resourceType -eq "CapabilityStatement") { $ready = $true; break }
    } catch { }
    Write-Host "      Waiting... (${elapsed}s)"
}

if (-not $ready) {
    Write-Host "ERROR: Staging backend did not become healthy within ${timeout}s." -ForegroundColor Red
    docker compose -f docker-compose.yml -f docker-compose.staging.yml -p fhir-staging logs --tail 50
    exit 1
}

# ── Summary ───────────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "=== Staging deployment complete ===" -ForegroundColor Green
Write-Host "  Admin UI  : http://localhost:5174"
Write-Host "  FHIR API  : http://localhost:8081/fhir/"
Write-Host "  MongoDB   : localhost:27018"
Write-Host "  Login     : admin / admin"
Write-Host ""
docker compose -f docker-compose.yml -f docker-compose.staging.yml -p fhir-staging ps
