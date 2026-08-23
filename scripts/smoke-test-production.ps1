<#
.SYNOPSIS
    Smoke-tests the live production FHIR platform deployment over HTTPS.

.DESCRIPTION
    Exercises key end-to-end flows against a running deployment: FHIR
    capability statement, frontend reachability, auth (login + 401
    enforcement), FHIR resource CRUD (Patient), admin stats, and (optionally)
    a minimal Synthea generation job. Each check prints PASS/FAIL and the
    script exits non-zero if any check fails.

    This is NOT a replacement for the unit/slice test suites (mvn verify,
    vitest run) -- those test code in isolation with mocks. This script
    validates the actually deployed, running system.

.PARAMETER BaseUrl
    Base HTTPS URL of the deployment to test. Defaults to production.

.PARAMETER SkipSynthea
    Skip the Synthea generation check (it creates persistent data and can
    take 30-90+ seconds).

.EXAMPLE
    pwsh scripts/smoke-test-production.ps1

.EXAMPLE
    pwsh scripts/smoke-test-production.ps1 -SkipSynthea
#>

param(
    [string]$BaseUrl = "https://fhir.applied-thoughts.com",
    [switch]$SkipSynthea
)

$ErrorActionPreference = "Stop"
$script:failures = 0
$script:checks = 0

function Test-Check {
    param(
        [string]$Name,
        [scriptblock]$Body
    )
    $script:checks++
    Write-Host -NoNewline "[$script:checks] $Name ... "
    try {
        & $Body
        Write-Host "PASS" -ForegroundColor Green
    } catch {
        Write-Host "FAIL" -ForegroundColor Red
        Write-Host "    $($_.Exception.Message)" -ForegroundColor Red
        $script:failures++
    }
}

function Assert-Equal {
    param($Expected, $Actual, [string]$Message)
    if ($Expected -ne $Actual) {
        throw "$Message (expected '$Expected', got '$Actual')"
    }
}

Write-Host "=== FHIR Platform Smoke Test ==="
Write-Host "Target: $BaseUrl"
Write-Host ""

# 1. FHIR CapabilityStatement
Test-Check "GET /fhir/metadata returns fhirVersion 4.0.1" {
    $resp = Invoke-RestMethod -Uri "$BaseUrl/fhir/metadata" -Method Get -TimeoutSec 15
    Assert-Equal "4.0.1" $resp.fhirVersion "fhirVersion mismatch"
}

# 2. Admin UI frontend reachable
Test-Check "GET / (Admin UI) returns HTTP 200" {
    $resp = Invoke-WebRequest -Uri "$BaseUrl/" -Method Get -TimeoutSec 15 -UseBasicParsing
    Assert-Equal 200 $resp.StatusCode "Admin UI status code"
}

# 3. Unauthenticated admin call is rejected (401, not 403 -- see CHANGELOG)
Test-Check "GET /api/admin/stats without token returns 401" {
    try {
        Invoke-WebRequest -Uri "$BaseUrl/api/admin/stats" -Method Get -TimeoutSec 15 -UseBasicParsing | Out-Null
        throw "Expected 401 but request succeeded"
    } catch [Microsoft.PowerShell.Commands.HttpResponseException] {
        Assert-Equal 401 [int]$_.Exception.Response.StatusCode "Status code for unauthenticated admin call"
    }
}

# 4. Login
$script:token = $null
Test-Check "POST /api/auth/login with admin/admin returns a token" {
    $body = @{ username = "admin"; password = "admin" } | ConvertTo-Json
    $resp = Invoke-RestMethod -Uri "$BaseUrl/api/auth/login" -Method Post -Body $body -ContentType "application/json" -TimeoutSec 15
    if (-not $resp.token) { throw "No token in login response" }
    $script:token = $resp.token
}

