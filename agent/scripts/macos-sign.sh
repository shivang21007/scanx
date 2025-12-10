#!/bin/bash

# macOS Code Signing Script for scanx and osqueryi
# This script signs both the scanx and osqueryi binaries for seamless installation
# Usage: ./macos-sign.sh [DEVELOPER_ID] [--yes]

# Don't exit on error - we want to try signing all binaries even if one fails
set +e

# Parse command line arguments
AUTO_YES=false
DEVELOPER_ID=""
for arg in "$@"; do
    case $arg in
        -y|--yes)
            AUTO_YES=true
            ;;
        *)
            if [[ -z "$DEVELOPER_ID" ]]; then
                DEVELOPER_ID="$arg"
            fi
            ;;
    esac
done
ENTITLEMENTS_FILE="scripts/entitlements.plist"
VERSION=$(cat config/agent.conf | grep -o '"scanx_version": "[^"]*"' | cut -d'"' -f4)
DIST_DIR="dist/${VERSION}"
OSQUERY_BUILD_DIR="$DIST_DIR/builds-osqueryi"
BUILD_DIR="$DIST_DIR/builds"

# Create version-based directory structure
mkdir -p "$DIST_DIR"
# Define binaries to sign
SCANX_AMD64="$BUILD_DIR/scanx-darwin-amd64"
SCANX_ARM64="$BUILD_DIR/scanx-darwin-arm64"
OSQUERYI_AMD64="$OSQUERY_BUILD_DIR/osqueryi-darwin-amd64"
OSQUERYI_ARM64="$OSQUERY_BUILD_DIR/osqueryi-darwin-arm64"

echo "🍎 macOS Code Signing for scanx and osqueryi"
echo "=============================================="
echo ""

# Check if binaries exist
BINARIES_FOUND=0
BINARIES_TO_SIGN=()

if [ -f "$SCANX_AMD64" ]; then
    BINARIES_TO_SIGN+=("$SCANX_AMD64")
    BINARIES_FOUND=$((BINARIES_FOUND + 1))
    echo "✅ Found: scanx-darwin-amd64"
else
    echo "⚠️  Not found: scanx-darwin-amd64"
fi

if [ -f "$SCANX_ARM64" ]; then
    BINARIES_TO_SIGN+=("$SCANX_ARM64")
    BINARIES_FOUND=$((BINARIES_FOUND + 1))
    echo "✅ Found: scanx-darwin-arm64"
else
    echo "⚠️  Not found: scanx-darwin-arm64"
fi

if [ -f "$OSQUERYI_AMD64" ]; then
    BINARIES_TO_SIGN+=("$OSQUERYI_AMD64")
    BINARIES_FOUND=$((BINARIES_FOUND + 1))
    echo "✅ Found: osqueryi-darwin-x86_64"
else
    echo "⚠️  Not found: osqueryi-darwin-x86_64"
fi

if [ -f "$OSQUERYI_ARM64" ]; then
    BINARIES_TO_SIGN+=("$OSQUERYI_ARM64")
    BINARIES_FOUND=$((BINARIES_FOUND + 1))
    echo "✅ Found: osqueryi-darwin-arm64"
else
    echo "⚠️  Not found: osqueryi-darwin-arm64"
fi

echo ""

if [ $BINARIES_FOUND -eq 0 ]; then
    echo "❌ No binaries found to sign!"
    echo "Run './scripts/build.sh' first to build the binaries"
    exit 1
fi

echo "📦 Found $BINARIES_FOUND binary/binaries to sign"
echo ""

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
security find-identity -v -p codesigning | grep "Developer ID Application" || echo " No Developer ID Application certificates found , continue with ad-hoc signing ...."

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
    
    if [[ "$AUTO_YES" == true ]]; then
        echo "⚠️  Using ad-hoc signing (--yes flag, internal use only)"
        SIGNING_IDENTITY="-"
    else
        read -p "🤔 Use ad-hoc signing for internal testing? [y/N]: " -n 1 -r </dev/tty
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "❌ Cancelled by user"
        exit 1
    fi
    
    echo "⚠️  Using ad-hoc signing (internal use only)"
    SIGNING_IDENTITY="-"
    fi
else
    echo "✅ Using Developer ID: $DEVELOPER_ID"
    SIGNING_IDENTITY="$DEVELOPER_ID"
fi

# Sign all binaries and Remove quarantine attributes from binaries
echo "🔐 Signing binaries..."
echo ""

SIGNED_BINARIES=()
FAILED_BINARIES=()

for binary in "${BINARIES_TO_SIGN[@]}"; do
    binary_name=$(basename "$binary")
    echo "📝 Signing: $binary_name"
    
    # Remove quarantine attribute BEFORE signing (best practice)
    if xattr -rd com.apple.quarantine "$binary" 2>/dev/null; then
        echo "   🧹 Removed quarantine attribute"
    fi
    
    # Sign the binary
    if codesign --force --options runtime --entitlements "$ENTITLEMENTS_FILE" --sign "$SIGNING_IDENTITY" --timestamp "$binary" 2>&1; then
        # Verify signature
        if codesign --verify --verbose "$binary" > /dev/null 2>&1; then
            # Remove quarantine again after signing (ensure it's gone)
            xattr -rd com.apple.quarantine "$binary" 2>/dev/null || true
            SIGNED_BINARIES+=("$binary")
            echo "   ✅ Signed and verified: $binary_name"
        else
            FAILED_BINARIES+=("$binary")
            echo "   ❌ Verification failed: $binary_name"
        fi
    else
        FAILED_BINARIES+=("$binary")
        echo "   ❌ Signing failed: $binary_name"
    fi
    echo ""
done

# Summary
echo "📊 Signing Summary:"
echo "==================="
echo "✅ Successfully signed: ${#SIGNED_BINARIES[@]} binary/binaries"
if [ ${#FAILED_BINARIES[@]} -gt 0 ]; then
    echo "❌ Failed to sign: ${#FAILED_BINARIES[@]} binary/binaries"
    for failed in "${FAILED_BINARIES[@]}"; do
        echo "   - $(basename "$failed")"
    done
fi
echo ""

# Check if Developer ID was used (requires notarization)
if [ "$SIGNING_IDENTITY" != "-" ]; then
    echo "📋 Next Steps for Distribution:"
    echo ""
    echo "1. Notarize the binaries:"
    for binary in "${SIGNED_BINARIES[@]}"; do
        echo "   xcrun notarytool submit $binary --keychain-profile \"AC_PASSWORD\" --wait"
    done
    echo ""
    echo "2. Staple the notarization:"
    for binary in "${SIGNED_BINARIES[@]}"; do
        echo "   xcrun stapler staple $binary"
    done
    echo ""
    echo "📖 Setup notarization profile:"
    echo "   xcrun notarytool store-credentials \"AC_PASSWORD\" --apple-id \"your-apple-id@email.com\" --team-id \"TEAMID\" --password \"app-specific-password\""
else
    echo "✅ Ad-hoc signed binaries ready for internal testing"
fi

echo ""
if [ ${#FAILED_BINARIES[@]} -eq 0 ]; then
    echo "🎉 Code signing completed successfully!"
    echo "📁 Signed binaries:"
    for binary in "${SIGNED_BINARIES[@]}"; do
        echo "   - $binary"
    done
else
    echo "⚠️  Code signing completed with errors"
    exit 1
fi

# Clean up
rm -f "$ENTITLEMENTS_FILE"