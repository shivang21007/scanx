# MDM Agent - Cross-Platform Daemon Installation Guide

This guide explains how to build and deploy the MDM Agent as a system daemon/service that automatically starts on boot and runs continuously in the background.

## 🚀 Quick Start

### 1. Build for All Platforms
```bash
cd agent
./scripts/build.sh
```

This creates distribution packages in the `dist/` folder for:
- **macOS**: Intel (amd64) and Apple Silicon (arm64)
- **Linux**: x64, x86, and ARM64
- **Windows**: x64 and x86

### 2. Install on Target Systems

#### macOS Installation
```bash
# Extract the package
tar -xzf mdm-agent-darwin-amd64-v1.0.0.tar.gz
cd mdm-agent-darwin-amd64-v1.0.0

# Install as system service (requires sudo)
sudo ./install/install-macos.sh
```

#### Linux Installation
```bash
# Extract the package
tar -xzf mdm-agent-linux-amd64-v1.0.0.tar.gz
cd mdm-agent-linux-amd64-v1.0.0

# Install as systemd service (requires sudo)
sudo ./install/install-linux.sh
```

#### Windows Installation
```powershell
# Extract the package
Expand-Archive mdm-agent-windows-amd64-v1.0.0.zip
cd mdm-agent-windows-amd64-v1.0.0

# Install as Windows Service (Run as Administrator)
powershell -ExecutionPolicy Bypass -File install\install-windows.ps1
```

## 🛠️ Manual Installation

If you prefer manual installation or need custom configuration:

### Build Single Platform
```bash
# For current platform
go build -o mdm-agent ./cmd/agent

# For specific platform
GOOS=linux GOARCH=amd64 go build -o mdm-agent-linux ./cmd/agent
GOOS=windows GOARCH=amd64 go build -o mdm-agent.exe ./cmd/agent
GOOS=darwin GOARCH=arm64 go build -o mdm-agent-mac ./cmd/agent
```

### Configure and Install Service
```bash
# Copy binary to system location
sudo cp mdm-agent /usr/local/bin/

# Copy configuration
sudo mkdir -p /etc/mdm-agent
sudo cp config/* /etc/mdm-agent/

# Install as service using built-in service management
sudo ./mdm-agent -service install

# Or use platform-specific commands:
# macOS: sudo launchctl load /Library/LaunchDaemons/com.company.mdm-agent.plist
# Linux: sudo systemctl enable mdm-agent && sudo systemctl start mdm-agent
# Windows: sc create MDMAgent binPath="C:\Path\To\mdm-agent.exe -daemon"
```

## 📋 Service Management

After installation, use these commands to manage the service:

### Built-in Service Commands
```bash
# Start service
sudo mdm-agent -service start

# Stop service
sudo mdm-agent -service stop

# Check status
sudo mdm-agent -service status

# Uninstall service
sudo mdm-agent -service uninstall
```

### Platform-Specific Commands

#### macOS (launchd)
```bash
# Start
sudo launchctl load /Library/LaunchDaemons/com.company.mdm-agent.plist

# Stop
sudo launchctl unload /Library/LaunchDaemons/com.company.mdm-agent.plist

# Status
sudo launchctl list | grep mdm-agent

# Logs
tail -f /var/log/mdm-agent.log
```

#### Linux (systemd)
```bash
# Start
sudo systemctl start mdm-agent

# Stop
sudo systemctl stop mdm-agent

# Status
sudo systemctl status mdm-agent

# Enable auto-start
sudo systemctl enable mdm-agent

# Logs
sudo journalctl -u mdm-agent -f
```

#### Windows (Service)
```powershell
# Start
sc start MDMAgent

# Stop
sc stop MDMAgent

# Status
sc query MDMAgent

# Logs
Get-Content "C:\Program Files\MDMAgent\logs\mdm-agent.log" -Tail 50 -Wait
```

## ⚙️ Configuration

