# Windows Installation Script for scanx
# This script must be run with elevated privileges and proper execution policy
# 
# Installation Methods:
# 1. Interactive: Right-click PowerShell -> Run as Administrator, then:
#    Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
#    .\install-windows.ps1
#
# 2. Silent: Right-click PowerShell -> Run as Administrator, then:
#    Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
#    .\install-windows.ps1 -Email "user@company.com" -Interval "10m"
#
# 3. Bypass (one-time): Right-click PowerShell -> Run as Administrator, then:
#    powershell -ExecutionPolicy Bypass -File install-windows.ps1

param(
    [switch]$Force,
    [string]$Email = "",
    [string]$Interval = "",
    [switch]$Help,
    [switch]$BypassExecutionPolicy
)

if ($Help) {
    Write-Host "Usage: install-windows.ps1 [-Email EMAIL] [-Interval INTERVAL] [-BypassExecutionPolicy]"
    Write-Host "  -Email EMAIL              Employee email (required for silent install)"
    Write-Host "  -Interval INTERVAL        Data collection interval (default: 10m)"
    Write-Host "  -Force                    Force installation even if osquery not found"
    Write-Host "  -BypassExecutionPolicy    Bypass execution policy check"
    Write-Host "  -Help                     Show this help message"
    Write-Host ""
    Write-Host "Installation Methods:"
    Write-Host "  1. Interactive: Right-click PowerShell -> Run as Administrator"
    Write-Host "     Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser"
    Write-Host "     .\install-windows.ps1"
    Write-Host ""
    Write-Host "  2. Silent: Right-click PowerShell -> Run as Administrator"
    Write-Host "     Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser"
    Write-Host "     .\install-windows.ps1 -Email 'user@company.com' -Interval '10m'"
    Write-Host ""
    Write-Host "  3. Bypass (one-time): Right-click PowerShell -> Run as Administrator"
    Write-Host "     powershell -ExecutionPolicy Bypass -File install-windows.ps1"
    exit 0
}

$ErrorActionPreference = "Stop"

# Check execution policy unless bypassed
if (-not $BypassExecutionPolicy) {
    $currentPolicy = Get-ExecutionPolicy -Scope CurrentUser
    if ($currentPolicy -eq "Restricted") {
        Write-Host "❌ PowerShell execution policy is restricted" -ForegroundColor Red
        Write-Host ""
        Write-Host "To fix this, run PowerShell as Administrator and execute:" -ForegroundColor Yellow
        Write-Host "Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser" -ForegroundColor Cyan
        Write-Host ""
        Write-Host "Or use the bypass method:" -ForegroundColor Yellow
        Write-Host "powershell -ExecutionPolicy Bypass -File install-windows.ps1" -ForegroundColor Cyan
        Write-Host ""
        Write-Host "For more information, see: https://go.microsoft.com/fwlink/?LinkID=135170" -ForegroundColor Blue
        exit 1
    }
}

$AGENT_NAME = "scanx.exe"
$INSTALL_DIR = "C:\Program Files (x86)\scanx"
$CONFIG_DIR = "$INSTALL_DIR\config"
$LOG_DIR = "$INSTALL_DIR\logs"
$SERVICE_NAME = "scanx"

Write-Host "🪟 Installing scanx on Windows..." -ForegroundColor Green
Write-Host "Execution Policy: $(Get-ExecutionPolicy -Scope CurrentUser)" -ForegroundColor Cyan

# Check if running as Administrator
if (-NOT ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole] "Administrator")) {
    Write-Host "❌ This script must be run as Administrator" -ForegroundColor Red
    Write-Host ""
    Write-Host "To fix this:" -ForegroundColor Yellow
    Write-Host "1. Right-click on PowerShell" -ForegroundColor White
    Write-Host "2. Select 'Run as Administrator'" -ForegroundColor White
    Write-Host "3. Navigate to this directory" -ForegroundColor White
    Write-Host "4. Run the script again" -ForegroundColor White
    Write-Host ""
    Write-Host "Or use the bypass method:" -ForegroundColor Yellow
    Write-Host "powershell -ExecutionPolicy Bypass -File install-windows.ps1" -ForegroundColor Cyan
    exit 1
}

