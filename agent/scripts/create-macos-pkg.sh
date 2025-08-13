#!/bin/bash

# Create macOS Installer Package (.pkg) for MDM Agent
# This creates a signed installer package for seamless distribution

set -e

# Configuration
VERSION=$(cat config/agent.conf | grep -o '"version": "[^"]*"' | cut -d'"' -f4)
PKG_NAME="MDMAgent-${VERSION}"

BUILD_DIR="dist/macos-build"
SCRIPTS_DIR="$BUILD_DIR/scripts"
PAYLOAD_DIR="$BUILD_DIR/payload"

echo "📦 Creating macOS Installer Package"
echo "================================="

# Clean and create build directories
rm -rf "$BUILD_DIR"
mkdir -p "$SCRIPTS_DIR" "$PAYLOAD_DIR"

# Create payload structure
echo "📁 Creating payload structure..."
mkdir -p "$PAYLOAD_DIR/usr/local/bin"
mkdir -p "$PAYLOAD_DIR/etc/mdmagent"
mkdir -p "$PAYLOAD_DIR/var/log/mdmagent"
mkdir -p "$PAYLOAD_DIR/var/lib/mdmagent"
mkdir -p "$PAYLOAD_DIR/Library/LaunchDaemons"

# Copy files to payload (using standard paths)
cp "dist/builds/mdmagent-darwin-amd64" "$PAYLOAD_DIR/usr/local/bin/mdmagent"
mkdir -p "$PAYLOAD_DIR/etc/mdmagent/config"
cp config/* "$PAYLOAD_DIR/etc/mdmagent/config/"
cp "scripts/services/com.company.mdmagent.plist" "$PAYLOAD_DIR/Library/LaunchDaemons/"

# Set permissions
chmod +x "$PAYLOAD_DIR/usr/local/bin/mdmagent"
chmod 644 "$PAYLOAD_DIR/etc/mdmagent/config/"*
chmod 644 "$PAYLOAD_DIR/Library/LaunchDaemons/com.company.mdmagent.plist"
chmod 755 "$PAYLOAD_DIR/var/log/mdmagent"
chmod 755 "$PAYLOAD_DIR/var/lib/mdmagent"

# Create preinstall script
echo "📝 Creating installation scripts..."
cat > "$SCRIPTS_DIR/preinstall" << 'EOF'
#!/bin/bash

# Clean up existing MDM Agent installation
echo "🧹 Cleaning up existing MDM Agent installation..."

# Remove existing service process
launchctl remove com.company.mdmagent 2>/dev/null || true

# Stop existing service if running
launchctl unload /Library/LaunchDaemons/com.company.mdmagent.plist 2>/dev/null || true

# Remove old plist file
rm -f /Library/LaunchDaemons/com.company.mdmagent.plist 2>/dev/null || true

# Remove old binary
rm -f /usr/local/bin/mdmagent 2>/dev/null || true

# Remove old configuration and data directories
rm -rf /etc/mdmagent 2>/dev/null || true
rm -rf /var/log/mdmagent 2>/dev/null || true
rm -rf /var/lib/mdmagent 2>/dev/null || true

# Remove old log files
rm -f /var/log/mdmagent.log 2>/dev/null || true
rm -f /var/log/mdmagent.error.log 2>/dev/null || true

# Remove quarantine from any existing binary (if it exists)
if [ -f "/usr/local/bin/mdmagent" ]; then
    xattr -rd com.apple.quarantine /usr/local/bin/mdmagent 2>/dev/null || true
fi

echo "✅ Cleanup completed"

exit 0
EOF

# Create postinstall script
cat > "$SCRIPTS_DIR/postinstall" << 'EOF'
#!/bin/bash

# Remove quarantine attributes
xattr -rd com.apple.quarantine /usr/local/bin/mdmagent 2>/dev/null || true

# Ad-hoc sign the binary
codesign --force --deep --sign - /usr/local/bin/mdmagent 2>/dev/null || true

# Check if osquery is installed first (check multiple common locations)
osquery_found=false

# Check PATH
if command -v osqueryi &> /dev/null; then
    osquery_found=true
fi

# Check common installation locations
if [ -f "/usr/local/bin/osqueryi" ] || [ -f "/opt/osquery/bin/osqueryi" ] || [ -f "/usr/bin/osqueryi" ]; then
    osquery_found=true
fi

# Check Homebrew location
if [ -f "/opt/homebrew/bin/osqueryi" ]; then
    osquery_found=true
fi

if [ "$osquery_found" = false ]; then
    osascript -e 'display dialog "❌ OSQuery not found!\n\nPlease install osquery first:\n  brew install osquery\n\nThen run this installer again." with title "MDM Agent Setup Error" with icon stop buttons {"OK"} default button "OK"'
    exit 1
fi

# Configuration setup with GUI dialogs
# Note: If user cancels any dialog, installation will fail and require re-running
config_file="/etc/mdmagent/config/agent.conf"

# Get email from user
while true; do
    email=$(osascript -e 'text returned of (display dialog "📧 Enter employee email (required):" default answer "" with title "MDM Agent Setup" with icon note)')
    
    # Check if user cancelled the dialog
    if [[ "$email" == "false" ]] || [[ -z "$email" ]]; then
        osascript -e 'display dialog "❌ Email is required for MDM Agent setup.\n\nInstallation cancelled. Please run the installer again and provide a valid email address." with title "MDM Agent Setup Cancelled" with icon stop buttons {"OK"} default button "OK"'
        exit 1
    fi
    
    # Validate email format
    if [[ "$email" == *"@"* ]]; then
        break
    else
        osascript -e 'display dialog "❌ Please enter a valid email address containing @ symbol" with title "MDM Agent Setup" with icon stop buttons {"OK"} default button "OK"'
    fi
done

# Get interval from user (with default to 2 hours)
interval_choice=$(osascript -e 'choose from list {"5m (5 minutes)", "10m (10 minutes)", "15m (15 minutes)", "30m (30 minutes)", "1h (1 hour)", "2h (2 hours)", "4h (4 hours)", "6h (6 hours)", "8h (8 hours)", "12h (12 hours)", "24h (24 hours)"} with title "MDM Agent Setup" with prompt "⏱️ Select data collection interval:" default items {"2h (2 hours)"}')

# Check if user cancelled the interval selection
if [[ "$interval_choice" == "false" ]] || [[ -z "$interval_choice" ]]; then
    osascript -e 'display dialog "❌ Interval selection is required for MDM Agent setup.\n\nInstallation cancelled. Please run the installer again and select a collection interval." with title "MDM Agent Setup Cancelled" with icon stop buttons {"OK"} default button "OK"'
    exit 1
else
    interval=$(echo "$interval_choice" | cut -d' ' -f1)
fi

# Update configuration file
sed -i '' "s/\"user_email\": \"[^\"]*\"/\"user_email\": \"$email\"/" "$config_file"
sed -i '' "s/\"interval\": \"[^\"]*\"/\"interval\": \"$interval\"/" "$config_file"

# Show configuration confirmation
osascript -e "display dialog \"✅ Configuration saved:\n\n📧 Email: $email\n⏱️ Interval: $interval\n\nThe MDM Agent will start automatically.\" with title \"MDM Agent Setup Complete\" with icon note buttons {\"OK\"} default button \"OK\""

# Create directory structure and set permissions
mkdir -p /var/log/mdmagent
mkdir -p /var/lib/mdmagent
touch /var/log/mdmagent/mdmagent-std.log
chmod 755 /var/log/mdmagent
chmod 755 /var/lib/mdmagent
chmod 644 /var/log/mdmagent/mdmagent-std.log

# Load and start the service
launchctl load /Library/LaunchDaemons/com.company.mdmagent.plist

echo "MDM Agent installed successfully with user configuration!"
echo "Email: $email"
echo "Interval: $interval"

exit 0
EOF

# Create preremove script  
cat > "$SCRIPTS_DIR/preremove" << 'EOF'
#!/bin/bash

# Stop and unload service
launchctl unload /Library/LaunchDaemons/com.company.mdmagent.plist 2>/dev/null || true
launchctl remove com.company.mdmagent 2>/dev/null || true

# Remove the configuration files
rm -rf /etc/mdmagent 2>/dev/null || true

# Remove the log files
rm -rf /var/log/mdmagent 2>/dev/null || true

# Remove the binary
rm -f /usr/local/bin/mdmagent 2>/dev/null || true


exit 0
EOF

# Make scripts executable
chmod +x "$SCRIPTS_DIR/"*

# Build the package
echo "🔨 Building package..."
pkgbuild --root "$PAYLOAD_DIR" \
         --scripts "$SCRIPTS_DIR" \
         --identifier "com.company.mdmagent" \
         --version "$VERSION" \
         --install-location "/" \
         "${PKG_NAME}-unsigned.pkg"

# Sign the package if installer identity provided
if [ -n "$INSTALLER_ID" ]; then
    echo "🔐 Signing package..."
    productsign --sign "$INSTALLER_ID" "${PKG_NAME}-unsigned.pkg" "${PKG_NAME}.pkg"
    mv "${PKG_NAME}.pkg" "$BUILD_DIR/"
    rm "${PKG_NAME}-unsigned.pkg"
    echo "✅ Signed package created: ${PKG_NAME}.pkg using ${INSTALLER_ID}"
else
    mv "${PKG_NAME}-unsigned.pkg" "$BUILD_DIR/${PKG_NAME}.pkg"
    echo "✅ Unsigned (internal use only) package created: $BUILD_DIR/${PKG_NAME}.pkg"
    echo ""
    echo "💡 To sign the package for distribution:"
    echo "   productsign --sign \"Developer ID Installer: Your Name (TEAMID)\" $BUILD_DIR/${PKG_NAME}.pkg $BUILD_DIR/${PKG_NAME}-signed.pkg"
fi

#clean up
# rm -rf "$BUILD_DIR/payload"
# rm -rf "$BUILD_DIR/scripts"


echo ""
echo "🎉 macOS Installer Package created!"
echo "📁 Package: $BUILD_DIR/${PKG_NAME}.pkg"
echo ""
echo "📋 Installation:"
echo "   sudo installer -pkg $BUILD_DIR/${PKG_NAME}.pkg -target /"
echo ""

if [ -n "$INSTALLER_ID" ]; then
    echo "📋 For distribution, consider notarizing:"
    echo "   xcrun notarytool submit $BUILD_DIR/${PKG_NAME}.pkg --keychain-profile \"AC_PASSWORD\" --wait"
    echo "   xcrun stapler staple $BUILD_DIR/${PKG_NAME}.pkg"
fi