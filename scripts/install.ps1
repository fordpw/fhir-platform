#!/usr/bin/env pwsh
# install.ps1 — FHIR R4 Platform Windows installer
#
# Usage:
#   .\install.ps1                              # fully interactive
#   .\install.ps1 -Mode server -InstallDir C:\fhir -Port 8080
#   .\install.ps1 -Mode client -ServerUrl http://backend-host:8080 -ClientPort 5173
#   .\install.ps1 -Mode all   -InstallDir C:\fhir
#
# Requires: PowerShell 7+, run as Administrator.

#Requires -RunAsAdministrator

param(
    [ValidateSet('all', 'server', 'client')]
    [string]$Mode = '',

    [string]$InstallDir  = '',
    [int]   $Port        = 0,          # backend port  (default 8080)
    [int]   $ClientPort  = 0,          # frontend port (default 80)
    [string]$ServerUrl   = '',         # for client-only mode: URL of the backend
    [string]$MongoUri    = '',         # MongoDB connection string
    [string]$JwtSecret   = '',         # APP_JWT_SECRET value
    [string]$CorsOrigin  = '',         # CORS allowed origin for the backend
    [switch]$InstallMongo,             # attempt to install MongoDB via winget
    [switch]$Unattended                # skip confirmation prompts
)

$ErrorActionPreference = 'Stop'
$VERSION = '1.0.0'

# ── Helpers ───────────────────────────────────────────────────────────────────

function Write-Header([string]$text) {
    Write-Host ""
    Write-Host "  $text" -ForegroundColor Cyan
    Write-Host ("  " + "─" * ($text.Length)) -ForegroundColor DarkCyan
}

function Prompt-Value([string]$label, [string]$default = '') {
    $display = if ($default) { "$label [$default]" } else { $label }
    $val = Read-Host "$display"
    if (-not $val) { $val = $default }
    return $val
}

function Prompt-Secret([string]$label) {
    $val = Read-Host -AsSecureString $label
    return [Runtime.InteropServices.Marshal]::PtrToStringAuto(
        [Runtime.InteropServices.Marshal]::SecureStringToBSTR($val))
}

function Generate-Secret {
    return [Convert]::ToBase64String(
        [System.Security.Cryptography.RandomNumberGenerator]::GetBytes(32))
}

function Fill-Template([string]$template, [hashtable]$vars) {
    foreach ($k in $vars.Keys) {
        $template = $template.Replace("{{$k}}", $vars[$k])
    }
    return $template
}

function Require-Java {
    try {
        $v = (java -version 2>&1 | Select-String 'version "([\d.]+)"').Matches[0].Groups[1].Value
        $major = [int]($v -split '\.')[0]
        if ($major -lt 17) { throw }
        Write-Host "  Java $v found." -ForegroundColor Green
    } catch {
        Write-Host "  ERROR: Java 17+ is required but not found or too old." -ForegroundColor Red
        Write-Host "  Download from: https://adoptium.net/"
        exit 1
    }
}

function Require-Nginx {
    if (-not (Get-Command nginx -ErrorAction SilentlyContinue)) {
        Write-Host "  nginx not found. Attempting to install via winget..." -ForegroundColor Yellow
        winget install nginx --accept-package-agreements --accept-source-agreements
    }
    Write-Host "  nginx found." -ForegroundColor Green
}

function Install-MongoIfRequested {
    if ($InstallMongo) {
        Write-Host "  Installing MongoDB via winget..." -ForegroundColor Yellow
        winget install MongoDB.Server --accept-package-agreements --accept-source-agreements
        Start-Service -Name MongoDB
        Write-Host "  MongoDB installed and started." -ForegroundColor Green
    }
}

function Register-JavaService([string]$name, [string]$jar, [string]$configDir) {
    # Use sc.exe to register the JAR as a Windows service via the JavaServiceWrapper
    # or simply wrap with a scheduled task. Here we use a PowerShell-based approach
    # compatible without third-party tools.
    $action  = New-ScheduledTaskAction -Execute 'java' -Argument "-jar `"$jar`" --spring.config.location=`"$configDir\application.yaml`"" -WorkingDirectory (Split-Path $jar)
    $trigger = New-ScheduledTaskTrigger -AtStartup
    $settings = New-ScheduledTaskSettingsSet -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1) -StartWhenAvailable
    $principal = New-ScheduledTaskPrincipal -UserId 'SYSTEM' -RunLevel Highest
    Register-ScheduledTask -TaskName $name -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Force
    Start-ScheduledTask -TaskName $name
    Write-Host "  Registered and started scheduled task: $name" -ForegroundColor Green
}

