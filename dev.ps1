# Unified runner for development and production
param(
    [ValidateSet("development", "production")]
    [string]$Environment = "development",
    [int]$Port = 5000,
    [switch]$UsePm2,
    [switch]$SkipMigrations,
    [string]$LogLevel = "info"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

# Initialize logging
$LogDir = Join-Path $PSScriptRoot "logs"
if (-not (Test-Path $LogDir)) { 
    New-Item -ItemType Directory -Path $LogDir | Out-Null 
}
$LogFile = Join-Path $LogDir "app-$(Get-Date -Format "yyyy-MM-dd").log"

function Write-Log {
    param([string]$Message, [string]$Level = "INFO")
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $logMessage = "[$timestamp] [$Level] $Message"
    Add-Content -Path $LogFile -Value $logMessage
    Write-Host $Message -ForegroundColor $(if ($Level -eq "ERROR") { "Red" } elseif ($Level -eq "WARNING") { "Yellow" } else { "White" })
}

function Stop-ProcessOnPort {
    param([int]$Port)
    $portInUse = netstat -ano | Select-String ":$Port "
    if ($portInUse) {
        $processId = $portInUse -split "\s+" | Select-Object -Last 1
        try {
            Stop-Process -Id $processId -Force -ErrorAction Stop
            Write-Log "Port $Port freed successfully" "INFO"
        } catch {
            Write-Log "Could not stop process on port $Port" "WARNING"
        }
    }
}

function Test-Command {
    param(
        [Parameter(Mandatory = $true)][string]$CommandName,
        [Parameter(Mandatory = $true)][string]$InstallHint
    )
    try {
        $null = & $CommandName -v 2>$null
    } catch {
        throw " $CommandName is required but not found. $InstallHint"
    }
}

function Test-EnvironmentVariables {
    $required = @("DATABASE_URL", "NODE_ENV")
    $missing = $required | Where-Object { -not (Get-Item "env:$_" -ErrorAction SilentlyContinue) }
    if ($missing) {
        Write-Log "Missing environment variables: $($missing -join ", ")" "WARNING"
        return $false
    }
    return $true
}

try {
    Write-Log "Starting Resume Customizer Pro - $Environment mode" "INFO"

    # Prerequisites
    Test-Command -CommandName "node" -InstallHint "Install Node.js from https://nodejs.org"
    Test-Command -CommandName "npm" -InstallHint "Install Node.js which includes npm"
    
    if ($UsePm2) {
        try {
            $null = (pm2 -v)
        } catch {
            throw "PM2 not found. Install with: npm i -g pm2"
        }
    }

    # Port check
    if ($Environment -eq "development" -and $Port -gt 0) {
        Stop-ProcessOnPort -Port $Port
    }

    # Environment setup
    $env:NODE_ENV = $Environment

    # Dependencies
    if (-not (Test-Path "node_modules")) {
        Write-Log "Installing dependencies..." "INFO"
        if (Test-Path "package-lock.json") {
            npm ci
        } else {
            npm install
        }
        if ($LASTEXITCODE -ne 0) { throw "Dependency installation failed" }
    }

    # Database
    if (-not $SkipMigrations) {
        Write-Log "Running database migrations..." "INFO"
        npm run db:push
        if ($LASTEXITCODE -ne 0) { throw "Database migration failed" }
    }

    # Start application
    if ($Environment -eq "development") {
        Write-Log "Starting development server..." "INFO"
        npm run dev
        exit $LASTEXITCODE
    } else {
        Write-Log "Building for production..." "INFO"
        npm run build
        if ($LASTEXITCODE -ne 0) { throw "Build failed" }

        if (-not (Test-EnvironmentVariables)) {
            throw "Environment validation failed"
        }

        if ($UsePm2) {
            Write-Log "Starting with PM2..." "INFO"
            npm run pm2:start
            if ($LASTEXITCODE -ne 0) { throw "PM2 start failed" }
            Start-Job -ScriptBlock { pm2 logs --lines 0 }
        } else {
            Write-Log "Starting production server..." "INFO"
            npm run start
            if ($LASTEXITCODE -ne 0) { throw "Start failed" }
        }
    }
} catch {
    Write-Log $_.Exception.Message "ERROR"
    Write-Log "For support, visit: https://github.com/12shivam219/Resume_Customizer_Pro/issues" "WARNING"
    exit 1
}
