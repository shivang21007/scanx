# ScanX Agent - Windows Installer

## Version 1.6.3 - Final Release

---

## 🎯 What's Included

- **scanx-v1.6.3.msi** - Windows installer package
- **scanx-manager.bat** - Configuration and management tool
- Automatic desktop shortcut creation
- Email and interval configuration during setup

---

## 📋 Prerequisites

1. **OSQuery** must be installed
   - Download from: https://osquery.io/downloads/
   - Or install via Chocolatey: `choco install osquery`

2. **Administrator privileges** required for configuration

---

## 🚀 Installation Steps

### Step 1: Clean Install (if upgrading)

```powershell
# Run in PowerShell as Administrator
$app = Get-WmiObject -Class Win32_Product | Where-Object { $_.Name -like "*ScanX*" }
if ($app) { $app.Uninstall() }
Stop-Process -Name scanx -Force -ErrorAction SilentlyContinue
Remove-Item "C:\Program Files (x86)\scanx" -Recurse -Force -ErrorAction SilentlyContinue
Remove-ItemProperty "HKCU:\Software\Microsoft\Windows\CurrentVersion\Run" -Name "ScanX" -ErrorAction SilentlyContinue
```

### Step 2: Install MSI

1. Right-click `scanx-v1.6.3.msi`
2. Select **"Install"**
3. Accept license agreement
4. Click **Install**
5. Click **Finish**

**Installation Location:** `C:\Program Files (x86)\scanx\`

### Step 3: Configure (IMPORTANT!)

1. Find **"ScanX Manager (Run as Admin)"** on your desktop
2. **Right-click** the shortcut
3. Select **"Run as administrator"**
4. Choose **[1] Configure and install as Windows startup application**
5. Enter your employee email (e.g., `atul.sharma@octrotalk.com`)
6. Enter collection interval (e.g., `5m`, `10m`, `1h`, `2h`)
7. Script will:
   - Update configuration file
   - Show updated settings
   - Add to Windows startup
   - Ask if you want to start now

---

## ⚠️ IMPORTANT: Administrator Privileges

The ScanX Manager **MUST** be run as Administrator to:
- Modify configuration files in `Program Files (x86)`
- Add/remove Windows startup entries
- Start/stop the daemon service

**Always right-click → "Run as administrator"**

---

## 📋 Manager Menu Options

```
[1] Configure and install as Windows startup  ← Use this first!
[2] Start ScanX daemon now
[3] Stop ScanX daemon
[4] Check status
[5] Uninstall from startup
[6] Exit
```

---

## ✅ Verification

After configuration, verify the installation:

```powershell
# Check configuration
Get-Content "C:\Program Files (x86)\scanx\config\agent.conf" | ConvertFrom-Json | Format-List

# Check if daemon is running
Get-Process scanx -ErrorAction SilentlyContinue

# Check startup entry
Get-ItemProperty "HKCU:\Software\Microsoft\Windows\CurrentVersion\Run" -Name "ScanX"

# View logs
Get-Content "C:\Program Files (x86)\scanx\logs\scanx.log" -Tail 20
```

**Expected Configuration:**
```json
{
    "user_email": "YOUR-EMAIL@octrotalk.com",  ← Your email
    "version": "1.0.0",
    "interval": "5m",                           ← Your interval
    "log_level": "info",
    "backend_url": "http://192.168.22.22:5173"
}
```

---

## 🔧 Troubleshooting

### Issue: "Access Denied" when updating configuration

**Cause:** Not running as Administrator

**Solution:**
1. Right-click "ScanX Manager (Run as Admin)"
2. Select "Run as administrator"
3. Try configuration again

### Issue: Daemon won't start

**Check:**
1. Is OSQuery installed?
   ```powershell
   Test-Path "C:\Program Files\osquery\osqueryi.exe"
   ```
2. Check logs:
   ```powershell
   Get-Content "C:\Program Files (x86)\scanx\logs\scanx.log" -Tail 50
   ```

### Issue: Configuration not updating

**Verify:**
1. Running as Administrator
2. Config file exists:
   ```powershell
   Test-Path "C:\Program Files (x86)\scanx\config\agent.conf"
   ```
3. Check file permissions

---

## 📁 File Structure

```
C:\Program Files (x86)\scanx\
├── scanx.exe                 ← Main executable
├── scanx-manager.bat         ← Management script
├── config\
│   ├── agent.conf           ← Configuration (email, interval)
│   └── queries.yml          ← Query definitions
└── logs\
    └── scanx.log            ← Application logs
```

---

## 🔄 Updating Configuration

To change email or interval after installation:

1. Right-click "ScanX Manager (Run as Admin)" → Run as administrator
2. Choose **[5] Uninstall from startup** (stops daemon)
3. Choose **[1] Configure and install...** (enter new values)
4. New configuration will be applied

---

## 🗑️ Uninstallation

### Option 1: Windows Settings
1. Settings → Apps → ScanX Agent → Uninstall

### Option 2: PowerShell
```powershell
$app = Get-WmiObject -Class Win32_Product | Where-Object { $_.Name -like "*ScanX*" }
if ($app) { $app.Uninstall() }
```

### Option 3: MSI Command
```powershell
msiexec /x scanx-v1.6.3.msi
```

---

## 📊 Data Collection

- **What:** System information via OSQuery
- **When:** Every [interval] (e.g., 5m, 10m, 1h)
- **Where:** Sent to backend at `http://192.168.22.22:5173`
- **Who:** Identified by employee email

---

## 🆘 Support

If you encounter issues:

1. Check logs: `C:\Program Files (x86)\scanx\logs\scanx.log`
2. Verify OSQuery is installed
3. Ensure running as Administrator
4. Check network connectivity to backend

---

## 📝 Version History

### v1.6.3 (Current)
- ✅ Fixed administrator privilege check
- ✅ Improved error handling
- ✅ Cleaned up build directory
- ✅ Simplified configuration process
- ✅ Added clear admin requirement messaging

### v1.6.2
- Fixed batch file crash with intervals
- Simplified PowerShell command

### v1.6.1
- Added custom configuration dialog (deprecated)

### v1.6.0
- Initial MSI release

---

## 🎉 Quick Start Summary

1. **Install** `scanx-v1.6.3.msi`
2. **Right-click** desktop shortcut → Run as administrator
3. **Choose [1]** to configure
4. **Enter email** and **interval**
5. **Done!** Daemon starts automatically

---

**Remember:** Always run ScanX Manager as Administrator!

