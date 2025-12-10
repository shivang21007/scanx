#!/bin/bash

# Build all packages for all architectures
# This script builds macOS and Linux packages for both AMD64 and ARM64

set -e

echo "🚀 Building All Packages for All Architectures"
echo "=============================================="
echo ""

# Get version from config
VERSION=$(cat config/agent.conf | grep -o '"scanx_version": "[^"]*"' | cut -d'"' -f4)
DIST_DIR="dist/${VERSION}"
echo "📦 Version: ${VERSION}"
echo ""

# Create version-based directory structure
mkdir -p "$DIST_DIR"

# Check if binaries exist
echo "🔍 Checking for built binaries..."
if [[ ! -f "$DIST_DIR/builds/scanx-darwin-amd64" ]] || \
   [[ ! -f "$DIST_DIR/builds/scanx-darwin-arm64" ]] || \
   [[ ! -f "$DIST_DIR/builds/scanx-linux-amd64" ]] || \
   [[ ! -f "$DIST_DIR/builds/scanx-linux-arm64" ]]; then
    echo "❌ Some binaries are missing. Please run ./scripts/build.sh first."
    exit 1
fi
echo "✅ All binaries found"
echo ""

# Build macOS packages
echo "🍎 Building macOS Packages"
echo "=========================="
echo ""

echo "📦 Building macOS AMD64 package..."
./scripts/create-macos-pkg.sh amd64
echo ""

echo "📦 Building macOS ARM64 package..."
./scripts/create-macos-pkg.sh arm64
echo ""

# Build Linux packages
echo "🐧 Building Linux Packages"
echo "========================="
echo ""

echo "📦 Building Linux AMD64 package..."
./scripts/create-linux-packages.sh 1 amd64 # 1 = DEB, 2 = RPM, 3 = Both
echo ""

echo "📦 Building Linux ARM64 package..."
./scripts/create-linux-packages.sh 1 arm64 # 1 = DEB, 2 = RPM, 3 = Both
echo ""

# Summary
echo ""
echo "🎉 All Packages Built Successfully!"
echo "==================================="
echo ""
echo "📦 macOS Packages:"
find "$DIST_DIR/macos-build-"* -name "*.pkg" 2>/dev/null | while read pkg; do
    echo "   $(basename "$pkg")"
done
echo ""

echo "📦 Linux Packages:"
find "$DIST_DIR/linux-packages" -name "*.deb" -o -name "*.rpm" 2>/dev/null | while read pkg; do
    if [[ -f "$pkg" ]]; then
        echo "   $(basename "$pkg")"
    fi
done
echo ""

echo "📁 Package Locations:"
echo "   macOS: $DIST_DIR/macos-build-amd64/ and $DIST_DIR/macos-build-arm64/"
echo "   Linux DEB: $DIST_DIR/linux-packages/deb-amd64/ and $DIST_DIR/linux-packages/deb-arm64/"
echo "   Linux RPM: $DIST_DIR/linux-packages/rpm-amd64/ and $DIST_DIR/linux-packages/rpm-arm64/"
echo ""

echo "✅ Build complete!"

