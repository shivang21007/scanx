# 🪟 Windows Installation Guide for ScanX

## 📋 Prerequisites

1. **Windows 10/11** (64-bit)
2. **Administrator privileges**
3. **OSQuery installed** (see installation below)
4. **PowerShell execution policy** configured

## 🔧 Step 1: Install OSQuery

### Option A: Download from Official Site
1. Visit: https://osquery.io/downloads/
2. Download the Windows installer
3. Run the installer as Administrator
4. Verify installation: `C:\Program Files\osquery\osqueryi.exe --version`

### Option B: Install via Chocolatey
```powershell
# Install Chocolatey first (if not installed)
Set-ExecutionPolicy Bypass -Scope Process -Force; [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072; iex ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))

# Install osquery
choco install osquery
```

## 🔧 Step 2: Configure PowerShell Execution Policy

### Method 1: Set Execution Policy (Recommended)
1. Right-click **PowerShell** → **Run as Administrator**
2. Run this command:
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```
3. Type `Y` when prompted

### Method 2: Bypass for One-Time Use
If you don't want to change the execution policy permanently, you can bypass it for this installation:
```powershell
powershell -ExecutionPolicy Bypass -File install-windows.ps1
```

## 🚀 Step 3: Install ScanX

### Method 1: Interactive Installation
1. Extract the `scanx-windows-amd64-v1.0.0.zip` package
2. Right-click **PowerShell** → **Run as Administrator**
3. Navigate to the extracted directory:
```powershell
cd "C:\Users\YourUsername\Downloads\scanx-windows-amd64-v1.0.0"
```
4. Run the installation script:
```powershell
.\install\install-windows.ps1
```
5. Follow the prompts to enter your email and collection interval

### Method 2: Silent Installation
```powershell
.\install\install-windows.ps1 -Email "your.email@company.com" -Interval "10m"
```

### Method 3: Bypass Execution Policy
```powershell
powershell -ExecutionPolicy Bypass -File install\install-windows.ps1
```

## ✅ Step 4: Verify Installation

### Check Service Status
```powershell
sc query scanx
```

### Check Service Logs
```powershell
Get-Content "C:\Program Files\scanx\logs\scanx.log" -Tail 50 -Wait
```

### Test Manual Execution
```powershell
"C:\Program Files\scanx\scanx.exe" -test
```

## 🛠️ Service Management

### Start Service
```powershell
sc start scanx
```

### Stop Service
```powershell
sc stop scanx
```

### Restart Service
```powershell
sc stop scanx
sc start scanx
```

### Check Service Status
```powershell
sc query scanx
```

### View Real-time Logs
```powershell
Get-Content "C:\Program Files\scanx\logs\scanx.log" -Tail 50 -Wait
```

## 🗑️ Uninstallation

### Method 1: Use Uninstall Script
```powershell
# Run as Administrator
& "C:\Program Files\scanx\uninstall.ps1"
```

### Method 2: Manual Uninstallation
```powershell
# Stop and remove service
Stop-Service -Name "scanx" -Force
sc.exe delete "scanx"

# Remove files
Remove-Item "C:\Program Files\scanx" -Recurse -Force
```

## 🔍 Troubleshooting

### Issue: "Execution policy is restricted"
**Solution:**
```powershell
# Run as Administrator
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

### Issue: "Access denied" or "Permission denied"
**Solution:**
- Make sure you're running PowerShell as Administrator
- Right-click PowerShell → Run as Administrator

### Issue: "OSQuery not found"
**Solution:**
1. Install OSQuery from https://osquery.io/downloads/
2. Verify installation: `C:\Program Files\osquery\osqueryi.exe --version`
3. Run the installation script again

### Issue: Service won't start
**Solution:**
1. Check logs: `Get-Content "C:\Program Files\scanx\logs\scanx.log"`
2. Verify configuration: `Get-Content "C:\Program Files\scanx\config\config\agent.conf"`
3. Test manual execution: `"C:\Program Files\scanx\scanx.exe" -test`

### Issue: Network connectivity problems
**Solution:**
1. Check firewall settings
2. Verify proxy configuration if using corporate network
3. Test connectivity to backend server

## 📁 File Locations

| Component | Path |
|-----------|------|
| **Binary** | `C:\Program Files\scanx\scanx.exe` |
| **Configuration** | `C:\Program Files\scanx\config\config\` |
| **Logs** | `C:\Program Files\scanx\logs\` |
| **Service** | Windows Service: `scanx` |

## 📞 Support

If you encounter issues:
1. Check the troubleshooting section above
2. Review the service logs
3. Test manual execution
4. Verify OSQuery installation and functionality

---

**Version**: 1.0.0  
**Compatibility**: Windows 10/11 (64-bit)  
**Last Updated**: August 2024