# Function to check if osquery is installed
function Test-OSQuery {
    $osqueryPath = "C:\Program Files\osquery\osqueryi.exe"
    return Test-Path $osqueryPath
}

# Install osquery if not present
if (-not (Test-OSQuery)) {
    Write-Host "⚠️  OSQuery not found. Please install osquery manually:" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Download from: https://osquery.io/downloads/" -ForegroundColor Cyan
    Write-Host "Or install via Chocolatey: choco install osquery" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "After installing osquery, run this script again." -ForegroundColor Yellow
    exit 1
} else {
    Write-Host "✅ OSQuery found: C:\Program Files\osquery\osqueryi.exe" -ForegroundColor Green
}

# Stop existing service if running
try {
    $service = Get-Service -Name $SERVICE_NAME -ErrorAction SilentlyContinue
    if ($service) {
        Write-Host "🔄 Stopping existing scanx service..." -ForegroundColor Yellow
        Stop-Service -Name $SERVICE_NAME -Force -ErrorAction SilentlyContinue
        
        # Uninstall existing service
        $scResult = & sc.exe delete $SERVICE_NAME 2>$null
        Start-Sleep -Seconds 2
    }
} catch {
    # Service doesn't exist, continue
}

# Create directories
Write-Host "📁 Creating directories..." -ForegroundColor Blue
New-Item -ItemType Directory -Path $INSTALL_DIR -Force | Out-Null
New-Item -ItemType Directory -Path $CONFIG_DIR -Force | Out-Null
New-Item -ItemType Directory -Path $LOG_DIR -Force | Out-Null

# Copy binary
Write-Host "📦 Installing binary..." -ForegroundColor Blue
Copy-Item ".\$AGENT_NAME" -Destination "$INSTALL_DIR\$AGENT_NAME" -Force

# Collect user input (interactive mode if not provided via CLI)
if (-not [string]::IsNullOrWhiteSpace($Email)) {
    # Silent mode
    $user_email = $Email
    $user_interval = if ([string]::IsNullOrWhiteSpace($Interval)) { "10m" } else { $Interval }
    Write-Host "📋 Using provided configuration:" -ForegroundColor Cyan
    Write-Host "   📧 Email: $user_email" -ForegroundColor White
    Write-Host "   ⏱️  Interval: $user_interval" -ForegroundColor White
} else {
    # Interactive mode
    Write-Host ""
    Write-Host "📋 Configuration Setup" -ForegroundColor Cyan
    Write-Host "=====================" -ForegroundColor Cyan

    # Get email (required)
    $user_email = ""
    while ([string]::IsNullOrWhiteSpace($user_email) -or $user_email -notlike "*@*") {
        $user_email = Read-Host "📧 Enter employee email (required)"
        if ([string]::IsNullOrWhiteSpace($user_email) -or $user_email -notlike "*@*") {
            Write-Host "❌ Please enter a valid email address" -ForegroundColor Red
        }
    }

    # Get interval (optional)
    Write-Host ""
    Write-Host "⏱️  Data collection interval examples:" -ForegroundColor Yellow
    Write-Host "   - 5m   (5 minutes)" -ForegroundColor White
    Write-Host "   - 10m  (10 minutes - default)" -ForegroundColor White
    Write-Host "   - 1h   (1 hour)" -ForegroundColor White
    Write-Host "   - 2h   (2 hours)" -ForegroundColor White
    $user_interval = Read-Host "⏱️  Enter collection interval [10m]"
    if ([string]::IsNullOrWhiteSpace($user_interval)) {
        $user_interval = "10m"
    }
}

# Copy configuration files
Write-Host ""
Write-Host "⚙️  Installing configuration..." -ForegroundColor Blue
New-Item -ItemType Directory -Path "$CONFIG_DIR\config" -Force | Out-Null
Copy-Item ".\config\*" -Destination "$CONFIG_DIR\config" -Recurse -Force

