#!/bin/bash

# Linux Installation Script for scanx
# Interactive: sudo ./install-linux.sh
# Silent:      sudo ./install-linux.sh --email "user@company.com" --interval "10m"

set -e

# Parse command line arguments
SILENT_EMAIL=""
SILENT_INTERVAL=""

while [[ $# -gt 0 ]]; do
    case $1 in
        --email)
            SILENT_EMAIL="$2"
            shift 2
            ;;
        --interval)
            SILENT_INTERVAL="$2"
            shift 2
            ;;
        -h|--help)
            echo "Usage: $0 [--email EMAIL] [--interval INTERVAL]"
            echo "  --email EMAIL      Employee email (required)"
            echo "  --interval INTERVAL Data collection interval (default: 10m)"
            echo "  -h, --help         Show this help message"
            exit 0
            ;;
        *)
            echo "Unknown option $1"
            exit 1
            ;;
    esac
done

AGENT_NAME="scanx"
INSTALL_DIR="/usr/local/bin"
CONFIG_DIR="/etc/scanx"
DATA_DIR="/var/lib/scanx"
LOG_DIR="/var/log/scanx"
SERVICE_FILE="/etc/systemd/system/scanx.service"

echo "🐧 Installing scanx on Linux..."

# Check if running as root
if [[ $EUID -ne 0 ]]; then
   echo "❌ This script must be run as root (use sudo)"
   exit 1
fi

# Detect Linux distribution
detect_distro() {
    if [ -f /etc/os-release ]; then
        . /etc/os-release
        echo $ID
    elif [ -f /etc/redhat-release ]; then
        echo "rhel"
    elif [ -f /etc/debian_version ]; then
        echo "debian"
    else
        echo "unknown"
    fi
}

DISTRO=$(detect_distro)
echo "📍 Detected distribution: $DISTRO"

# Install osquery if not present
install_osquery() {
    if ! command -v osqueryi &> /dev/null; then
        echo "⚠️  OSQuery not found. Please install osquery manually:"
        echo "exiting script..."
        exit 1
    fi
}

install_osquery
echo "✅ OSQuery found: $(which osqueryi)"

# Stop existing service if running
if systemctl is-active --quiet scanx 2>/dev/null; then
    echo "🔄 Stopping existing scanx service..."
    systemctl stop scanx
fi

if systemctl is-enabled --quiet scanx 2>/dev/null; then
    systemctl disable scanx
fi

# Create directories with standardized paths
echo "📁 Creating directories..."
mkdir -p "$CONFIG_DIR"
mkdir -p "$DATA_DIR"
mkdir -p "$LOG_DIR"

# Copy binary
echo "📦 Installing binary..."
cp "./$AGENT_NAME" "$INSTALL_DIR/$AGENT_NAME"
chmod +x "$INSTALL_DIR/$AGENT_NAME"

# Collect user input (interactive mode if not provided via CLI)
if [[ -n "$SILENT_EMAIL" ]]; then
    # Silent mode
    user_email="$SILENT_EMAIL"
    user_interval="${SILENT_INTERVAL:-10m}"
    echo "📋 Using provided configuration:"
    echo "   📧 Email: $user_email"
    echo "   ⏱️  Interval: $user_interval"
else
    # Interactive mode
    echo ""
    echo "📋 Configuration Setup"
    echo "====================="

    # Get email (required)
    while true; do
        read -p "📧 Enter employee email (required): " user_email
        if [[ -n "$user_email" && "$user_email" == *"@"* ]]; then
            break
        else
            echo "❌ Please enter a valid email address"
        fi
    done

    # Get interval (optional)
    echo ""
    echo "⏱️  Data collection interval examples:"
    echo "   - 5m   (5 minutes)"
    echo "   - 10m  (10 minutes)"
    echo "   - 1h   (1 hour)"
    echo "   - 2h   (2 hours - default)"
    read -p "⏱️  Enter collection interval [2h]: " user_interval
    if [[ -z "$user_interval" ]]; then
        user_interval="2h"
    fi
fi

# Copy configuration files
echo ""
echo "⚙️  Installing configuration..."
cp -r ./config/* "$CONFIG_DIR/"

# Update agent.conf with user input
echo "📝 Updating configuration with your settings..."
sed -i "s/\"user_email\": \"[^\"]*\"/\"user_email\": \"$user_email\"/" "$CONFIG_DIR/agent.conf"
sed -i "s/\"interval\": \"[^\"]*\"/\"interval\": \"$user_interval\"/" "$CONFIG_DIR/agent.conf"

chmod 644 "$CONFIG_DIR/"*

echo "✅ Configuration updated:"
echo "   📧 Email: $user_email"
echo "   ⏱️  Interval: $user_interval"

# Install systemd service
echo "🔧 Installing service configuration..."
cp "./services/scanx.service" "$SERVICE_FILE"
chmod 644 "$SERVICE_FILE"

# Create log file and set proper permissions
touch "$LOG_DIR/scanx-std.log"
chmod 644 "$LOG_DIR/scanx-std.log"

# Set proper permissions
chown -R root:root "$CONFIG_DIR"
chown -R root:root "$DATA_DIR"
chown -R root:root "$LOG_DIR"
chown root:root "$INSTALL_DIR/$AGENT_NAME"
chown root:root "$SERVICE_FILE"

# Reload systemd and enable service
echo "🔄 Reloading systemd..."
systemctl daemon-reload

echo "🚀 Enabling and starting scanx service..."
systemctl enable scanx
systemctl start scanx

# Wait a moment and check status
sleep 2
if systemctl is-active --quiet scanx; then
    echo "✅ scanx service started successfully!"
else
    echo "⚠️  Service may not have started. Check status:"
    echo "   sudo systemctl status scanx"
fi

echo ""
echo "🎉 Installation completed!"
echo ""
echo "📋 Service Management Commands:"
echo "   Start:   sudo systemctl start scanx"
echo "   Stop:    sudo systemctl stop scanx"
echo "   Status:  sudo systemctl status scanx"
echo "   Logs:    sudo journalctl -u scanx -f"
echo "   Enable:  sudo systemctl enable scanx"
echo "   Disable: sudo systemctl disable scanx"
echo ""
echo "📁 File locations:"
echo "   Binary:  $INSTALL_DIR/$AGENT_NAME"
echo "   Config:  $CONFIG_DIR/"
echo "   Logs:    $LOG_DIR/scanx-std.log"
echo "   Data:    $DATA_DIR/"
echo ""
echo "ℹ️  The agent will now run automatically on system startup"