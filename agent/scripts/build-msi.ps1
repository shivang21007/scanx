# PowerShell script to build scanx MSI with proper execution policy handling
# Supports both AMD64 and ARM64 architectures
# Usage: .\scripts\build-msi.ps1 [amd64|arm64]
# Example: .\scripts\build-msi.ps1 amd64

param(
    [string]$Arch = "",
    [switch]$BypassExecutionPolicy
)

# Get script directory and project root
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Split-Path -Parent $ScriptDir

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
    Write-Host ".\scripts\build-msi.ps1 -BypassExecutionPolicy" -ForegroundColor Cyan
    Write-Host ""
    exit 1
}

# Architecture selection
if ([string]::IsNullOrEmpty($Arch)) {
    Write-Host ""
    Write-Host "Architecture Options:" -ForegroundColor Cyan
    Write-Host "1. AMD64 (x86_64)"
    Write-Host "2. ARM64"
    Write-Host ""
    $archChoice = Read-Host "Choose architecture [1-2]"
    
    switch ($archChoice) {
        "1" { $Arch = "amd64" }
        "2" { $Arch = "arm64" }
        default {
            Write-Host "Invalid choice, defaulting to amd64" -ForegroundColor Yellow
            $Arch = "amd64"
        }
    }
}

if ($Arch -ne "amd64" -and $Arch -ne "arm64") {
    Write-Host "Invalid architecture: $Arch. Must be 'amd64' or 'arm64'" -ForegroundColor Red
    exit 1
}

# Map architecture to osquery naming
$osqueryArch = if ($Arch -eq "amd64") { "x86_64" } else { "arm64" }

# Get version from agent.conf
$configPath = Join-Path $ProjectRoot "config\agent.conf"
if (-not (Test-Path $configPath)) {
    Write-Host "Error: agent.conf not found at $configPath" -ForegroundColor Red
    exit 1
}

try {
    $configJson = Get-Content $configPath -Raw | ConvertFrom-Json
    $VERSION = $configJson.version
    Write-Host "Version: $VERSION" -ForegroundColor Cyan
} catch {
    Write-Host "Failed to read version from agent.conf, using default: 1.0.0" -ForegroundColor Yellow
    $VERSION = "1.0.0"
}

# Set up paths
$BINARY_NAME = "scanx-windows-$Arch.exe"
$OSQUERY_NAME = "osqueryi-windows-$Arch.exe"
$BUILD_DIR = Join-Path $ProjectRoot "dist\windows-build\$Arch-build"
$WINDOWS_SCRIPTS_DIR = Join-Path $ScriptDir "windows"
$BUILDS_DIR = Join-Path $ProjectRoot "dist\builds"
$OSQUERY_DIR = Join-Path $ProjectRoot "dist\builds-osqueryi"

Write-Host "Architecture: $Arch" -ForegroundColor Cyan
Write-Host "Build Directory: $BUILD_DIR" -ForegroundColor Cyan
Write-Host ""

# Check if binary exists
$binaryPath = Join-Path $BUILDS_DIR $BINARY_NAME
if (-not (Test-Path $binaryPath)) {
    Write-Host "Error: Binary not found: $binaryPath" -ForegroundColor Red
    Write-Host "Please run ./scripts/build.sh first to build the binaries." -ForegroundColor Yellow
    exit 1
}

# Check if osquery exists
$osqueryPath = Join-Path $OSQUERY_DIR $OSQUERY_NAME
if (-not (Test-Path $osqueryPath)) {
    Write-Host "Error: OSQuery binary not found: $osqueryPath" -ForegroundColor Red
    exit 1
}

# Check if WiX tools are available
$wixPath = $null
$candlePath = $null
$lightPath = $null

# Method 1: Check if candle is in PATH
try {
    $candleCmd = Get-Command candle -ErrorAction SilentlyContinue
    if ($candleCmd) {
        $candlePath = $candleCmd.Source
        $lightPath = $candlePath.Replace("candle.exe", "light.exe")
        $wixPath = Split-Path $candlePath
        Write-Host "WiX Toolset found in PATH: $wixPath" -ForegroundColor Green
    }
} catch { }

