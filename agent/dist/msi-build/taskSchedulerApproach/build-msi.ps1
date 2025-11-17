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

# Method 2: Check common installation paths
if (-not $candlePath) {
    $commonPaths = @(
        "C:\Program Files (x86)\WiX Toolset v3.11\bin",
        "C:\Program Files (x86)\WiX Toolset v3.14\bin",
        "C:\Program Files\WiX Toolset v3.11\bin",
        "C:\Program Files\WiX Toolset v3.14\bin"
    )
    
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


# Check if required files exist
$requiredFiles = @(
    "scanx.wxs",
    "scanx-windows-amd64.exe",
    "osqueryi.exe",
    "agent.conf",
    "scanx-manager.bat",
    "scanx-task.xml"
)

# Copy required files from source locations
Write-Host "Preparing build files..." -ForegroundColor Blue

# # Detect system architecture for osquery
# $architecture = $env:PROCESSOR_ARCHITECTURE
# if ($architecture -eq "AMD64") {
#     $osqueryArch = "x86_64"
#     Write-Host "   Detected architecture: x86_64 (AMD64)" -ForegroundColor Cyan
# } elseif ($architecture -eq "ARM64") {
#     $osqueryArch = "arm64"
#     Write-Host "   Detected architecture: ARM64" -ForegroundColor Cyan
# } else {
#     Write-Host "   WARNING: Unknown architecture '$architecture', defaulting to x86_64" -ForegroundColor Yellow
#     $osqueryArch = "x86_64"
# }
# Define osquery source path (hardcoded to x86_64 for now)
$osquerySource = "C:\Users\Octro\Downloads\scanx\agent\dist\builds-osquery\osqueryi-5.20.0.windows_x86_64.exe"
Write-Host "   OSQuery source: $osquerySource" -ForegroundColor Cyan

$copyOperations = @{
    "C:\Users\Octro\Downloads\scanx\agent\dist\builds\scanx-windows-amd64.exe" = "scanx-windows-amd64.exe"
    "C:\Users\Octro\Downloads\scanx\agent\dist\builds-osquery\osqueryi-5.20.0.windows_x86_64.exe" = "osqueryi.exe"
    "C:\Users\Octro\Downloads\scanx\agent\config\agent.conf" = "agent.conf"
}

# Copy files from source locations (agent.conf will be copied from source with correct version)
Write-Host "   Copying required files..." -ForegroundColor Yellow
foreach ($source in $copyOperations.Keys) {
    $destination = $copyOperations[$source]
    if (Test-Path $source) {
        Copy-Item $source $destination -Force
        Write-Host "   Copied: $source -> $destination" -ForegroundColor Green
    } else {
        Write-Host "   MISSING SOURCE: $source" -ForegroundColor Red
        Write-Host ""
        Write-Host "Build cannot proceed. Missing source files." -ForegroundColor Red
        exit 1
    }
}

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

# Before New Build, remove the existing .msi, .wixobj, .wixpdb files
Write-Host "Removing existing .msi, .wixobj, .wixpdb files..." -ForegroundColor Yellow
Remove-Item "scanx-v*.msi" -ErrorAction SilentlyContinue
Remove-Item "*.wixobj" -ErrorAction SilentlyContinue
Remove-Item "*.wixpdb" -ErrorAction SilentlyContinue
Write-Host "   Cleanup complete" -ForegroundColor Green


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

# Extract version from agent.conf JSON file
try {
    $configJson = Get-Content "agent.conf" -Raw | ConvertFrom-Json
    $version = $configJson.version
    Write-Host "Building MSI for Version: $version" -ForegroundColor Green
} catch {
    # Ask user to input version
    Write-Host "Failed to read version from agent.conf" -ForegroundColor Yellow
    $version = Read-Host "Enter the version"
    if ( $null -eq $version -or $version -eq "" ) {
        Write-Host "Version is required" -ForegroundColor Red
        exit 1
    }
    Write-Host "Version set to: $version" -ForegroundColor Green
}
$msiName = "scanx-v$version-x86_64.msi"
Write-Host "   Linking MSI: $msiName..." -ForegroundColor Yellow
& $lightPath -ext WixUIExtension -ext WixUtilExtension -sice:ICE03 scanx.wixobj -o $msiName
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
Write-Host "   1. Right-click $msiName" -ForegroundColor White
Write-Host "   2. Select 'Install'" -ForegroundColor White
Write-Host "   3. Follow the installation wizard" -ForegroundColor White
Write-Host "   4. After installation, run the Desktop Shortcut(as administrator) to start the ScanX Agent" -ForegroundColor White
Write-Host "   5. Check the task Manager to see if the ScanX Agent is running" -ForegroundColor White
Write-Host ""
Write-Host "MSI Location: $(Resolve-Path $msiName)" -ForegroundColor Cyan
$fileSize = [math]::Round((Get-Item $msiName).Length / 1MB, 2)
Write-Host "File Size: $fileSize MB" -ForegroundColor Cyan
