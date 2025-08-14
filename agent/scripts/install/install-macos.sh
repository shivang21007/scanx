#!/bin/bash

# macOS Installation Script for scanx
# Interactive: sudo ./install-macos.sh
# Silent:      sudo ./install-macos.sh --email "user@company.com" --interval "10m"

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
PLIST_PATH="/Library/LaunchDaemons/com.company.scanx.plist"

echo "🍎 Installing scanx on macOS..."

# Check if running as root
if [[ $EUID -ne 0 ]]; then
   echo "❌ This script must be run as root (use sudo)"
   exit 1
fi

# Check if osquery is installed
if ! command -v osqueryi &> /dev/null; then
    echo "⚠️  OSQuery not found. Please install osquery manually:"
    echo "exiting script..."
    exit 1
fi

echo "✅ OSQuery found: $(which osqueryi)"

# Stop existing service if running
if launchctl list | grep -q "com.company.scanx"; then
    echo "🔄 Stopping existing scanx service..."
    launchctl unload "$PLIST_PATH" 2>/dev/null || true
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

# Remove quarantine attributes to bypass Gatekeeper
echo "🔓 Removing quarantine attributes..."
xattr -rd com.apple.quarantine "$INSTALL_DIR/$AGENT_NAME" 2>/dev/null || true
codesign --force --deep --sign - "$INSTALL_DIR/$AGENT_NAME" 2>/dev/null || echo "⚠️  Code signing failed (normal for unsigned binaries)"

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
sed -i '' "s/\"user_email\": \"[^\"]*\"/\"user_email\": \"$user_email\"/" "$CONFIG_DIR/agent.conf"
sed -i '' "s/\"interval\": \"[^\"]*\"/\"interval\": \"$user_interval\"/" "$CONFIG_DIR/agent.conf"

chmod 644 "$CONFIG_DIR/"*

echo "✅ Configuration updated:"
echo "   📧 Email: $user_email"
echo "   ⏱️  Interval: $user_interval"

# Install launchd plist
echo "🔧 Installing service configuration..."
cp "./services/com.company.scanx.plist" "$PLIST_PATH"
chmod 644 "$PLIST_PATH"
chown root:wheel "$PLIST_PATH"

# Create log file and set proper permissions
touch "$LOG_DIR/scanx-std.log"
chmod 644 "$LOG_DIR/scanx-std.log"

# Set proper permissions
chown -R root:wheel "$CONFIG_DIR"
chown -R root:wheel "$DATA_DIR"
chown -R root:wheel "$LOG_DIR"
chown root:wheel "$INSTALL_DIR/$AGENT_NAME"

# Load and start the service
echo "🚀 Starting scanx service..."
launchctl load "$PLIST_PATH"

# Wait a moment and check status
sleep 2
if launchctl list | grep -q "com.company.scanx"; then
    echo "✅ scanx service started successfully!"
else
    echo "⚠️  Service may not have started. Check logs:"
    echo "   tail -f /var/log/scanx.log"
fi

echo ""
echo "🎉 Installation completed!"
echo ""
echo "📋 Service Management Commands:"
echo "   Start:   sudo launchctl load $PLIST_PATH"
echo "   Stop:    sudo launchctl unload $PLIST_PATH"
echo "   Status:  sudo launchctl list | grep scanx"
echo "   Logs:    tail -f $LOG_DIR/scanx-std.log"
echo ""
echo "📁 File locations:"
echo "   Binary:  $INSTALL_DIR/$AGENT_NAME"
echo "   Config:  $CONFIG_DIR/"
echo "   Logs:    $LOG_DIR/scanx-std.log"
echo "   Data:    $DATA_DIR/"
echo ""
echo "ℹ️  The agent will now run automatically on system startup"