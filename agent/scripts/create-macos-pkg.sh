#!/bin/bash

# Create macOS Installer Package (.pkg) for scanx
# This creates a signed installer package for seamless distribution
# Supports both AMD64 and ARM64 architectures

set -e

# Configuration
VERSION=$(cat config/agent.conf | grep -o '"scanx_version": "[^"]*"' | cut -d'"' -f4)
DIST_DIR="dist/${VERSION}"
OSQUERY_BUILD_DIR="$DIST_DIR/builds-osqueryi"

# Create version-based directory structure
mkdir -p "$DIST_DIR"

# Detect architecture or use argument
if [[ -n "$1" ]]; then
    ARCH="$1"
else
    # Detect current system architecture
    ARCH=$(uname -m)
    if [[ "$ARCH" == "x86_64" ]]; then
        ARCH="amd64"
    elif [[ "$ARCH" == "arm64" ]]; then
        ARCH="arm64"
    else
        echo "❌ Unsupported architecture: $ARCH"
        exit 1
    fi
fi

PKG_NAME="scanx-${VERSION}-darwin-${ARCH}"
BINARY_NAME="scanx-darwin-${ARCH}"

BUILD_DIR="$DIST_DIR/macos-build-${ARCH}"
SCRIPTS_DIR="$BUILD_DIR/scripts"
PAYLOAD_DIR="$BUILD_DIR/payload"

echo "📦 Creating macOS Installer Package for ${ARCH}"
echo "================================================"
echo "Version: ${VERSION}"
echo "Architecture: ${ARCH}"
echo ""

# Check if binary exists
if [[ ! -f "$DIST_DIR/builds/${BINARY_NAME}" ]]; then
    echo "❌ Binary not found: $DIST_DIR/builds/${BINARY_NAME}"
    echo "Please run ./scripts/build.sh first to build the binaries."
    exit 1
fi

# Clean and create build directories
rm -rf "$BUILD_DIR"
mkdir -p "$SCRIPTS_DIR" "$PAYLOAD_DIR"

# Create payload structure
echo "📁 Creating payload structure..."
mkdir -p "$PAYLOAD_DIR/usr/local/bin"
mkdir -p "$PAYLOAD_DIR/usr/local/lib/scanx"
mkdir -p "$PAYLOAD_DIR/etc/scanx"
mkdir -p "$PAYLOAD_DIR/var/log/scanx"
mkdir -p "$PAYLOAD_DIR/var/lib/scanx"
mkdir -p "$PAYLOAD_DIR/Library/LaunchDaemons"

# Copy files to payload (using standard paths)
cp "$DIST_DIR/builds/${BINARY_NAME}" "$PAYLOAD_DIR/usr/local/bin/scanx"
mkdir -p "$PAYLOAD_DIR/etc/scanx/config"
cp "config/agent.conf" "$PAYLOAD_DIR/etc/scanx/config/"
cp "scripts/services/com.company.scanx.plist" "$PAYLOAD_DIR/Library/LaunchDaemons/"

# Copy bundled osqueryi binary based on architecture
OSQUERY_SOURCE=""
if [[ "$ARCH" == "amd64" ]]; then
    OSQUERY_SOURCE="$OSQUERY_BUILD_DIR/osqueryi-darwin-amd64"
elif [[ "$ARCH" == "arm64" ]]; then
    OSQUERY_SOURCE="$OSQUERY_BUILD_DIR/osqueryi-darwin-arm64"
fi

if [[ -f "$OSQUERY_SOURCE" ]]; then
    echo "📦 Including bundled osqueryi for ${ARCH}..."
    cp "$OSQUERY_SOURCE" "$PAYLOAD_DIR/usr/local/lib/scanx/osqueryi"
    chmod +x "$PAYLOAD_DIR/usr/local/lib/scanx/osqueryi"
    echo "✅ Bundled osqueryi included"
else
    echo "⚠️  Warning: Bundled osqueryi not found at $OSQUERY_SOURCE"
    echo "   Package will rely on system osquery installation"
fi

