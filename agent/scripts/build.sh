#!/bin/bash

# Cross-platform build script for scanx
# This script builds the agent for multiple operating systems

set -e

# Configuration
BINARY_NAME="scanx"
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

echo "🚀 Building scanx v$VERSION for multiple platforms..."

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
        -trimpath \
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
build_platform "windows" "arm64" ".exe"

# Linux
build_platform "linux" "amd64" ""
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
            cp "scripts/services/com.company.scanx.plist" "$pkg_dir/services/"
            ;;
        "linux")
            cp "scripts/install/install-linux.sh" "$pkg_dir/install/"
            cp "scripts/services/scanx.service" "$pkg_dir/services/"
            ;;
        "windows")
            # Copy MSI build files
            MSI_DIR="dist/msi-build/taskSchedulerApproach"
            if [[ -d "$MSI_DIR" ]]; then
                # Copy MSI-related files individually
                for file in build-msi.ps1 scanx.wxs scanx-task.xml license.rtf scanx-manager.bat; do
                    if [[ -f "$MSI_DIR/$file" ]]; then
                        cp "$MSI_DIR/$file" "$pkg_dir/"
                    fi
                done
            fi
            
            # Create directories for installation script and service files
            mkdir -p "$pkg_dir/install"
            mkdir -p "$pkg_dir/services"
            
            # Copy installation script and service files
            cp "scripts/install/install-windows.ps1" "$pkg_dir/install/"
            cp "scripts/services/scanx-service.xml" "$pkg_dir/services/"
            
            # Copy binary (rename to scanx.exe)
            cp "$BUILD_DIR/${BINARY_NAME}-${platform}-${arch}${ext}" "$pkg_dir/"
            
            # Copy config files
            mkdir -p "$pkg_dir/config"
            cp config/* "$pkg_dir/config/"
            
            # Copy bundled osqueryi.exe based on architecture
            OSQUERY_SOURCE=""
            if [[ "$arch" == "amd64" ]]; then
                OSQUERY_SOURCE="dist/builds-osquery/osqueryi-5.20.0.windows_x86_64.exe"
            elif [[ "$arch" == "arm64" ]]; then
                OSQUERY_SOURCE="dist/builds-osquery/osqueryi-5.20.0.windows_arm64.exe"
            fi
            
            if [[ -f "$OSQUERY_SOURCE" ]]; then
                echo "📦 Including bundled osqueryi.exe for ${arch}..."
                cp "$OSQUERY_SOURCE" "$pkg_dir/osqueryi.exe"
                echo "✅ Bundled osqueryi.exe included"
            else
                echo "⚠️  Warning: Bundled osqueryi.exe not found at $OSQUERY_SOURCE"
                echo "   Package will rely on system osquery installation"
            fi
            ;;
    esac
    
    # Create README
    cat > "$pkg_dir/README.md" << EOF
# scanx v$VERSION

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
- macOS: \`sudo launchctl load /Library/LaunchDaemons/com.company.scanx.plist\`
- Linux: \`sudo systemctl start scanx\`
- Windows: \`sc start scanx\`

### Check status:
- macOS: \`sudo launchctl list | grep scanx\`
- Linux: \`sudo systemctl status scanx\`
- Windows: \`sc query scanx\`
EOF
    
    # Create tar.gz for Unix platforms
    if [[ "$platform" != "windows" ]]; then
        cd "$PACKAGES_DIR"
        tar -czf "${package_name}.tar.gz" "$package_name"
        cd - > /dev/null
        echo "✅ Package created: $PACKAGES_DIR/${package_name}.tar.gz"
    else
        # Create zip for Windows
        cd "$PACKAGES_DIR"
        # Use zip with explicit file inclusion to ensure all files are added
        zip -r "${package_name}.zip" "$package_name" -x "*.DS_Store" "*.git*"
        cd - > /dev/null
        echo "✅ Windows package created: $PACKAGES_DIR/${package_name}.zip"
        echo "   Contents:"
        unzip -l "$PACKAGES_DIR/${package_name}.zip" 2>/dev/null | head -20 || echo "   (unzip not available to list contents)"
    fi

    #clean up the package directory
    rm -rf "$pkg_dir"
}

# Create packages for all platforms
create_package "darwin" "amd64" ""
create_package "darwin" "arm64" ""
create_package "linux" "amd64" ""
create_package "linux" "arm64" ""
create_package "windows" "amd64" ".exe"
create_package "windows" "arm64" ".exe"



echo ""
echo "🎉 Build complete! Distribution structure:"
echo "📁 $DIST_DIR/"
echo "├── builds/                    # Raw binaries"
echo "├── packages/                  # Platform-specific packages"
echo "├── scanx-${VERSION}.pkg           # macOS installer (if built)"
echo "├── linux-packages/           # DEB/RPM structures (if built)"
echo "├── msi-build/                 # Windows MSI sources (if built)"
echo "└── tmp/                       # Temporary build files"
echo ""
ls -la $DIST_DIR/

echo ""
echo "📋 Next steps:"
echo "1. Test packages: $PACKAGES_DIR/*.tar.gz"
echo "2. Build native installers (optional):"
echo ""
echo "   📦 Build All Packages (All Architectures):"
echo "      ./scripts/build-all-packages.sh"
echo ""
echo "   📦 Build Individual Packages:"
echo "      • macOS .pkg (AMD64):  ./scripts/create-macos-pkg.sh amd64"
echo "      • macOS .pkg (ARM64):  ./scripts/create-macos-pkg.sh arm64"
echo "      • Linux DEB/RPM (AMD64): ./scripts/create-linux-packages.sh 3 amd64"
echo "      • Linux DEB/RPM (ARM64): ./scripts/create-linux-packages.sh 3 arm64"
echo "      • Linux DEB/RPM (Both):  ./scripts/create-linux-packages.sh 3 both"
echo "      • Windows .msi: ./scripts/create-windows-msi.sh (requires Windows + WiX Toolset)"
echo ""
echo "3. Deploy via your organization's software distribution system"