function Register-NginxService([string]$confPath, [string]$htmlDir) {
    # Copy config and register nginx as a scheduled task at startup
    $nginxExe = (Get-Command nginx).Source
    $action   = New-ScheduledTaskAction -Execute $nginxExe -Argument "-c `"$confPath`""
    $trigger  = New-ScheduledTaskTrigger -AtStartup
    $settings = New-ScheduledTaskSettingsSet -StartWhenAvailable
    $principal= New-ScheduledTaskPrincipal -UserId 'SYSTEM' -RunLevel Highest
    Register-ScheduledTask -TaskName 'FHIR-AdminUI-nginx' -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Force
    Start-ScheduledTask -TaskName 'FHIR-AdminUI-nginx'
    Write-Host "  Registered and started nginx (FHIR-AdminUI-nginx)." -ForegroundColor Green
}

# ── Banner ────────────────────────────────────────────────────────────────────

Write-Host ""
Write-Host "  ╔══════════════════════════════════════════╗" -ForegroundColor Blue
Write-Host "  ║   FHIR R4 Platform — Windows Installer   ║" -ForegroundColor Blue
Write-Host "  ║   Version $VERSION                           ║" -ForegroundColor Blue
Write-Host "  ╚══════════════════════════════════════════╝" -ForegroundColor Blue
Write-Host ""

# ── Gather install mode ───────────────────────────────────────────────────────

Write-Header "Installation mode"
if (-not $Mode) {
    Write-Host "  1. All-in-one   — server + client on this host"
    Write-Host "  2. Server only  — backend + MongoDB (API only)"
    Write-Host "  3. Client only  — admin UI pointing to a remote server"
    $choice = Prompt-Value "Select [1/2/3]" "1"
    $Mode = switch ($choice) { '2' { 'server' } '3' { 'client' } default { 'all' } }
}
Write-Host "  Mode: $Mode" -ForegroundColor Green

# ── Install directory ─────────────────────────────────────────────────────────

Write-Header "Install directory"
if (-not $InstallDir) {
    $InstallDir = Prompt-Value "Install directory" "C:\fhir-platform"
}
New-Item -ItemType Directory -Force -Path $InstallDir | Out-Null
New-Item -ItemType Directory -Force -Path "$InstallDir\config" | Out-Null
Write-Host "  Directory: $InstallDir" -ForegroundColor Green

# ── Locate release artifacts ──────────────────────────────────────────────────

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot  = Split-Path -Parent $scriptDir

$jarPath  = Get-ChildItem "$repoRoot\fhir-server\target\*.jar" -Exclude "*sources*","*javadoc*" -ErrorAction SilentlyContinue | Select-Object -First 1
$uiDist   = "$repoRoot\fhir-admin-ui\dist"

# ── SERVER component ──────────────────────────────────────────────────────────

if ($Mode -in 'all','server') {
    Write-Header "Server configuration"
    Require-Java
    Install-MongoIfRequested

    if (-not $Port) { $Port = [int](Prompt-Value "Backend port" "8080") }
    if (-not $MongoUri) { $MongoUri = Prompt-Value "MongoDB URI" "mongodb://localhost:27017/fhirdb" }
    if (-not $JwtSecret) {
        $gen = Generate-Secret
        Write-Host "  Generating JWT secret automatically..." -ForegroundColor Yellow
        $JwtSecret = $gen
    }
    $syntheaJar = "$InstallDir\synthea-with-dependencies.jar"
    $syntheaOut = "$InstallDir\synthea-output"
    New-Item -ItemType Directory -Force -Path $syntheaOut | Out-Null
    $corsOriginDefault = if ($Mode -eq 'all') { "http://localhost:$ClientPort" } else { "http://localhost:80" }
    if (-not $CorsOrigin) { $CorsOrigin = Prompt-Value "CORS allowed origin" $corsOriginDefault }

    # Write application.yaml
    $template = Get-Content "$repoRoot\config\application.yaml.template" -Raw
    $config = Fill-Template $template @{
        SERVER_PORT       = "$Port"
        MONGO_URI         = $MongoUri
        JWT_SECRET        = $JwtSecret
        SYNTHEA_JAR_PATH  = $syntheaJar
        SYNTHEA_OUTPUT_DIR= $syntheaOut
        CORS_ORIGIN       = $CorsOrigin
    }
    $config | Set-Content "$InstallDir\config\application.yaml" -Encoding utf8
    Write-Host "  Config written: $InstallDir\config\application.yaml" -ForegroundColor Green

    # Copy JAR
    if ($jarPath) {
        Copy-Item $jarPath.FullName "$InstallDir\fhir-server.jar" -Force
        Write-Host "  JAR copied: $InstallDir\fhir-server.jar" -ForegroundColor Green
    } else {
        Write-Host "  WARNING: fhir-server JAR not found in $repoRoot\fhir-server\target\." -ForegroundColor Yellow
        Write-Host "           Run 'mvn package' first or download the release JAR." -ForegroundColor Yellow
    }

    # Register service
    if (-not $Unattended) {
        $register = Prompt-Value "Register as Windows startup task? [Y/n]" "Y"
    }
    if ($Unattended -or $register -match '^[Yy]') {
        Register-JavaService 'FHIR-Server' "$InstallDir\fhir-server.jar" "$InstallDir\config"
    }
}

# ── CLIENT component ──────────────────────────────────────────────────────────

if ($Mode -in 'all','client') {
    Write-Header "Client (UI) configuration"
    Require-Nginx

    if (-not $ClientPort) { $ClientPort = [int](Prompt-Value "UI port" "80") }
    if ($Mode -eq 'client' -and -not $ServerUrl) {
        $ServerUrl = Prompt-Value "Backend server URL (e.g. http://192.168.1.10:8080)"
    }
    if ($Mode -eq 'all') { $ServerUrl = "http://localhost:$Port" }

    # Copy UI dist
    $uiTarget = "$InstallDir\ui"
    if (Test-Path $uiDist) {
        Copy-Item $uiDist $uiTarget -Recurse -Force
        Write-Host "  UI files copied: $uiTarget" -ForegroundColor Green
    } else {
        Write-Host "  WARNING: UI dist not found at $uiDist." -ForegroundColor Yellow
        Write-Host "           Run 'npm run build' first or download the release UI archive." -ForegroundColor Yellow
    }

    # Write nginx.conf
    $nginxTemplate = Get-Content "$repoRoot\config\nginx-client.conf.template" -Raw
    $nginxConf = Fill-Template $nginxTemplate @{
        CLIENT_PORT      = "$ClientPort"
        SERVER_NAME      = "localhost"
        INSTALL_DIR      = $InstallDir.Replace('\','/')
        FHIR_SERVER_URL  = $ServerUrl
    }
    $nginxConf | Set-Content "$InstallDir\config\nginx.conf" -Encoding utf8
    Write-Host "  nginx config written: $InstallDir\config\nginx.conf" -ForegroundColor Green

    # Register nginx service
    if (-not $Unattended) {
        $register = Prompt-Value "Register nginx as Windows startup task? [Y/n]" "Y"
    }
    if ($Unattended -or $register -match '^[Yy]') {
        Register-NginxService "$InstallDir\config\nginx.conf" $uiTarget
    }
}

# ── Summary ───────────────────────────────────────────────────────────────────

Write-Header "Installation complete"
if ($Mode -in 'all','server') {
    Write-Host "  FHIR API  : http://localhost:$Port/fhir/"
    Write-Host "  Auth API  : http://localhost:$Port/api/auth/login"
    Write-Host "  Config    : $InstallDir\config\application.yaml"
    Write-Host ""
    Write-Host "  Default login: admin / admin"
    Write-Host "  IMPORTANT: Set APP_JWT_SECRET before exposing this server beyond localhost." -ForegroundColor Yellow
}
if ($Mode -in 'all','client') {
    Write-Host "  Admin UI  : http://localhost:$ClientPort"
}
Write-Host ""