# Set permissions
chmod +x "$PAYLOAD_DIR/usr/local/bin/scanx"
chmod 755 "$PAYLOAD_DIR/usr/local/lib/scanx"
chmod 644 "$PAYLOAD_DIR/etc/scanx/config/"*
chmod 644 "$PAYLOAD_DIR/Library/LaunchDaemons/com.company.scanx.plist"
chmod 755 "$PAYLOAD_DIR/var/log/scanx"
chmod 755 "$PAYLOAD_DIR/var/lib/scanx"

# Create preinstall script
echo "📝 Creating installation scripts..."
cat > "$SCRIPTS_DIR/preinstall" << 'EOF'
#!/bin/bash

# Clean up existing scanx installation
echo "🧹 Cleaning up existing scanx installation..."

# Remove existing service process
launchctl remove com.company.scanx 2>/dev/null || true

# Stop existing service if running
launchctl unload /Library/LaunchDaemons/com.company.scanx.plist 2>/dev/null || true

# Remove old plist file
rm -f /Library/LaunchDaemons/com.company.scanx.plist 2>/dev/null || true

# Remove old binary and backup files
rm -f /usr/local/bin/scanx 2>/dev/null || true
rm -f /usr/local/bin/scanx.old 2>/dev/null || true
rm -f /usr/local/lib/scanx/osqueryi.old 2>/dev/null || true

# Remove old configuration and data directories
rm -rf /etc/scanx 2>/dev/null || true
rm -rf /var/log/scanx 2>/dev/null || true
rm -rf /var/lib/scanx 2>/dev/null || true

# Remove old log files
rm -f /var/log/scanx.log 2>/dev/null || true
rm -f /var/log/scanx-std.log 2>/dev/null || true
rm -f /var/log/scanx-error.log 2>/dev/null || true

# Remove quarantine from any existing binary (if it exists)
if [ -f "/usr/local/bin/scanx" ]; then
    xattr -rd com.apple.quarantine /usr/local/bin/scanx 2>/dev/null || true
fi