# Update agent.conf with user input
Write-Host "📝 Updating configuration with your settings..." -ForegroundColor Blue
$configFile = "$CONFIG_DIR\config\agent.conf"
$configContent = Get-Content $configFile -Raw
$configContent = $configContent -replace '"user_email": "[^"]*"', "`"user_email`": `"$user_email`""
$configContent = $configContent -replace '"interval": "[^"]*"', "`"interval`": `"$user_interval`""
$configContent | Set-Content $configFile

Write-Host "✅ Configuration updated:" -ForegroundColor Green
Write-Host "   📧 Email: $user_email" -ForegroundColor White
Write-Host "   ⏱️  Interval: $user_interval" -ForegroundColor White

# Create the service using sc.exe
Write-Host "🔧 Installing Windows service..." -ForegroundColor Blue
$binaryPath = "`"$INSTALL_DIR\$AGENT_NAME`" -daemon"
$scResult = & sc.exe create $SERVICE_NAME binPath= $binaryPath start= auto DisplayName= "scanx"

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to create service. Error: $scResult" -ForegroundColor Red
    exit 1
}

# Configure service description
& sc.exe description $SERVICE_NAME "scanx - System Monitoring and Device Management Service"

# Configure service recovery options (restart on failure)
& sc.exe failure $SERVICE_NAME reset= 86400 actions= restart/10000/restart/20000/restart/30000

# Set service to start automatically
& sc.exe config $SERVICE_NAME start= auto

# Start the service
Write-Host "🚀 Starting scanx service..." -ForegroundColor Green
$startResult = & sc.exe start $SERVICE_NAME

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ scanx service started successfully!" -ForegroundColor Green
} else {
    Write-Host "⚠️  Service may not have started. Check status with: sc query $SERVICE_NAME" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "🎉 Installation completed!" -ForegroundColor Green
Write-Host ""
Write-Host "📋 Service Management Commands:" -ForegroundColor Cyan
Write-Host "   Start:   sc start $SERVICE_NAME" -ForegroundColor White
Write-Host "   Stop:    sc stop $SERVICE_NAME" -ForegroundColor White
Write-Host "   Status:  sc query $SERVICE_NAME" -ForegroundColor White
Write-Host "   Logs:    Get-Content `"$LOG_DIR\scanx.log`" -Tail 50 -Wait" -ForegroundColor White
Write-Host ""
Write-Host "📁 Configuration: $CONFIG_DIR" -ForegroundColor Cyan
Write-Host "📁 Binary: $INSTALL_DIR\$AGENT_NAME" -ForegroundColor Cyan
Write-Host "📁 Logs: $LOG_DIR" -ForegroundColor Cyan
Write-Host ""
Write-Host "ℹ️  The agent will now run automatically on system startup" -ForegroundColor Blue

# Create uninstall script
$uninstallContent = @"
# Uninstall scanx
Write-Host "🗑️  Uninstalling scanx..." -ForegroundColor Yellow

# Stop and remove service
try {
    Stop-Service -Name "$SERVICE_NAME" -Force -ErrorAction SilentlyContinue
    sc.exe delete "$SERVICE_NAME"
    Write-Host "✅ Service removed" -ForegroundColor Green
} catch {
    Write-Host "⚠️  Service removal failed or service not found" -ForegroundColor Yellow
}

# Remove files
if (Test-Path "$INSTALL_DIR") {
    Remove-Item "$INSTALL_DIR" -Recurse -Force
    Write-Host "✅ Files removed" -ForegroundColor Green
}

Write-Host "🎉 scanx uninstalled successfully!" -ForegroundColor Green
"@

$uninstallContent | Out-File -FilePath "$INSTALL_DIR\uninstall.ps1" -Encoding UTF8
Write-Host ""
Write-Host "📝 Uninstall script created: $INSTALL_DIR\uninstall.ps1" -ForegroundColor Cyan