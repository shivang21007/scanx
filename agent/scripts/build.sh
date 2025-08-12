#!/bin/bash

# Cross-platform build script for MDM Agent
# This script builds the agent for multiple operating systems

set -e

# Configuration
BINARY_NAME="mdm-agent"
VERSION=$(cat config/agent.conf | grep -o '"version": "[^"]*"' | cut -d'"' -f4)
DIST_DIR="dist"
BUILD_DIR="$DIST_DIR/builds"
PACKAGES_DIR="$DIST_DIR/packages"

# Smart cleanup - only remove build artifacts, preserve existing packages
echo "🧹 Cleaning build artifacts..."
rm -rf "$BUILD_DIR"
rm -rf "$PACKAGES_DIR"


# Create build directories
mkdir -p "$BUILD_DIR"
mkdir -p "$PACKAGES_DIR"
mkdir -p "$DIST_DIR/linux-packages"
mkdir -p "$DIST_DIR/msi-build"  

echo "🚀 Building MDM Agent v$VERSION for multiple platforms..."

# Build for different platforms
build_platform() {
    local GOOS=$1
    local GOARCH=$2
    local ext=$3
    local output_name="${BINARY_NAME}-${GOOS}-${GOARCH}${ext}"
    
    echo "📦 Building for $GOOS/$GOARCH..."
    
    GOOS=$GOOS GOARCH=$GOARCH go build \
        -ldflags "-s -w -X main.version=$VERSION" \
        -o "$BUILD_DIR/$output_name" \
        ./cmd/agent
    
    echo "✅ Built: $BUILD_DIR/$output_name"
}

# Build for all target platforms
echo "🔨 Building binaries..."

# macOS
build_platform "darwin" "amd64" ""
build_platform "darwin" "arm64" ""

# Windows
build_platform "windows" "amd64" ".exe"
build_platform "windows" "386" ".exe"

# Linux
build_platform "linux" "amd64" ""
build_platform "linux" "386" ""
build_platform "linux" "arm64" ""

# macOS Code Signing Integration
sign_macos_binaries() {
    local darwin_amd64="$BUILD_DIR/${BINARY_NAME}-darwin-amd64"
    local darwin_arm64="$BUILD_DIR/${BINARY_NAME}-darwin-arm64"
    
    if [[ -f "$darwin_amd64" ]] || [[ -f "$darwin_arm64" ]]; then
        echo ""
        echo "🍎 macOS Gatekeeper Protection"
        echo "============================="
        echo "macOS binaries need signing to avoid 'killed' errors."
        echo ""
        read -p "🔐 Sign macOS binaries? [y/N]: " -n 1 -r
        echo
        
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            echo "🔐 Using macos-sign.sh for signing..."
            ./scripts/macos-sign.sh
            echo "✅ macOS binaries signed successfully!"
        else
            echo "⚠️  Skipping signing - binaries may be blocked by Gatekeeper"
        fi
    fi
}

# Sign macOS binaries
sign_macos_binaries

echo ""
echo "📋 Build Summary:"
ls -la $BUILD_DIR/

# Create distribution packages
echo ""
echo "📦 Creating distribution packages..."

create_package() {
    local platform=$1
    local arch=$2
    local ext=$3
    local package_name="${BINARY_NAME}-${platform}-${arch}-v${VERSION}"
    
    echo "Creating package: $package_name"
    
    # Create package directory
    local pkg_dir="$PACKAGES_DIR/$package_name"
    mkdir -p "$pkg_dir"
    
    # Copy binary
    cp "$BUILD_DIR/${BINARY_NAME}-${platform}-${arch}${ext}" "$pkg_dir/${BINARY_NAME}${ext}"
    
    # Copy config files
    mkdir -p "$pkg_dir/config"
    cp config/* "$pkg_dir/config/"
    
    # Copy only relevant installation script and service files
    mkdir -p "$pkg_dir/install"
    mkdir -p "$pkg_dir/services"
    
    case $platform in
        "darwin")
            cp "scripts/install/install-macos.sh" "$pkg_dir/install/"
            cp "scripts/services/com.company.mdm-agent.plist" "$pkg_dir/services/"
            ;;
        "linux")
            cp "scripts/install/install-linux.sh" "$pkg_dir/install/"
            cp "scripts/services/mdm-agent.service" "$pkg_dir/services/"
            ;;
        "windows")
            cp "scripts/install/install-windows.ps1" "$pkg_dir/install/"
            cp "scripts/services/mdm-agent-service.xml" "$pkg_dir/services/"
            ;;
    esac
    
    # Create README
    cat > "$pkg_dir/README.md" << EOF
# MDM Agent v$VERSION

## Installation

Run the appropriate installation script for your platform:

### macOS:
\`\`\`bash
sudo ./install/install-macos.sh
\`\`\`

### Linux:
\`\`\`bash
sudo ./install/install-linux.sh
\`\`\`

### Windows (Run as Administrator):
\`\`\`powershell
.\install\install-windows.ps1
\`\`\`

## Configuration

Edit \`config/agent.conf\` to set your email and preferences.

## Service Management

### Start the service:
- macOS: \`sudo launchctl load /Library/LaunchDaemons/com.company.mdm-agent.plist\`
- Linux: \`sudo systemctl start mdm-agent\`
- Windows: \`sc start MDMAgent\`

### Check status:
- macOS: \`sudo launchctl list | grep mdm-agent\`
- Linux: \`sudo systemctl status mdm-agent\`
- Windows: \`sc query MDMAgent\`
EOF
    
    # Create tar.gz for Unix platforms
    if [[ "$platform" != "windows" ]]; then
        cd "$PACKAGES_DIR"
        tar -czf "${package_name}.tar.gz" "$package_name"
        cd - > /dev/null
    else
        # Create zip for Windows
        cd "$PACKAGES_DIR"
        zip -r "${package_name}.zip" "$package_name"
        cd - > /dev/null
    fi
    
    echo "✅ Package created: $PACKAGES_DIR/$package_name"
}

# Create packages for all platforms
create_package "darwin" "amd64" ""
create_package "darwin" "arm64" ""
create_package "linux" "amd64" ""
create_package "linux" "arm64" ""
create_package "windows" "amd64" ".exe"



echo ""
echo "🎉 Build complete! Distribution structure:"
echo "📁 $DIST_DIR/"
echo "├── builds/                    # Raw binaries"
echo "├── packages/                  # Platform-specific packages"
echo "├── MDMAgent-${VERSION}.pkg           # macOS installer (if built)"
echo "├── linux-packages/           # DEB/RPM structures (if built)"
echo "├── msi-build/                 # Windows MSI sources (if built)"
echo "└── tmp/                       # Temporary build files"
echo ""
ls -la $DIST_DIR/

echo ""
echo "📋 Next steps:"
echo "1. Test packages: $PACKAGES_DIR/*.tar.gz"
echo "2. Build native installers (optional):"
echo "   • macOS .pkg: ./scripts/create-macos-pkg.sh (requires macOS)"
echo "   • Linux .deb/.rpm: ./scripts/create-linux-packages.sh (requires Linux)"
echo "   • Windows .msi: ./scripts/create-windows-msi.sh (requires Windows + WiX Toolset)"
echo "3. Deploy via your organization's software distribution system"