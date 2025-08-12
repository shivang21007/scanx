# 🔧 MDM Agent - Daemon Deployment Guide

## 📋 Overview

The MDM Agent is a cross-platform system monitoring and device management daemon that operates as a persistent background service. It automatically collects system information using OSQuery and transmits data to a central management server at configurable intervals.

## 🎯 Architecture

### Core Components
- **Agent Binary**: Cross-platform Go application (`mdm-agent`)
- **OSQuery Integration**: System information collection engine
- **Service Layer**: Platform-specific daemon management
- **Configuration**: JSON/YAML-based settings management
- **Backend Communication**: HTTP-based data transmission

### Service Management
- **macOS**: `launchd` with `.plist` configuration
- **Linux**: `systemd` service with auto-restart
- **Windows**: Windows Service with recovery options

## 🚀 Quick Deployment

### Prerequisites
1. **OSQuery Installation**: Required on all target systems
2. **Network Access**: Connectivity to backend server (`http://172.0.10.183:3000`)
3. **Administrative Privileges**: Required for service installation

### Deployment Steps

#### 1. Build Agent
```bash
# Build for all platforms
./scripts/build.sh

# Optional: Create native installers
./scripts/create-macos-pkg.sh      # macOS .pkg
./scripts/create-linux-packages.sh # Linux .deb/.rpm
./scripts/create-windows-msi.sh    # Windows .msi
```

#### 2. Deploy to Target Systems
```bash
# Extract distribution package
tar -xzf mdm-agent-<platform>-<arch>-v1.0.0.tar.gz
cd mdm-agent-<platform>-<arch>-v1.0.0

# Install with interactive configuration
sudo ./install/install-<platform>.sh
```

#### 3. Verify Installation
```bash
# Check service status
# macOS
sudo launchctl list | grep mdm-agent

# Linux
sudo systemctl status mdm-agent

# Windows
sc query MDMAgent
```

## 🔧 Service Configuration

### Default Settings
- **Collection Interval**: 2 hours
- **Log Level**: info
- **Auto-restart**: Enabled
- **Boot Start**: Enabled
- **User**: root (required for OSQuery access)

### Customization
Edit `/etc/mdmagent/config/agent.conf`:
```json
{
    "user_email": "admin@company.com",
    "version": "1.0.0",
    "interval": "1h",
    "log_level": "debug"
}
```

## 📊 Data Collection

### System Information Collected
- **Hardware Details**: CPU, memory, disk usage
- **Operating System**: Version, patches, security settings
- **Network Configuration**: Interfaces, routing, DNS
- **Installed Software**: Applications, versions, installation dates
- **Security Status**: Encryption, antivirus, firewall settings

### Collection Schedule
- **Default**: Every 2 hours
- **Configurable**: 5m, 10m, 1h, 2h, 6h, 12h, 24h
- **Backend Sync**: Real-time data transmission after collection

## 🛡️ Security Considerations

### File Permissions
```bash
# Binary permissions
chmod 755 /usr/local/bin/mdm-agent

# Configuration permissions
chmod 644 /etc/mdmagent/config/*
chown root:root /etc/mdmagent/config/*

# Log permissions
chmod 644 /var/log/mdmagent/*
chown root:root /var/log/mdmagent/*
```

### Network Security
- **HTTPS Communication**: Encrypted data transmission
- **Authentication**: User email-based device identification
- **Firewall**: Outbound HTTPS (port 443) required

### Service Security
- **Privilege Isolation**: Minimal required permissions
- **Resource Limits**: Memory and CPU constraints
- **Sandboxing**: Platform-specific security measures

## 📈 Monitoring & Maintenance

### Health Checks
```bash
# Service status
sudo systemctl status mdm-agent

# Process monitoring
ps aux | grep mdm-agent

# Log analysis
sudo journalctl -u mdm-agent --since "1 hour ago"

# Data transmission
tail -f /var/log/mdmagent/mdm-agent-std.log
```

### Performance Metrics
- **Memory Usage**: Typically 5-10MB
- **CPU Usage**: <1% during idle, spikes during collection
- **Network**: ~1KB per transmission (every 2 hours)
- **Disk**: <1MB for logs and data

### Troubleshooting
See [BUILD_&_USAGES.md](./BUILD_&_USAGES.md#troubleshooting) for detailed troubleshooting guide.

## 🔄 Update Process

### Agent Updates
1. **Build New Version**: `./scripts/build.sh`
2. **Deploy Packages**: Distribute new tar.gz/installer packages
3. **Service Restart**: Automatic restart with new binary
4. **Configuration Migration**: Preserve existing settings

### OSQuery Updates
- **Automatic**: Package manager updates
- **Manual**: Follow OSQuery documentation
- **Compatibility**: Test with agent before deployment

## 📋 Deployment Checklist

### Pre-Deployment
- [ ] OSQuery installed and functional
- [ ] Network connectivity verified
- [ ] Administrative access confirmed
- [ ] Backend server accessible

### Installation
- [ ] Binary deployed to `/usr/local/bin/`
- [ ] Configuration files in `/etc/mdmagent/config/`
- [ ] Service file installed and enabled
- [ ] Log directories created with proper permissions

### Post-Installation
- [ ] Service starts successfully
- [ ] Data collection working
- [ ] Backend communication established
- [ ] Logs show no errors
- [ ] Auto-restart functionality verified

### Monitoring
- [ ] Service status monitoring configured
- [ ] Log rotation implemented
- [ ] Performance metrics tracked
- [ ] Alert system configured for failures

## 🏢 Enterprise Deployment

### Mass Deployment
- **Configuration Management**: Ansible, Puppet, Chef
- **Package Distribution**: Internal repositories, MDM systems
- **Monitoring**: Centralized logging and alerting
- **Compliance**: Audit trails and reporting

### Security Policies
- **Code Signing**: Developer ID certificates for macOS
- **Package Signing**: GPG signatures for Linux packages
- **Network Policies**: Firewall rules and proxy configuration
- **Access Control**: Role-based permissions and audit logs

### Compliance
- **Data Retention**: Configurable log retention policies
- **Privacy**: GDPR-compliant data handling
- **Audit**: Comprehensive logging for compliance reporting
- **Encryption**: Data encryption in transit and at rest

## 📚 Additional Resources

- **[BUILD_&_USAGES.md](./BUILD_&_USAGES.md)**: Complete build and usage documentation
- **[OSQuery Documentation](https://osquery.io/docs/)**: System information collection
- **[Systemd Documentation](https://www.freedesktop.org/software/systemd/man/)**: Linux service management
- **[macOS Launchd](https://developer.apple.com/library/archive/documentation/MacOSX/Conceptual/BPSystemStartup/)**: macOS service management

## 🤝 Support & Maintenance

### Regular Maintenance
- **Log Rotation**: Weekly log cleanup
- **Performance Review**: Monthly resource usage analysis
- **Security Updates**: Quarterly security assessments
- **Version Updates**: Semi-annual agent updates

### Support Channels
- **Documentation**: [BUILD_&_USAGES.md](./BUILD_&_USAGES.md)
- **Troubleshooting**: Service logs and error messages
- **Community**: OSQuery community forums
- **Enterprise**: Professional support contracts

---

**Version**: 1.0.0  
**Last Updated**: August 2024  
**Compatibility**: macOS 10.15+, Ubuntu 18.04+, CentOS 7+, Windows 10+  
**License**: Proprietary