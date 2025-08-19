# 🚀 ScanX - Build & Usage Guide

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

The **ScanX** is a sophisticated cross-platform system monitoring and device management agent that provides comprehensive endpoint visibility and security compliance monitoring. It operates as a persistent daemon/service that automatically collects detailed system information using OSQuery and transmits this data to a central management server at configurable intervals.

### 🌟 Key Features
- **Cross-platform Support**: macOS, Windows, Linux (x86_64, ARM64)
- **Intelligent Query Execution**: 
  - System queries run as root for full system access
  - User-specific queries (like screen lock preferences) execute in user context
  - Automatic user detection and context switching
- **Persistent Operation**: Auto-starts with system boot and self-healing
- **Comprehensive Data Collection**:
  - System hardware and OS information
  - Security status (disk encryption, antivirus, firewall)
  - Installed applications and software inventory
  - User-specific security settings (screen lock, password policies)
  - Network configuration and connectivity
- **Configurable**: Customizable collection intervals and user identification
- **Secure**: Code-signed binaries and secure service configurations
- **Flexible Deployment**: Multiple installation methods (packages, installers, manual)

### 🔍 What ScanX Monitors

#### System Information
- **Hardware Details**: CPU, memory, disk usage, serial numbers
- **Operating System**: Version, patches, security settings, kernel info
- **Network Configuration**: Interfaces, routing, DNS, connectivity

#### Security Compliance
- **Disk Encryption**: FileVault (macOS), BitLocker (Windows), LUKS (Linux)
- **Antivirus Status**: Real-time protection, definitions, scan history
- **Firewall Configuration**: Rules, policies, active connections
- **Screen Lock Settings**: User-specific lock preferences and grace periods
- **Password Policies**: Complexity requirements, expiration settings

#### Software Inventory
- **Installed Applications**: Name, version, installation date, publisher
- **System Services**: Running services, startup items, daemons
- **Browser Extensions**: Security extensions, privacy tools
- **Development Tools**: IDEs, compilers, package managers

#### User Context Data
- **User Preferences**: Security settings, privacy configurations
- **Login Sessions**: Active users, session information
- **Application Usage**: Recently used applications, file access patterns

### 🏗️ Architecture

#### Service Layer
- **macOS**: `launchd` with `.plist` configuration (runs as root)
- **Linux**: `systemd` service with auto-restart capabilities
- **Windows**: Windows Service with recovery options

#### Query Execution Engine
- **OSQuery Integration**: Leverages OSQuery for system information collection
- **Context-Aware Execution**: 
  - System-level queries execute as root
  - User-specific queries execute in user context using `sudo -u username`
- **Temporary File Management**: Uses `/var/lib/scanx/query.sql` for query execution
- **Error Handling**: Comprehensive error capture and logging

#### Data Transmission
- **HTTP/HTTPS Communication**: Secure data transmission to backend
- **JSON Format**: Structured data format for easy processing
- **Retry Logic**: Automatic retry on network failures
- **Compression**: Efficient data transmission with compression

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
tar -xzf dist/packages/scanx-<platform>-<arch>-v1.0.0.tar.gz
cd scanx-<platform>-<arch>-v1.0.0
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

# Install with custom email and interval
SCANX_EMAIL="user@company.com" SCANX_INTERVAL="1h" sudo -E rpm -i scanx-1.0.0-1.el9.x86_64.rpm
```

**Building RPM on CentOS9:**
```bash
# Required directory structure on CentOS9:
/tmp/
├── dist/
│   ├── builds/
│   │   └── scanx-linux-amd64          # Linux binary
│   └── linux-packages/
│       ├── deb/
│       └── rpm/
├── config/
│   ├── agent.conf                          # Agent configuration
│   └── queries.yml                         # OSQuery queries
├── scripts/
│   └── services/
│       └── scanx.service               # Systemd service file
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
tar -xzf scanx-<platform>-<arch>-v1.0.0.tar.gz
cd scanx-<platform>-<arch>-v1.0.0

# Install
sudo ./install/install-<platform>.sh
```

### Method 2: Native Packages
```bash
# macOS
sudo installer -pkg scanx-1.0.0.pkg -target /

# Ubuntu/Debian
sudo dpkg -i scanx_1.0.0_amd64.deb

