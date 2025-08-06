#!/bin/bash

# Create macOS Installer Package (.pkg) for MDM Agent
# This creates a signed installer package for seamless distribution

set -e

# Configuration
VERSION=$(cat config/agent.conf | grep -o '"version": "[^"]*"' | cut -d'"' -f4)
PKG_NAME="MDMAgent-${VERSION}"
INSTALLER_ID="${1:-}"
BUILD_DIR="pkg-build"
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
mkdir -p "$PAYLOAD_DIR/usr/local/etc/mdm-agent/config"
mkdir -p "$PAYLOAD_DIR/Library/LaunchDaemons"

# Copy files to payload
cp "builds/mdm-agent-darwin-amd64" "$PAYLOAD_DIR/usr/local/bin/mdm-agent"
cp "config/"* "$PAYLOAD_DIR/usr/local/etc/mdm-agent/config/"
cp "scripts/services/com.company.mdm-agent.plist" "$PAYLOAD_DIR/Library/LaunchDaemons/"

# Set permissions
chmod +x "$PAYLOAD_DIR/usr/local/bin/mdm-agent"
chmod 644 "$PAYLOAD_DIR/usr/local/etc/mdm-agent/config/"*
chmod 644 "$PAYLOAD_DIR/Library/LaunchDaemons/com.company.mdm-agent.plist"

# Create preinstall script
echo "📝 Creating installation scripts..."
cat > "$SCRIPTS_DIR/preinstall" << 'EOF'
#!/bin/bash

# Stop existing service if running
launchctl unload /Library/LaunchDaemons/com.company.mdm-agent.plist 2>/dev/null || true

# Remove quarantine from any existing binary
if [ -f "/usr/local/bin/mdm-agent" ]; then
    xattr -rd com.apple.quarantine /usr/local/bin/mdm-agent 2>/dev/null || true
fi

exit 0
EOF

# Create postinstall script
cat > "$SCRIPTS_DIR/postinstall" << 'EOF'
#!/bin/bash

# Remove quarantine attributes
xattr -rd com.apple.quarantine /usr/local/bin/mdm-agent 2>/dev/null || true

# Ad-hoc sign the binary
codesign --force --deep --sign - /usr/local/bin/mdm-agent 2>/dev/null || true

# Prompt for configuration if agent.conf has default values
if grep -q "shivang123@gmail.com" /usr/local/etc/mdm-agent/config/agent.conf; then
    # Show configuration dialog
    email=$(osascript -e 'text returned of (display dialog "Enter employee email:" default answer "" with title "MDM Agent Setup")')
    
    if [ ! -z "$email" ]; then
        sed -i '' "s/\"user_email\": \"[^\"]*\"/\"user_email\": \"$email\"/" /usr/local/etc/mdm-agent/config/agent.conf
    fi
fi

# Load and start the service
launchctl load /Library/LaunchDaemons/com.company.mdm-agent.plist

# Create logs directory
mkdir -p /var/log
touch /var/log/mdm-agent.log
chmod 644 /var/log/mdm-agent.log

echo "MDM Agent installed successfully!"

exit 0
EOF

# Create preremove script  
cat > "$SCRIPTS_DIR/preremove" << 'EOF'
#!/bin/bash

# Stop and unload service
launchctl unload /Library/LaunchDaemons/com.company.mdm-agent.plist 2>/dev/null || true

exit 0
EOF

# Make scripts executable
chmod +x "$SCRIPTS_DIR/"*

# Build the package
echo "🔨 Building package..."
pkgbuild --root "$PAYLOAD_DIR" \
         --scripts "$SCRIPTS_DIR" \
         --identifier "com.company.mdm-agent" \
         --version "$VERSION" \
         --install-location "/" \
         "${PKG_NAME}-unsigned.pkg"

# Sign the package if installer identity provided
if [ -n "$INSTALLER_ID" ]; then
    echo "🔐 Signing package..."
    productsign --sign "$INSTALLER_ID" "${PKG_NAME}-unsigned.pkg" "${PKG_NAME}.pkg"
    rm "${PKG_NAME}-unsigned.pkg"
    echo "✅ Signed package created: ${PKG_NAME}.pkg"
else
    mv "${PKG_NAME}-unsigned.pkg" "${PKG_NAME}.pkg"
    echo "⚠️  Unsigned package created: ${PKG_NAME}.pkg"
    echo ""
    echo "💡 To sign the package:"
    echo "   productsign --sign \"Developer ID Installer: Your Name (TEAMID)\" ${PKG_NAME}.pkg ${PKG_NAME}-signed.pkg"
fi

# Clean up
rm -rf "$BUILD_DIR"

echo ""
echo "🎉 macOS Installer Package created!"
echo "📁 Package: ${PKG_NAME}.pkg"
echo ""
echo "📋 Installation:"
echo "   sudo installer -pkg ${PKG_NAME}.pkg -target /"
echo ""

if [ -n "$INSTALLER_ID" ]; then
    echo "📋 For distribution, consider notarizing:"
    echo "   xcrun notarytool submit ${PKG_NAME}.pkg --keychain-profile \"AC_PASSWORD\" --wait"
    echo "   xcrun stapler staple ${PKG_NAME}.pkg"
fi