if (-not $script:token) {
    Write-Host ""
    Write-Host "Login failed - skipping authenticated checks." -ForegroundColor Yellow
} else {
    $authHeaders = @{ Authorization = "Bearer $script:token" }

    # 5. Authenticated admin stats
    Test-Check "GET /api/admin/stats with token returns resource counts" {
        $resp = Invoke-RestMethod -Uri "$BaseUrl/api/admin/stats" -Method Get -Headers $authHeaders -TimeoutSec 15
        if ($null -eq $resp.totalResources) { throw "Missing totalResources in stats response" }
    }

    # 6-9. FHIR Patient CRUD round-trip
    $script:patientId = $null
    Test-Check "POST /fhir/Patient creates a resource" {
        $patient = @{
            resourceType = "Patient"
            name = @(@{ family = "SmokeTest"; given = @("Warp") })
            gender = "unknown"
        } | ConvertTo-Json -Depth 5
        $resp = Invoke-RestMethod -Uri "$BaseUrl/fhir/Patient" -Method Post -Body $patient -ContentType "application/fhir+json" -TimeoutSec 15
        if (-not $resp.id) { throw "No id returned for created Patient" }
        $script:patientId = $resp.id
    }

    Test-Check "GET /fhir/Patient/{id} round-trips the created resource" {
        if (-not $script:patientId) { throw "No patient id from create step" }
        $resp = Invoke-RestMethod -Uri "$BaseUrl/fhir/Patient/$script:patientId" -Method Get -TimeoutSec 15
        Assert-Equal "SmokeTest" $resp.name[0].family "Patient family name"
    }

    Test-Check "PUT /fhir/Patient/{id} updates the resource" {
        if (-not $script:patientId) { throw "No patient id from create step" }
        $updated = @{
            resourceType = "Patient"
            id = $script:patientId
            name = @(@{ family = "SmokeTestUpdated"; given = @("Warp") })
            gender = "unknown"
        } | ConvertTo-Json -Depth 5
        $resp = Invoke-RestMethod -Uri "$BaseUrl/fhir/Patient/$script:patientId" -Method Put -Body $updated -ContentType "application/fhir+json" -TimeoutSec 15
        Assert-Equal "SmokeTestUpdated" $resp.name[0].family "Updated patient family name"
    }

    Test-Check "DELETE /fhir/Patient/{id} removes the resource" {
        if (-not $script:patientId) { throw "No patient id from create step" }
        Invoke-WebRequest -Uri "$BaseUrl/fhir/Patient/$script:patientId" -Method Delete -TimeoutSec 15 -UseBasicParsing | Out-Null
        try {
            Invoke-RestMethod -Uri "$BaseUrl/fhir/Patient/$script:patientId" -Method Get -TimeoutSec 15 | Out-Null
            throw "Expected deleted Patient to be gone (404/410) but GET succeeded"
        } catch [Microsoft.PowerShell.Commands.HttpResponseException] {
            $code = [int]$_.Exception.Response.StatusCode
            if ($code -ne 404 -and $code -ne 410) { throw "Expected 404/410 after delete, got $code" }
        }
    }

    # 10. Synthea generation (optional -- creates persistent data, slow)
    if (-not $SkipSynthea) {
        Test-Check "POST /api/admin/synthea/generate accepts a small job and it completes" {
            $genBody = @{ populationSize = 1; state = "Massachusetts"; city = "Boston" } | ConvertTo-Json
            $resp = Invoke-RestMethod -Uri "$BaseUrl/api/admin/synthea/generate" -Method Post -Body $genBody -ContentType "application/json" -Headers $authHeaders -TimeoutSec 15
            if (-not $resp.jobId) { throw "No jobId returned" }
            $jobId = $resp.jobId

            $elapsed = 0
            $timeout = 180
            $status = $resp.status
            while ($status -eq "PENDING" -or $status -eq "RUNNING") {
                if ($elapsed -ge $timeout) { throw "Synthea job did not complete within ${timeout}s (last status: $status)" }
                Start-Sleep -Seconds 5
                $elapsed += 5
                $job = Invoke-RestMethod -Uri "$BaseUrl/api/admin/synthea/jobs/$jobId" -Method Get -Headers $authHeaders -TimeoutSec 15
                $status = $job.status
            }
            if ($status -ne "COMPLETED") { throw "Synthea job finished with status '$status' (expected COMPLETED)" }
        }
    } else {
        Write-Host "[skip] Synthea generation check (-SkipSynthea)" -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "=== Results: $($script:checks - $script:failures)/$script:checks passed ==="
if ($script:failures -gt 0) {
    Write-Host "$script:failures check(s) FAILED" -ForegroundColor Red
    exit 1
} else {
    Write-Host "All checks passed" -ForegroundColor Green
    exit 0
}