# CentOS/RHEL
sudo rpm -i scanx-1.0.0-1.el9.x86_64.rpm
```

### Method 3: Manual Installation
```bash
# Copy files
sudo cp scanx /usr/local/bin/
sudo mkdir -p /etc/scanx/config
sudo cp config/* /etc/scanx/config/

# Install service
sudo cp services/scanx.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable scanx
sudo systemctl start scanx
```

## 🛠️ Service Management

### macOS (launchd)
```bash
# Start service
sudo launchctl load /Library/LaunchDaemons/com.company.scanx.plist

# Stop service
sudo launchctl unload /Library/LaunchDaemons/com.company.scanx.plist

# Check status
sudo launchctl list | grep scanx

# View logs
tail -f /var/log/scanx.log
```

### Linux (systemd)
```bash
# Start service
sudo systemctl start scanx

# Stop service
sudo systemctl stop scanx

# Check status
sudo systemctl status scanx

# View logs
sudo journalctl -u scanx -f

# Enable auto-start
sudo systemctl enable scanx
```

### Windows (Windows Service)
```powershell
# Start service
sc start scanx

# Stop service
sc stop scanx

# Check status
sc query scanx

# View logs
Get-EventLog -LogName Application -Source scanx
```

## ⚙️ Configuration

### Agent Configuration (`/etc/scanx/config/agent.conf`)
```json
{
    "user_email": "user@company.com",
    "version": "1.0.0",
    "interval": "2h",
    "log_level": "info"
}
```

### Queries Configuration (`/etc/scanx/config/queries.yml`)
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
│   │   └── scanx-linux-amd64          # Linux binary (required)
│   └── linux-packages/
│       ├── deb/                           # Created during build
│       └── rpm/                           # Created during build
├── config/
│   ├── agent.conf                          # Agent configuration (required)
│   └── queries.yml                         # OSQuery queries (required)
├── scripts/
│   └── services/
│       └── scanx.service               # Systemd service file (required)
└── create-linux-packages.sh                # Build script (required)
```

**Required Files for RPM Build:**
- `dist/builds/scanx-linux-amd64` - Linux binary
- `config/agent.conf` - Agent configuration
- `config/queries.yml` - OSQuery queries
- `scripts/services/scanx.service` - Systemd service
- `create-linux-packages.sh` - Build script

### File Locations
| Component | macOS | Linux | Windows |
|-----------|-------|-------|---------|
| **Binary** | `/usr/local/bin/scanx` | `/usr/local/bin/scanx` | `C:\Program Files\scanx\scanx.exe` |
| **Config** | `/etc/scanx/config/` | `/etc/scanx/config/` | `C:\Program Files\scanx\config\` |
| **Logs** | `/var/log/scanx.log` | `/var/log/scanx/scanx-std.log` | `C:\Program Files\scanx\logs\` |
| **Data** | `/var/lib/scanx/` | `/var/lib/scanx/` | `C:\Program Files\scanx\data\` |
| **Service** | `/Library/LaunchDaemons/com.company.scanx.plist` | `/etc/systemd/system/scanx.service` | Windows Service |

## 🔍 Troubleshooting

### Common Issues

#### 1. macOS "killed" Error
**Problem**: Binary is killed by Gatekeeper
**Solution**: 
```bash
# Option 1: Use signed binary
./scripts/macos-sign.sh

# Option 2: Remove quarantine and sign
xattr -rd com.apple.quarantine scanx
codesign --force --deep --sign - scanx
```

#### 2. Service Won't Start
**Problem**: Service fails to start
**Solution**:
```bash
# Check logs
sudo journalctl -u scanx --no-pager -n 20

# Verify config
sudo cat /etc/scanx/config/agent.conf

# Check permissions
ls -la /usr/local/bin/scanx
ls -la /etc/scanx/config/
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
# │   │   └── scanx-linux-amd64
# │   └── linux-packages/
# ├── config/
# │   ├── agent.conf
# │   └── queries.yml
# ├── scripts/
# │   └── services/
# │       └── scanx.service
# └── create-linux-packages.sh

# Build RPM:
cd /tmp && ./create-linux-packages.sh 2
```

#### 5. Configuration Issues
**Problem**: Agent can't find config files
**Solution**:
```bash
# Verify config directory structure
ls -la /etc/scanx/config/

# Should contain:
# - agent.conf
# - queries.yml

# Check working directory in service file
cat /etc/systemd/system/scanx.service | grep WorkingDirectory
```

#### 6. User Context Query Issues
**Problem**: User-specific queries fail with permission errors
**Solution**:
```bash
# Check /var/lib/scanx permissions
ls -la /var/lib/scanx/

# Should be 777 (rwxrwxrwx) for universal access
# Fix permissions if needed:
sudo chmod 777 /var/lib/scanx

# Verify sudo access for current user
sudo -u $(whoami) whoami

# Test user context query manually
echo "SELECT 1;" > /var/lib/scanx/test.sql
sudo -u $(whoami) osqueryi --json < /var/lib/scanx/test.sql
```

### Debug Mode
Run agent in debug mode for troubleshooting:
```bash
# Stop service first
sudo systemctl stop scanx

# Run manually with debug
sudo /usr/local/bin/scanx -daemon -debug
```

### Log Locations
- **macOS**: `/var/log/scanx.log`
- **Linux**: `/var/log/scanx/scanx-std.log` + `journalctl -u scanx`
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