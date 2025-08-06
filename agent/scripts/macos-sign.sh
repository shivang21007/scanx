#!/bin/bash

# macOS Code Signing Script for MDM Agent
# This script signs the macOS binary for seamless installation

set -e

# Configuration
BINARY_PATH="builds/mdm-agent-darwin-amd64"
DEVELOPER_ID="${1:-}"
ENTITLEMENTS_FILE="scripts/entitlements.plist"

echo "🍎 macOS Code Signing for MDM Agent"
echo "=================================="

# Check if binary exists
if [ ! -f "$BINARY_PATH" ]; then
    echo "❌ Binary not found: $BINARY_PATH"
    echo "Run './scripts/build.sh' first"
    exit 1
fi

# Create entitlements file
echo "📝 Creating entitlements file..."
cat > "$ENTITLEMENTS_FILE" << 'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>com.apple.security.cs.allow-jit</key>
    <true/>
    <key>com.apple.security.cs.allow-unsigned-executable-memory</key>
    <true/>
    <key>com.apple.security.cs.disable-executable-page-protection</key>
    <true/>
    <key>com.apple.security.cs.disable-library-validation</key>
    <true/>
    <key>com.apple.security.cs.allow-dyld-environment-variables</key>
    <true/>
    <key>com.apple.security.network.client</key>
    <true/>
    <key>com.apple.security.network.server</key>
    <true/>
</dict>
</plist>
EOF

# Check available signing identities
echo ""
echo "🔍 Available signing identities:"
security find-identity -v -p codesigning | grep "Developer ID Application" || echo "❌ No Developer ID Application certificates found"

if [ -z "$DEVELOPER_ID" ]; then
    echo ""
    echo "💡 Usage Options:"
    echo ""
    echo "1. Ad-hoc signing (for internal use):"
    echo "   $0"
    echo ""
    echo "2. Developer ID signing (for distribution):"
    echo "   $0 \"Developer ID Application: Your Name (TEAMID)\""
    echo ""
    echo "📋 To get a Developer ID certificate:"
    echo "   1. Join Apple Developer Program (\$99/year)"
    echo "   2. Create Developer ID Application certificate"
    echo "   3. Download and install in Keychain"
    echo ""
    
    read -p "🤔 Use ad-hoc signing for internal testing? [y/N]: " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "❌ Cancelled by user"
        exit 1
    fi
    
    echo "⚠️  Using ad-hoc signing (internal use only)"
    SIGNING_IDENTITY="-"
else
    echo "✅ Using Developer ID: $DEVELOPER_ID"
    SIGNING_IDENTITY="$DEVELOPER_ID"
fi

# Sign the binary
echo ""
echo "🔐 Signing binary..."
codesign --force --options runtime --entitlements "$ENTITLEMENTS_FILE" --sign "$SIGNING_IDENTITY" "$BINARY_PATH"

# Verify signature
echo "✅ Verifying signature..."
codesign --verify --verbose "$BINARY_PATH"
echo ""

# Check if Developer ID was used (requires notarization)
if [ "$SIGNING_IDENTITY" != "-" ]; then
    echo "📋 Next Steps for Distribution:"
    echo "1. Notarize the binary:"
    echo "   xcrun notarytool submit $BINARY_PATH --keychain-profile \"AC_PASSWORD\" --wait"
    echo ""
    echo "2. Staple the notarization:"
    echo "   xcrun stapler staple $BINARY_PATH"
    echo ""
    echo "📖 Setup notarization profile:"
    echo "   xcrun notarytool store-credentials \"AC_PASSWORD\" --apple-id \"your-apple-id@email.com\" --team-id \"TEAMID\" --password \"app-specific-password\""
else
    echo "✅ Ad-hoc signed binary ready for internal testing"
fi

echo ""
echo "🎉 Code signing completed!"
echo "📁 Signed binary: $BINARY_PATH"

# Clean up
rm -f "$ENTITLEMENTS_FILE"