# 🚀 MDM Agent - Build & Usage Guide

## 📋 Table of Contents
- [Overview](#overview)
- [Quick Start](#quick-start)
- [Build Process](#build-process)
- [Package Types](#package-types)
- [Installation Methods](#installation-methods)
- [Service Management](#service-management)
- [Configuration](#configuration)
- [Troubleshooting](#troubleshooting)

## 🎯 Overview

The MDM Agent is a cross-platform system monitoring and device management agent that collects system information and sends it to a central management server. It runs as a persistent daemon/service and automatically restarts with the system.

### 🌟 Key Features
- **Cross-platform**: macOS, Windows, Linux (x86_64, ARM64)
- **Persistent**: Auto-starts with system boot
- **Configurable**: Customizable collection intervals and user identification
- **Secure**: Code-signed binaries and secure service configurations
- **Flexible**: Multiple installation methods (packages, installers, manual)

## 🚀 Quick Start

### Prerequisites
- **Go 1.21+** for building from source
- **OSQuery** installed on target systems
- **Network access** to backend server (default: `http://172.0.10.183:3000`)

### Build All Platforms
```bash
# Clone and build
git clone <repository>
cd agent
./scripts/build.sh
```

### Install on Target System
```bash
# Extract and install
tar -xzf dist/packages/mdm-agent-<platform>-<arch>-v1.0.0.tar.gz
cd mdm-agent-<platform>-<arch>-v1.0.0
sudo ./install/install-<platform>.sh
```

## 🔨 Build Process

### 1. Basic Build (`build.sh`)
The main build script creates binaries and distribution packages:

```bash
./scripts/build.sh
```

**What it does:**
- ✅ Builds binaries for all platforms (macOS, Windows, Linux)
- ✅ Signs macOS binaries (optional, prevents Gatekeeper issues)
- ✅ Creates tar.gz/zip distribution packages
- ✅ Preserves existing native packages in `dist/`

**Output:**
```
dist/
├── builds/                    # Raw binaries (signed for macOS)
├── packages/                  # Platform-specific tar.gz/zip packages
└── tmp/                       # Temporary build files
```

### 2. Native Installers (Optional)

**Note**: Native installers require platform-specific tools and environments.

#### macOS Package (.pkg)
```bash
./scripts/create-macos-pkg.sh
```
- Creates native macOS installer with GUI prompts
- Handles Gatekeeper bypass automatically
- Installs to standard FHS locations

#### Linux Packages (.deb/.rpm)
```bash
./scripts/create-linux-packages.sh
```
- Creates .deb packages for Ubuntu/Debian
- Creates .rpm packages for CentOS/RHEL
- Includes OSQuery dependency checks

**RPM Building Requirements:**
- **Platform**: Must be built on CentOS9/RHEL9 system
- **Tools**: Requires `rpmbuild` (included in CentOS9)
- **Directory Structure**: Specific layout required on CentOS9

**RPM Installation Options:**
```bash
# Install with default values
sudo rpm -i mdm-agent-1.0.0-1.el9.x86_64.rpm

# Install with custom email and interval
MDM_EMAIL="user@company.com" MDM_INTERVAL="1h" sudo -E rpm -i mdm-agent-1.0.0-1.el9.x86_64.rpm
```

**Building RPM on CentOS9:**
```bash
# Required directory structure on CentOS9:
/tmp/
├── dist/
│   ├── builds/
│   │   └── mdm-agent-linux-amd64          # Linux binary
│   └── linux-packages/
│       ├── deb/
│       └── rpm/
├── config/
│   ├── agent.conf                          # Agent configuration
│   └── queries.yml                         # OSQuery queries
├── scripts/
│   └── services/
│       └── mdm-agent.service               # Systemd service file
└── create-linux-packages.sh                # Build script

# Transfer files to CentOS9:
scp -r dist/ user@centos9-server:/tmp/
scp -r config/ user@centos9-server:/tmp/
scp -r scripts/ user@centos9-server:/tmp/
scp create-linux-packages.sh user@centos9-server:/tmp/

# Build RPM on CentOS9:
cd /tmp && chmod +x create-linux-packages.sh
./create-linux-packages.sh 2  # Option 2 for RPM only
```

#### Windows MSI
```bash
./scripts/create-windows-msi.sh
```
- Generates WiX Toolset source files
- Creates MSI installer for Windows
- Supports silent installation

### 3. Code Signing (macOS)
```bash
./scripts/macos-sign.sh
```
- Ad-hoc signing for internal testing
- Developer ID signing for distribution
- Prevents "killed" errors from Gatekeeper

## 📦 Package Types

### Distribution Packages (tar.gz/zip)
- **Purpose**: Manual installation and testing
- **Contents**: Binary, config files, installation scripts
- **Location**: `dist/packages/`
- **Usage**: Extract and run installation script

### Native Installers
- **macOS .pkg**: Native installer with GUI
- **Linux .deb/.rpm**: Package manager integration
- **Windows .msi**: Windows installer with silent support

## 🔧 Installation Methods

### Method 1: Distribution Packages
```bash
# Extract package
tar -xzf mdm-agent-<platform>-<arch>-v1.0.0.tar.gz
cd mdm-agent-<platform>-<arch>-v1.0.0

# Install
sudo ./install/install-<platform>.sh
```

### Method 2: Native Packages
```bash
# macOS
sudo installer -pkg MDMAgent-1.0.0.pkg -target /

# Ubuntu/Debian
sudo dpkg -i mdm-agent_1.0.0_amd64.deb

# CentOS/RHEL
sudo rpm -i mdm-agent-1.0.0-1.el9.x86_64.rpm
```

### Method 3: Manual Installation
```bash
# Copy files
sudo cp mdm-agent /usr/local/bin/
sudo mkdir -p /etc/mdmagent/config
sudo cp config/* /etc/mdmagent/config/

# Install service
sudo cp services/mdm-agent.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable mdm-agent
sudo systemctl start mdm-agent
```

## 🛠️ Service Management

### macOS (launchd)
```bash
# Start service
sudo launchctl load /Library/LaunchDaemons/com.company.mdm-agent.plist

# Stop service
sudo launchctl unload /Library/LaunchDaemons/com.company.mdm-agent.plist

# Check status
sudo launchctl list | grep mdm-agent

# View logs
tail -f /var/log/mdm-agent.log
```

### Linux (systemd)
```bash
# Start service
sudo systemctl start mdm-agent

# Stop service
sudo systemctl stop mdm-agent

# Check status
sudo systemctl status mdm-agent

# View logs
sudo journalctl -u mdm-agent -f

# Enable auto-start
sudo systemctl enable mdm-agent
```

### Windows (Windows Service)
```powershell
# Start service
sc start MDMAgent

# Stop service
sc stop MDMAgent

# Check status
sc query MDMAgent

# View logs
Get-EventLog -LogName Application -Source MDMAgent
```

## ⚙️ Configuration

### Agent Configuration (`/etc/mdmagent/config/agent.conf`)
```json
{
    "user_email": "user@company.com",
    "version": "1.0.0",
    "interval": "2h",
    "log_level": "info"
}
```

### Queries Configuration (`/etc/mdmagent/config/queries.yml`)
```yaml
platform:
  darwin:
    system_info:
      query: "SELECT s.*, o.version as os_version FROM system_info s, os_version o;"
      description: "System information with OS version"
  linux:
    system_info:
      query: "SELECT s.*, o.version as os_version FROM system_info s, os_version o;"
      description: "System information with OS version"
  windows:
    system_info:
      query: "SELECT s.*, o.version as os_version FROM system_info s, os_version o;"
      description: "System information with OS version"
```

### Build Directory Structure

**For RPM Building on CentOS9:**
```
/tmp/
├── dist/
│   ├── builds/
│   │   └── mdm-agent-linux-amd64          # Linux binary (required)
│   └── linux-packages/
│       ├── deb/                           # Created during build
│       └── rpm/                           # Created during build
├── config/
│   ├── agent.conf                          # Agent configuration (required)
│   └── queries.yml                         # OSQuery queries (required)
├── scripts/
│   └── services/
│       └── mdm-agent.service               # Systemd service file (required)
└── create-linux-packages.sh                # Build script (required)
```

**Required Files for RPM Build:**
- `dist/builds/mdm-agent-linux-amd64` - Linux binary
- `config/agent.conf` - Agent configuration
- `config/queries.yml` - OSQuery queries
- `scripts/services/mdm-agent.service` - Systemd service
- `create-linux-packages.sh` - Build script

### File Locations
| Component | macOS | Linux | Windows |
|-----------|-------|-------|---------|
| **Binary** | `/usr/local/bin/mdm-agent` | `/usr/local/bin/mdm-agent` | `C:\Program Files\MDMAgent\mdm-agent.exe` |
| **Config** | `/etc/mdmagent/config/` | `/etc/mdmagent/config/` | `C:\Program Files\MDMAgent\config\` |
| **Logs** | `/var/log/mdm-agent.log` | `/var/log/mdmagent/mdm-agent-std.log` | `C:\Program Files\MDMAgent\logs\` |
| **Data** | `/var/lib/mdmagent/` | `/var/lib/mdmagent/` | `C:\Program Files\MDMAgent\data\` |
| **Service** | `/Library/LaunchDaemons/com.company.mdm-agent.plist` | `/etc/systemd/system/mdm-agent.service` | Windows Service |

## 🔍 Troubleshooting

### Common Issues

#### 1. macOS "killed" Error
**Problem**: Binary is killed by Gatekeeper
**Solution**: 
```bash
# Option 1: Use signed binary
./scripts/macos-sign.sh

# Option 2: Remove quarantine and sign
xattr -rd com.apple.quarantine mdm-agent
codesign --force --deep --sign - mdm-agent
```

#### 2. Service Won't Start
**Problem**: Service fails to start
**Solution**:
```bash
# Check logs
sudo journalctl -u mdm-agent --no-pager -n 20

# Verify config
sudo cat /etc/mdmagent/config/agent.conf

# Check permissions
ls -la /usr/local/bin/mdm-agent
ls -la /etc/mdmagent/config/
```

#### 3. OSQuery Not Found
**Problem**: Installation fails due to missing OSQuery
**Solution**:
```bash
# macOS
brew install osquery

# Ubuntu/Debian
curl -L https://pkg.osquery.io/deb/GPG | sudo apt-key add -
echo 'deb [arch=amd64] https://pkg.osquery.io/deb deb main' | sudo tee /etc/apt/sources.list.d/osquery.list
sudo apt update && sudo apt install osquery

# CentOS/RHEL
curl -L https://pkg.osquery.io/rpm/GPG | sudo rpm --import -
sudo yum-config-manager --add-repo https://pkg.osquery.io/rpm/osquery-s3-rpm.repo
sudo yum install osquery
```

#### 4. RPM Building Issues
**Problem**: RPM build fails on macOS or wrong platform
**Solution**:
```bash
# RPM must be built on CentOS9/RHEL9
# Transfer required files to CentOS9:
scp -r dist/ user@centos9-server:/tmp/
scp -r config/ user@centos9-server:/tmp/
scp -r scripts/ user@centos9-server:/tmp/
scp create-linux-packages.sh user@centos9-server:/tmp/

# Verify directory structure on CentOS9:
tree /tmp/
# Should show:
# /tmp/
# ├── dist/
# │   ├── builds/
# │   │   └── mdm-agent-linux-amd64
# │   └── linux-packages/
# ├── config/
# │   ├── agent.conf
# │   └── queries.yml
# ├── scripts/
# │   └── services/
# │       └── mdm-agent.service
# └── create-linux-packages.sh

# Build RPM:
cd /tmp && ./create-linux-packages.sh 2
```

#### 5. Configuration Issues
**Problem**: Agent can't find config files
**Solution**:
```bash
# Verify config directory structure
ls -la /etc/mdmagent/config/

# Should contain:
# - agent.conf
# - queries.yml

# Check working directory in service file
cat /etc/systemd/system/mdm-agent.service | grep WorkingDirectory
```

### Debug Mode
Run agent in debug mode for troubleshooting:
```bash
# Stop service first
sudo systemctl stop mdm-agent

# Run manually with debug
sudo /usr/local/bin/mdm-agent -daemon -debug
```

### Log Locations
- **macOS**: `/var/log/mdm-agent.log`
- **Linux**: `/var/log/mdmagent/mdm-agent-std.log` + `journalctl -u mdm-agent`
- **Windows**: Event Viewer → Windows Logs → Application

## 📚 Additional Resources

- **OSQuery Documentation**: https://osquery.io/docs/
- **Systemd Service Configuration**: https://www.freedesktop.org/software/systemd/man/systemd.service.html
- **macOS Launchd**: https://developer.apple.com/library/archive/documentation/MacOSX/Conceptual/BPSystemStartup/Chapters/CreatingLaunchdJobs.html
- **Windows Services**: https://docs.microsoft.com/en-us/windows/win32/services/services

## 🤝 Support

For issues and questions:
1. Check the troubleshooting section above
2. Review service logs for error messages
3. Verify OSQuery installation and functionality
4. Test network connectivity to backend server

---

**Version**: 1.0.0  
**Last Updated**: August 2024  
**Compatibility**: macOS 10.15+, Ubuntu 18.04+, CentOS 7+, Windows 10+