### Agent Configuration (`agent.conf`)
```json
{
    "user_email": "employee@company.com",
    "version": "1.0.0",
    "interval": "10m",
    "log_level": "info"
}
```

### Query Configuration (`queries.yml`)
The agent automatically detects the platform and runs appropriate queries defined in `queries.yml`.

### Custom Configuration Location
```bash
# Use custom config directory
mdm-agent -daemon -config /custom/path/to/config
```

## 🔄 Auto-Restart and Monitoring

The daemon is configured to automatically:

1. **Start on system boot**
2. **Restart on crash** (with 10-second delay)
3. **Restart on failure** (up to 3 times with increasing delays)
4. **Log all activities** to system logs

### Restart Policies

- **macOS**: Managed by launchd with `KeepAlive` and `RunAtLoad`
- **Linux**: Systemd with `Restart=always` and `RestartSec=10`
- **Windows**: Service recovery actions configured for automatic restart

## 📊 Monitoring and Logs

### Log Locations
- **macOS**: `/var/log/mdm-agent.log`
- **Linux**: `journalctl -u mdm-agent` or `/var/log/syslog`
- **Windows**: `C:\Program Files\MDMAgent\logs\mdm-agent.log`

### Monitoring Status
```bash
# Test single run
mdm-agent -test

# Check if daemon is running
ps aux | grep mdm-agent        # macOS/Linux
tasklist | findstr mdm-agent   # Windows
```

## 🛡️ Security and Permissions

The agent requires root/administrator privileges to:
- Access system information via osquery
- Read hardware details
- Monitor security settings
- Write to system log directories

### Required Dependencies
- **osquery**: Must be installed before running the agent
  - macOS: `brew install osquery`
  - Linux: Follow [osquery Linux installation](https://osquery.io/downloads/linux)
  - Windows: Download from [osquery Windows](https://osquery.io/downloads/windows)

## 🔧 Troubleshooting

### Common Issues

1. **OSQuery not found**
   ```bash
   # Install osquery first
   brew install osquery  # macOS
   # Or follow platform-specific installation
   ```

2. **Permission denied**
   ```bash
   # Ensure running with sudo/administrator privileges
   sudo mdm-agent -daemon
   ```

3. **Service won't start**
   ```bash
   # Check logs for detailed error messages
   # macOS
   tail -f /var/log/mdm-agent.error.log
   
   # Linux
   sudo journalctl -u mdm-agent -f
   
   # Windows
   eventvwr.msc  # Check Windows Event Logs
   ```

4. **Configuration not found**
   ```bash
   # Ensure config files exist
   ls -la config/
   # Should contain: agent.conf, queries.yml
   ```

### Debug Mode
```bash
# Run with debug logging
mdm-agent -daemon  # Check logs for detailed information
```

## 🚀 Advanced Usage

### Custom Backend URL
Update the sender configuration in your code or environment variables to point to your backend server.

### Custom Queries
Modify `queries.yml` to add platform-specific queries:

```yaml
platform:
  darwin:
    custom_query:
      query: "SELECT * FROM your_custom_table;"
      description: "Your custom query description"
```

### Integration with CI/CD
```bash
# Automate builds
./scripts/build.sh

# Deploy to multiple servers
for server in server1 server2 server3; do
    scp dist/mdm-agent-linux-amd64-v1.0.0.tar.gz $server:/tmp/
    ssh $server "cd /tmp && tar -xzf mdm-agent-linux-amd64-v1.0.0.tar.gz && sudo ./mdm-agent-linux-amd64-v1.0.0/install/install-linux.sh"
done
```

## 📋 Summary

With this setup, your MDM agent will:

✅ **Run automatically on system startup**  
✅ **Restart automatically on crashes**  
✅ **Collect data at configured intervals**  
✅ **Send data to your backend server**  
✅ **Log all activities for monitoring**  
✅ **Work across macOS, Linux, and Windows**  
✅ **Require minimal maintenance**  

The agent operates completely in the background without interfering with other programs, making it perfect for enterprise device management and monitoring.