# Clean up any permission issues
chmod 755 /usr/local/bin/scanx 2>/dev/null || true
chmod 755 /etc/scanx 2>/dev/null || true
chmod 755 /etc/scanx/config 2>/dev/null || true
chmod 644 /etc/scanx/config/* 2>/dev/null || true
chmod 755 /var/log/scanx 2>/dev/null || true
chmod 755 /var/lib/scanx 2>/dev/null || true

echo "✅ Cleanup completed"

exit 0
EOF

# Create postinstall script
cat > "$SCRIPTS_DIR/postinstall" << 'EOF'
#!/bin/bash

# Remove quarantine attributes from binaries
xattr -rd com.apple.quarantine /usr/local/bin/scanx 2>/dev/null || true
xattr -rd com.apple.quarantine /usr/local/lib/scanx/osqueryi 2>/dev/null || true

# Ad-hoc sign the binaries
codesign --force --deep --sign - /usr/local/bin/scanx 2>/dev/null || true
if [ -f "/usr/local/lib/scanx/osqueryi" ]; then
    codesign --force --deep --sign - /usr/local/lib/scanx/osqueryi 2>/dev/null || true
fi

# Check if osquery is installed (check bundled first, then system)
osquery_found=false

# Priority 1: Check bundled osqueryi
if [ -f "/usr/local/lib/scanx/osqueryi" ] && [ -x "/usr/local/lib/scanx/osqueryi" ]; then
    osquery_found=true
    echo "✅ Using bundled osqueryi from /usr/local/lib/scanx/osqueryi"
fi

# Priority 2: Check PATH
if [ "$osquery_found" = false ] && command -v osqueryi &> /dev/null; then
    osquery_found=true
    echo "✅ Using system osqueryi from PATH"
fi

# Priority 3: Check common installation locations
if [ "$osquery_found" = false ]; then
    if [ -f "/usr/local/bin/osqueryi" ] || [ -f "/opt/osquery/bin/osqueryi" ] || [ -f "/usr/bin/osqueryi" ]; then
        osquery_found=true
        echo "✅ Using system osqueryi from standard location"
    fi
fi

# Priority 4: Check Homebrew location
if [ "$osquery_found" = false ] && [ -f "/opt/homebrew/bin/osqueryi" ]; then
    osquery_found=true
    echo "✅ Using osqueryi from Homebrew"
fi

if [ "$osquery_found" = false ]; then
    osascript -e 'display dialog "❌ OSQuery not found!\n\nThe bundled osqueryi was not found and no system osquery installation was detected.\n\nPlease install osquery:\n  brew install osquery\n\nOr reinstall this package to ensure bundled osqueryi is included." with title "scanx Setup Error" with icon stop buttons {"OK"} default button "OK"'
    exit 1
fi

# Configuration setup with GUI dialogs
# Note: If user cancels any dialog, installation will fail and require re-running
config_file="/etc/scanx/config/agent.conf"

# Get email from user
while true; do
    email=$(osascript -e 'text returned of (display dialog "📧 Enter employee email (required):" default answer "" with title "scanx Setup" with icon note)')
    
    # Check if user cancelled the dialog
    if [[ "$email" == "false" ]] || [[ -z "$email" ]]; then
        osascript -e 'display dialog "❌ Email is required for scanx setup.\n\nInstallation cancelled. Please run the installer again and provide a valid email address." with title "scanx Setup Cancelled" with icon stop buttons {"OK"} default button "OK"'
        exit 1
    fi
    
    # Validate email format
    if [[ "$email" == *"@"* ]]; then
        break
    else
        osascript -e 'display dialog "❌ Please enter a valid email address containing @ symbol" with title "scanx Setup" with icon stop buttons {"OK"} default button "OK"'
    fi
done

# Get interval from user (with default to 2 hours)
interval_choice=$(osascript -e 'choose from list {"5m (5 minutes)", "10m (10 minutes)", "15m (15 minutes)", "30m (30 minutes)", "1h (1 hour)", "2h (2 hours)", "4h (4 hours)", "6h (6 hours)", "8h (8 hours)", "12h (12 hours)", "24h (24 hours)"} with title "scanx Setup" with prompt "⏱️ Select data collection interval:" default items {"2h (2 hours)"}')

# Check if user cancelled the interval selection
if [[ "$interval_choice" == "false" ]] || [[ -z "$interval_choice" ]]; then
    osascript -e 'display dialog "❌ Interval selection is required for scanx setup.\n\nInstallation cancelled. Please run the installer again and select a collection interval." with title "scanx Setup Cancelled" with icon stop buttons {"OK"} default button "OK"'
    exit 1
else
    interval=$(echo "$interval_choice" | cut -d' ' -f1)
fi

# Update configuration file
sed -i '' "s/\"user_email\": \"[^\"]*\"/\"user_email\": \"$email\"/" "$config_file"
sed -i '' "s/\"interval\": \"[^\"]*\"/\"interval\": \"$interval\"/" "$config_file"

# Show configuration confirmation
osascript -e "display dialog \"✅ Configuration saved:\n\n📧 Email: $email\n⏱️ Interval: $interval\n👤 Service will run as: root (queries execute as current user)\n\nThe scanx will start automatically.\" with title \"scanx Setup Complete\" with icon note buttons {\"OK\"} default button \"OK\""

# Create directory structure and set permissions
mkdir -p /var/log/scanx
mkdir -p /var/lib/scanx
mkdir -p /usr/local/lib/scanx
touch /var/log/scanx/scanx-std.log

# Set proper permissions for user access
chmod -R 777 /var/log/scanx
chmod -R 777 /var/lib/scanx
chmod 666 /var/log/scanx/scanx-std.log

# Ensure config directory is readable by the service user
chmod -R 777 /etc/scanx
chmod -R 777 /etc/scanx/config
chmod 644 /etc/scanx/config/agent.conf

# Ensure binaries are executable by the service user
chmod -R 777 /usr/local/bin/scanx
chmod -R 755 /usr/local/lib/scanx
if [ -f "/usr/local/lib/scanx/osqueryi" ]; then
    chmod +x /usr/local/lib/scanx/osqueryi
fi

# Add /usr/local/lib/scanx to system PATH (idempotent - safe to run multiple times)
# This ensures osqueryi can be found even in fresh user contexts
if [ -f "/etc/paths" ]; then
    if ! grep -q "^/usr/local/lib/scanx$" /etc/paths; then
        echo "📝 Adding /usr/local/lib/scanx to system PATH..."
        echo "/usr/local/lib/scanx" >> /etc/paths
        echo "✅ Added /usr/local/lib/scanx to /etc/paths"
    else
        echo "✅ /usr/local/lib/scanx already in /etc/paths"
    fi
else
    echo "⚠️  /etc/paths not found, skipping PATH modification"
fi

# Verify permissions are correct
echo "🔍 Verifying permissions..."
ls -la /usr/local/bin/scanx
ls -la /etc/scanx/config/
ls -la /var/log/scanx/

# Load and start the service
echo "🚀 Starting scanx service..."
launchctl load /Library/LaunchDaemons/com.company.scanx.plist

# Wait a moment and verify service started
sleep 3
if launchctl list | grep -q "com.company.scanx"; then
    echo "✅ scanx service started successfully!"
else
    echo "⚠️  Service may not have started. Check logs:"
    echo "   tail -f /var/log/scanx/scanx-std.log"
fi

echo "scanx installed successfully with user configuration!"
echo "Email: $email"
echo "Interval: $interval"

exit 0
EOF

# Create preremove script  
cat > "$SCRIPTS_DIR/preremove" << 'EOF'
#!/bin/bash

# Stop and unload service
launchctl unload /Library/LaunchDaemons/com.company.scanx.plist 2>/dev/null || true
launchctl remove com.company.scanx 2>/dev/null || true

# Remove the configuration files
rm -rf /etc/scanx 2>/dev/null || true

# Remove the log files
rm -rf /var/log/scanx 2>/dev/null || true

# Remove the binary and backup files
rm -f /usr/local/bin/scanx 2>/dev/null || true
rm -f /usr/local/bin/scanx.old 2>/dev/null || true
rm -f /usr/local/lib/scanx/osqueryi.old 2>/dev/null || true

# Remove /usr/local/lib/scanx from system PATH if it exists
if [ -f "/etc/paths" ]; then
    if grep -q "^/usr/local/lib/scanx$" /etc/paths; then
        echo "📝 Removing /usr/local/lib/scanx from system PATH..."
        sed -i '' '/^\/usr\/local\/lib\/scanx$/d' /etc/paths
        echo "✅ Removed /usr/local/lib/scanx from /etc/paths"
    fi
fi

exit 0
EOF

# Make scripts executable
chmod +x "$SCRIPTS_DIR/"*

# Build the package
echo "🔨 Building package..."
pkgbuild --root "$PAYLOAD_DIR" \
         --scripts "$SCRIPTS_DIR" \
         --identifier "com.company.scanx" \
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
rm -rf "$BUILD_DIR/payload"
rm -rf "$BUILD_DIR/scripts"


echo ""
echo "🎉 macOS Installer Package created!"
echo "📁 Package: $BUILD_DIR/${PKG_NAME}.pkg"
echo "📦 Architecture: ${ARCH}"
echo "📦 Version: ${VERSION}"
echo ""
echo "📋 Installation:"
echo "   sudo installer -pkg $BUILD_DIR/${PKG_NAME}.pkg -target /"
echo ""

if [ -n "$INSTALLER_ID" ]; then
    echo "📋 For distribution, consider notarizing:"
    echo "   xcrun notarytool submit $BUILD_DIR/${PKG_NAME}.pkg --keychain-profile \"AC_PASSWORD\" --wait"
    echo "   xcrun stapler staple $BUILD_DIR/${PKG_NAME}.pkg"
fi

echo ""
echo "💡 To build for other architecture:"
echo "   ./scripts/create-macos-pkg.sh amd64"
echo "   ./scripts/create-macos-pkg.sh arm64"