# Define common WiX installation paths
$commonPaths = @(
    "C:\Program Files (x86)\WiX Toolset v3.11\bin",
    "C:\Program Files (x86)\WiX Toolset v3.14\bin",
    "C:\Program Files\WiX Toolset v3.11\bin",
    "C:\Program Files\WiX Toolset v3.14\bin"
)

# Method 2: Check common installation paths
if (-not $candlePath) {
    foreach ($path in $commonPaths) {
        if (Test-Path "$path\candle.exe") {
            $candlePath = "$path\candle.exe"
            $lightPath = "$path\light.exe"
            $wixPath = $path
            Write-Host "WiX Toolset found at: $path" -ForegroundColor Green
            break
        }
    }
}

# Method 3: Check if Chocolatey installed WiX but didn't run installer
if (-not $candlePath) {
    $chocoWixInstaller = "C:\ProgramData\chocolatey\lib\wixtoolset\tools\wix314.exe"
    if (Test-Path $chocoWixInstaller) {
        Write-Host "Found WiX installer from Chocolatey, but WiX tools not installed" -ForegroundColor Yellow
        Write-Host "Running WiX installer..." -ForegroundColor Blue
        
        try {
            # Run the WiX installer silently
            Start-Process -FilePath $chocoWixInstaller -ArgumentList "/quiet" -Wait -NoNewWindow
            Write-Host "WiX installer completed" -ForegroundColor Green
            
            # Check again for WiX tools
            foreach ($path in $commonPaths) {
                if (Test-Path "$path\candle.exe") {
                    $candlePath = "$path\candle.exe"
                    $lightPath = "$path\light.exe" 
                    $wixPath = $path
                    Write-Host "WiX Toolset now available at: $path" -ForegroundColor Green
                    break
                }
            }
        } catch {
            Write-Host "Failed to run WiX installer: $($_.Exception.Message)" -ForegroundColor Red
        }
    }
}

# Final check
if (-not $candlePath) {
    Write-Host "WiX Toolset not found" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please install WiX Toolset:" -ForegroundColor Yellow
    Write-Host "Method 1: Download and install manually from: https://wixtoolset.org/releases/" -ForegroundColor Cyan
    Write-Host "Method 2: If you used Chocolatey, run the installer manually:" -ForegroundColor Cyan
    Write-Host "  C:\ProgramData\chocolatey\lib\wixtoolset\tools\wix314.exe" -ForegroundColor White
    Write-Host ""
    exit 1
} else {
    # Test the tools
    try {
        $candleVersion = & $candlePath -? 2>&1 | Select-String "version"
        Write-Host "WiX Toolset validation successful" -ForegroundColor Green
    } catch {
        Write-Host "WiX tools found but not working properly" -ForegroundColor Red
        exit 1
    }
}

# Clean and create build directory
Write-Host ""
Write-Host "Preparing build directory..." -ForegroundColor Blue
if (Test-Path $BUILD_DIR) {
    Remove-Item $BUILD_DIR -Recurse -Force
}
New-Item -ItemType Directory -Path $BUILD_DIR -Force | Out-Null
Write-Host "   Created: $BUILD_DIR" -ForegroundColor Green

# Create temporary directory for build files
$TEMP_DIR = Join-Path $BUILD_DIR "temp-msi"
New-Item -ItemType Directory -Path $TEMP_DIR -Force | Out-Null
Write-Host "   Created temp directory: $TEMP_DIR" -ForegroundColor Green

# Copy Windows build files from scripts/windows/ to temp directory
Write-Host ""
Write-Host "Copying Windows build files to temp directory..." -ForegroundColor Blue
$windowsFiles = @(
    "scanx.wxs",
    "scanx-manager.bat",
    "scanx-task.xml",
    "license.rtf"
)

foreach ($file in $windowsFiles) {
    $source = Join-Path $WINDOWS_SCRIPTS_DIR $file
    $dest = Join-Path $TEMP_DIR $file
    if (Test-Path $source) {
        Copy-Item $source $dest -Force
        Write-Host "   Copied: $file" -ForegroundColor Green
    } else {
        Write-Host "   MISSING: $file" -ForegroundColor Red
        exit 1
    }
}

# Copy binary and osquery to temp directory
Write-Host "Copying binaries to temp directory..." -ForegroundColor Blue
Copy-Item $binaryPath (Join-Path $TEMP_DIR $BINARY_NAME) -Force
Write-Host "   Copied: $BINARY_NAME" -ForegroundColor Green

