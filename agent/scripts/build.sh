#!/bin/bash

# Cross-platform build script for MDM Agent
# This script builds the agent for multiple operating systems

set -e

# Configuration
BINARY_NAME="mdm-agent"
VERSION=$(cat config/agent.conf | grep -o '"version": "[^"]*"' | cut -d'"' -f4)
BUILD_DIR="builds"
DIST_DIR="dist"

# Create build directories
mkdir -p $BUILD_DIR
mkdir -p $DIST_DIR

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
    local pkg_dir="$DIST_DIR/$package_name"
    mkdir -p "$pkg_dir"
    
    # Copy binary
    cp "$BUILD_DIR/${BINARY_NAME}-${platform}-${arch}${ext}" "$pkg_dir/${BINARY_NAME}${ext}"
    
    # Copy config files
    cp -r config "$pkg_dir/"
    
    # Copy installation scripts
    cp -r scripts/install "$pkg_dir/"
    
    # Copy service files
    cp -r scripts/services "$pkg_dir/"
    
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
        cd "$DIST_DIR"
        tar -czf "${package_name}.tar.gz" "$package_name"
        cd ..
    else
        # Create zip for Windows
        cd "$DIST_DIR"
        zip -r "${package_name}.zip" "$package_name"
        cd ..
    fi
    
    echo "✅ Package created: $DIST_DIR/$package_name"
}

# Create packages for all platforms
create_package "darwin" "amd64" ""
create_package "darwin" "arm64" ""
create_package "linux" "amd64" ""
create_package "linux" "arm64" ""
create_package "windows" "amd64" ".exe"

echo ""
echo "🎉 Build complete! Distribution packages:"
ls -la $DIST_DIR/

echo ""
echo "📋 Next steps:"
echo "1. Test the packages on target platforms"
echo "2. Install using the included installation scripts"
echo "3. The agent will run as a system service and auto-restart on boot"