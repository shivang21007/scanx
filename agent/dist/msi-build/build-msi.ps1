# PowerShell script to build scanx MSI with proper execution policy handling
param(
    [switch]$BypassExecutionPolicy
)

Write-Host "Building scanx MSI Installer" -ForegroundColor Green
Write-Host "================================" -ForegroundColor Green

# Check execution policy
$currentPolicy = Get-ExecutionPolicy -Scope CurrentUser
if ($currentPolicy -eq "Restricted" -and -not $BypassExecutionPolicy) {
    Write-Host "PowerShell execution policy is restricted" -ForegroundColor Red
    Write-Host ""
    Write-Host "To fix this, run PowerShell as Administrator and execute:" -ForegroundColor Yellow
    Write-Host "Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Or use the bypass parameter:" -ForegroundColor Yellow
    Write-Host ".\build-msi.ps1 -BypassExecutionPolicy" -ForegroundColor Cyan
    Write-Host ""
    exit 1
}

# Check if WiX tools are available
try {
    $candleVersion = & candle -? 2>&1 | Select-String "version"
    if ($LASTEXITCODE -ne 0) {
        throw "WiX Toolset not found"
    }
    Write-Host "WiX Toolset found" -ForegroundColor Green
} catch {
    Write-Host "WiX Toolset not found" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please install WiX Toolset:" -ForegroundColor Yellow
    Write-Host "Download from: https://wixtoolset.org/releases/" -ForegroundColor Cyan
    Write-Host "Or install via Chocolatey: choco install wixtoolset" -ForegroundColor Cyan
    Write-Host ""
    exit 1
}

# Check if required files exist
$requiredFiles = @(
    "scanx.wxs",
    "C:\Users\Octro\Downloads\scanx\agent\dist\builds\scanx-windows-amd64.exe",
    "C:\Users\Octro\Downloads\scanx\agent\config\agent.conf",
    "C:\Users\Octro\Downloads\scanx\agent\config\queries.yml"
)

Write-Host "Checking required files..." -ForegroundColor Blue
foreach ($file in $requiredFiles) {
    if (Test-Path $file) {
        Write-Host "   OK: $file" -ForegroundColor Green
    } else {
        Write-Host "   MISSING: $file" -ForegroundColor Red
        Write-Host ""
        Write-Host "Build cannot proceed. Missing required files." -ForegroundColor Red
        exit 1
    }
}

# Build MSI
Write-Host ""
Write-Host "Building MSI..." -ForegroundColor Blue

# Compile WiX sources
Write-Host "   Compiling WiX sources..." -ForegroundColor Yellow
& candle scanx.wxs
if ($LASTEXITCODE -ne 0) {
    Write-Host "WiX compilation failed" -ForegroundColor Red
    exit 1
}

# Link to create MSI
Write-Host "   Linking MSI..." -ForegroundColor Yellow
& light -ext WixUIExtension scanx.wixobj -o scanx.msi
if ($LASTEXITCODE -ne 0) {
    Write-Host "WiX linking failed" -ForegroundColor Red
    exit 1
}

# Clean up intermediate files
Remove-Item "scanx.wixobj" -ErrorAction SilentlyContinue

Write-Host ""
Write-Host "MSI created successfully!" -ForegroundColor Green
Write-Host ""
Write-Host "Installation Instructions:" -ForegroundColor Cyan
Write-Host "   1. Right-click scanx.msi" -ForegroundColor White
Write-Host "   2. Select 'Install'" -ForegroundColor White
Write-Host "   3. Follow the installation wizard" -ForegroundColor White
Write-Host ""
Write-Host "MSI Location: $(Resolve-Path scanx.msi)" -ForegroundColor Cyan
$fileSize = [math]::Round((Get-Item scanx.msi).Length / 1MB, 2)
Write-Host "File Size: $fileSize MB" -ForegroundColor Cyan