# Copy osquery as osqueryi.exe
Copy-Item $osqueryPath (Join-Path $TEMP_DIR "osqueryi.exe") -Force
Write-Host "   Copied: osqueryi.exe" -ForegroundColor Green

# Copy agent.conf to temp directory
Copy-Item $configPath (Join-Path $TEMP_DIR "agent.conf") -Force
Write-Host "   Copied: agent.conf" -ForegroundColor Green

# Update scanx.wxs to use the correct binary name
Write-Host "Updating scanx.wxs for architecture..." -ForegroundColor Blue
$wxsPath = Join-Path $TEMP_DIR "scanx.wxs"
$wxsContent = Get-Content $wxsPath -Raw

# Replace the binary name in the wxs file
$wxsContent = $wxsContent -replace 'scanx-windows-amd64\.exe', $BINARY_NAME
$wxsContent = $wxsContent -replace 'scanx-windows-arm64\.exe', $BINARY_NAME

Set-Content -Path $wxsPath -Value $wxsContent -NoNewline
Write-Host "   Updated: scanx.wxs" -ForegroundColor Green

# Build MSI with version
$msiName = "scanx-v$VERSION-windows-$osqueryArch.msi"

# Change to temp directory for building
Push-Location $TEMP_DIR

try {
    # Build MSI
    Write-Host ""
    Write-Host "Building MSI..." -ForegroundColor Blue

    # Compile WiX sources
    Write-Host "   Compiling WiX sources..." -ForegroundColor Yellow
    & $candlePath scanx.wxs
    if ($LASTEXITCODE -ne 0) {
        Write-Host "WiX compilation failed" -ForegroundColor Red
        exit 1
    }

    # Link MSI
    Write-Host "   Linking MSI: $msiName..." -ForegroundColor Yellow
    & $lightPath -ext WixUIExtension -ext WixUtilExtension -sice:ICE03 scanx.wixobj -o $msiName
    if ($LASTEXITCODE -ne 0) {
        Write-Host "WiX linking failed" -ForegroundColor Red
        exit 1
    }

    # Move MSI to build directory
    Write-Host "   Moving MSI to build directory..." -ForegroundColor Yellow
    $msiSource = Join-Path $TEMP_DIR $msiName
    $msiDest = Join-Path $BUILD_DIR $msiName
    Move-Item $msiSource $msiDest -Force
    Write-Host "   MSI moved successfully" -ForegroundColor Green

    Write-Host ""
    Write-Host "MSI created successfully!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Installation Instructions:" -ForegroundColor Cyan
    Write-Host "   1. Right-click $msiName" -ForegroundColor White
    Write-Host "   2. Select 'Install'" -ForegroundColor White
    Write-Host "   3. Follow the installation wizard" -ForegroundColor White
    Write-Host "   4. After installation, run the Desktop Shortcut(as administrator) to start the ScanX Agent" -ForegroundColor White
    Write-Host "   5. Check the task Manager to see if the ScanX Agent is running" -ForegroundColor White
    Write-Host ""
    $msiFullPath = Resolve-Path $msiDest
    Write-Host "MSI Location: $msiFullPath" -ForegroundColor Cyan
    $fileSize = [math]::Round((Get-Item $msiDest).Length / 1MB, 2)
    Write-Host "File Size: $fileSize MB" -ForegroundColor Cyan
} finally {
    Pop-Location
    
    # Clean up temp directory and all intermediate files
    Write-Host ""
    Write-Host "Cleaning up temporary files..." -ForegroundColor Yellow
    if (Test-Path $TEMP_DIR) {
        Remove-Item $TEMP_DIR -Recurse -Force
        Write-Host "   Removed temp directory" -ForegroundColor Green
    }
    
    # Also clean up any stray files in build directory (shouldn't be any, but just in case)
    Get-ChildItem -Path $BUILD_DIR -File | Where-Object { 
        $_.Extension -in @('.wixobj', '.wixpdb') -or 
        ($_.Name -like 'scanx-v*.msi' -and $_.Name -ne $msiName)
    } | Remove-Item -Force -ErrorAction SilentlyContinue
    
    Write-Host "   Cleanup complete" -ForegroundColor Green
}

