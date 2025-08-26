# ScanX Post-Installation Configuration Script v1
# This script should be run after MSI installation to configure the agent

param(
    [switch]$Silent,
    [string]$Email = "",
    [string]$Interval = ""
)

Write-Host "ScanX Configuration Setup v1" -ForegroundColor Green
Write-Host "=============================" -ForegroundColor Green

# Check if running as administrator
if (-NOT ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole] "Administrator")) {
    Write-Host "This script must be run as Administrator" -ForegroundColor Red
    Write-Host "Please right-click PowerShell and select 'Run as Administrator'" -ForegroundColor Yellow
    exit 1
}

# Check if scanx is installed
$installDir = "C:\Program Files (x86)\scanx"
$configFile = "$installDir\config\agent.conf"

if (-not (Test-Path $configFile)) {
    Write-Host "ScanX is not installed or configuration file not found" -ForegroundColor Red
    Write-Host "Please install ScanX first using the MSI installer" -ForegroundColor Yellow
    exit 1
}

# Get user input (unless silent mode)
if (-not $Silent) {
    Write-Host ""
    Write-Host "Please provide the following information:" -ForegroundColor Cyan
    
    # Get email
    while ([string]::IsNullOrWhiteSpace($Email) -or $Email -notlike "*@*") {
        $Email = Read-Host "Enter employee email address"
        if ([string]::IsNullOrWhiteSpace($Email) -or $Email -notlike "*@*") {
            Write-Host "Please enter a valid email address" -ForegroundColor Red
        }
    }
    
    # Get interval
    Write-Host ""
    Write-Host "Available collection intervals:" -ForegroundColor Yellow
    Write-Host "  5m  - 5 minutes" -ForegroundColor White
    Write-Host "  10m - 10 minutes" -ForegroundColor White
    Write-Host "  15m - 15 minutes" -ForegroundColor White
    Write-Host "  30m - 30 minutes" -ForegroundColor White
    Write-Host "  1h  - 1 hour" -ForegroundColor White
    Write-Host "  2h  - 2 hours (default)" -ForegroundColor White
    Write-Host "  6h  - 6 hours" -ForegroundColor White
    Write-Host "  12h - 12 hours" -ForegroundColor White
    Write-Host "  24h - 24 hours" -ForegroundColor White
    
    $Interval = Read-Host "Enter collection interval [2h]"
    if ([string]::IsNullOrWhiteSpace($Interval)) {
        $Interval = "2h"
    }
}

# Update configuration
try {
    Write-Host ""
    Write-Host "Updating configuration..." -ForegroundColor Blue
    
    # Read current configuration
    $config = Get-Content $configFile -Raw
    
    # Update email and interval
    $config = $config -replace '"user_email": "[^"]*"', "`"user_email`": `"$Email`""
    $config = $config -replace '"interval": "[^"]*"', "`"interval`": `"$Interval`""
    
    # Write updated configuration
    $config | Set-Content $configFile -Encoding UTF8
    
    Write-Host "Configuration updated successfully!" -ForegroundColor Green
    Write-Host "Email: $Email" -ForegroundColor White
    Write-Host "Interval: $Interval" -ForegroundColor White
    
    # Check if OSQuery is installed
    Write-Host ""
    Write-Host "Checking OSQuery installation..." -ForegroundColor Blue
    $osqueryPath = "C:\Program Files\osquery\osqueryi.exe"
    
    if (Test-Path $osqueryPath) {
        Write-Host "OSQuery found: $osqueryPath" -ForegroundColor Green
    } else {
        Write-Host "OSQuery not found!" -ForegroundColor Red
        Write-Host "Please install OSQuery from: https://osquery.io/downloads/" -ForegroundColor Yellow
        Write-Host "Or install via Chocolatey: choco install osquery" -ForegroundColor Yellow
    }
    
    # Start the service
    Write-Host ""
    Write-Host "Starting ScanX service..." -ForegroundColor Blue
    try {
        Start-Service -Name "scanx" -ErrorAction Stop
        Write-Host "ScanX service started successfully!" -ForegroundColor Green
    } catch {
        Write-Host "Failed to start ScanX service: $($_.Exception.Message)" -ForegroundColor Red
        Write-Host "You may need to install OSQuery first" -ForegroundColor Yellow
    }
    
    Write-Host ""
    Write-Host "Configuration complete!" -ForegroundColor Green
    Write-Host "ScanX is now configured and should be running as a Windows service." -ForegroundColor White
    
} catch {
    Write-Host "Error updating configuration: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}
