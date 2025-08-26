# Windows MSI Build Instructions

This directory contains the files needed to build a Windows MSI installer for the scanx agent.

## Prerequisites

1. **WiX Toolset** - Required for building MSI files
   - Download from: https://wixtoolset.org/releases/
   - Or install via Chocolatey: `choco install wixtoolset`

2. **PowerShell** - For running the build script
   - Windows 10/11 comes with PowerShell by default

## Build Methods

### Method 1: PowerShell Script (Recommended)

```powershell
# Navigate to this directory
cd agent/dist/msi-build

# Run the build script
.\build-msi.ps1
```

If you get execution policy errors:
```powershell
# Option A: Set execution policy (requires admin)
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser

# Option B: Bypass execution policy for this script
.\build-msi.ps1 -BypassExecutionPolicy
```

### Method 2: Batch File

```cmd
# Navigate to this directory
cd agent/dist/msi-build

# Run the batch file
build-msi.bat
```

### Method 3: Manual WiX Commands

```cmd
# Compile WiX sources
candle scanx.wxs

# Link to create MSI
light -ext WixUIExtension scanx.wixobj -o scanx.msi
```

## Troubleshooting

### Execution Policy Error
```
File cannot be loaded because running scripts is disabled on this system
```
**Solution**: Run PowerShell as Administrator and execute:
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

### WiX Toolset Not Found
```
ERROR: WiX Toolset not found
```
**Solution**: Install WiX Toolset from https://wixtoolset.org/releases/

### Missing Files Error
```
❌ Required files missing
```
**Solution**: Make sure you're running from the correct directory and all source files exist.

## Files Generated

- `scanx.msi` - The Windows installer package
- `scanx.wixobj` - Intermediate WiX object file (automatically cleaned up)

## Installation

After building the MSI:

1. **Install OSQuery** (required dependency):
   ```cmd
   choco install osquery
   ```
   Or download from: https://osquery.io/downloads/

2. **Install ScanX**:
   - Right-click `scanx.msi`
   - Select "Install"
   - Follow the installation wizard
   - Accept the license agreement
   - **Files will be installed to `C:\Program Files\scanx\`**

3. **Configure ScanX** (after installation):
   ```powershell
   # Run as Administrator
   cd "C:\Program Files\scanx"
   .\configure-scanx-v1.ps1
   ```
   
   This will prompt for:
   - Employee email address
   - Data collection interval (5m, 10m, 15m, 30m, 1h, 2h, 6h, 12h, 24h)
   - Updates `C:\Program Files\scanx\config\agent.conf`
   - Starts the ScanX service

4. **Verify Installation**:
   ```cmd
   sc query scanx
   ```

## Installation Flow

1. **MSI Installation**: Installs files to `C:\Program Files\scanx\`
2. **Configuration**: Run `configure-scanx-v1.ps1` to set email and interval
3. **Service Start**: Service starts automatically after configuration
4. **Verification**: Check service status with `sc query scanx`

## Files Included in MSI

- `scanx.exe` - Main agent executable
- `agent.conf` - Configuration file
- `queries.yml` - OSQuery queries
- `configure-scanx-v1.ps1` - Post-installation configuration script
- Windows service registration

## Service Management

After installation, the scanx service can be managed with:

```cmd
# Start service
sc start scanx

# Stop service  
sc stop scanx

# Check status
sc query scanx

# Uninstall service
sc delete scanx
```

## Troubleshooting Service Issues

### Service Fails to Start
If the service fails to start during installation:

1. **Check OSQuery Installation**:
   ```cmd
   "C:\Program Files\osquery\osqueryi.exe" --version
   ```

2. **Install OSQuery if missing**:
   ```cmd
   choco install osquery
   ```

3. **Run Configuration Script**:
   ```powershell
   cd "C:\Program Files\scanx"
   .\configure-scanx-v1.ps1
   ```

4. **Check Service Logs**:
   ```cmd
   Get-EventLog -LogName Application -Source scanx
   ```

### Manual Service Start
If automatic start fails:
```cmd
sc start scanx
```

### Configuration Issues
If configuration script fails:
```powershell
# Check if files exist
Test-Path "C:\Program Files\scanx\config\agent.conf"
Test-Path "C:\Program Files\scanx\scanx.exe"
```
