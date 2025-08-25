# scanx v1.0.0

## Installation

Run the appropriate installation script for your platform:

### macOS:
```bash
sudo ./install/install-macos.sh
```

### Linux:
```bash
sudo ./install/install-linux.sh
```

### Windows (Run as Administrator):
```powershell
.\install\install-windows.ps1
```

## Configuration

Edit `config/agent.conf` to set your email and preferences.

## Service Management

### Start the service:
- macOS: `sudo launchctl load /Library/LaunchDaemons/com.company.scanx.plist`
- Linux: `sudo systemctl start scanx`
- Windows: `sc start scanx`

### Check status:
- macOS: `sudo launchctl list | grep scanx`
- Linux: `sudo systemctl status scanx`
- Windows: `sc query scanx`
