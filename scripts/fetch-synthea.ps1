<#
.SYNOPSIS
    Downloads the Synthea JAR required by the FHIR server's data generator.

.DESCRIPTION
    Only needed when running the backend directly (`mvn spring-boot:run`).
    The Docker image downloads the JAR at build time, so this is not required
    for `docker compose up`.

    The JAR is placed at fhir-server/synthea-with-dependencies.jar, which is
    the default value of `app.synthea.jar-path` when the working directory is
    fhir-server/.

.PARAMETER Version
    Synthea release tag to download. Defaults to v4.0.0 (matches the Dockerfile).

.PARAMETER Force
    Re-download even if the JAR already exists.

.EXAMPLE
    .\scripts\fetch-synthea.ps1
#>
[CmdletBinding()]
param(
    [string]$Version = 'v4.0.0',
    [switch]$Force
)

$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $PSScriptRoot
$destination = Join-Path $repoRoot 'fhir-server\synthea-with-dependencies.jar'
$url = "https://github.com/synthetichealth/synthea/releases/download/$Version/synthea-with-dependencies.jar"

if ((Test-Path $destination) -and -not $Force) {
    $sizeMb = [math]::Round((Get-Item $destination).Length / 1MB, 1)
    Write-Host "Synthea JAR already present at $destination ($sizeMb MB). Use -Force to re-download."
    exit 0
}

Write-Host "Downloading Synthea $Version (~200 MB)..."
Write-Host "  from: $url"
Write-Host "  to:   $destination"

$tempFile = "$destination.download"

try {
    # Progress rendering makes Invoke-WebRequest dramatically slower for large files.
    $previousProgress = $ProgressPreference
    $ProgressPreference = 'SilentlyContinue'
    Invoke-WebRequest -Uri $url -OutFile $tempFile -UseBasicParsing
    $ProgressPreference = $previousProgress

    if ((Get-Item $tempFile).Length -lt 1MB) {
        throw "Downloaded file is implausibly small; the release asset may have moved."
    }

    Move-Item -Path $tempFile -Destination $destination -Force
}
catch {
    if (Test-Path $tempFile) { Remove-Item $tempFile -Force }
    throw
}

$sizeMb = [math]::Round((Get-Item $destination).Length / 1MB, 1)
Write-Host "Done. Synthea JAR ready ($sizeMb MB)."
