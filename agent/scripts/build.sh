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
OSQUERY_BUILD_DIR="$DIST_DIR/builds-osqueryi"

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
            # Create proper folder structure for MSI building
            # This structure allows the build-msi.ps1 script to work correctly
            
            # Create scripts directory structure
            mkdir -p "$pkg_dir/scripts/windows"
            
            # Copy MSI build script
            if [[ -f "scripts/build-msi.ps1" ]]; then
                cp "scripts/build-msi.ps1" "$pkg_dir/scripts/"
                echo "📦 Copied build-msi.ps1"
            fi
            
            # Copy Windows build files from scripts/windows/
            WINDOWS_SCRIPTS_DIR="scripts/windows"
            if [[ -d "$WINDOWS_SCRIPTS_DIR" ]]; then
                for file in scanx.wxs scanx-manager.bat scanx-task.xml license.rtf; do
                    if [[ -f "$WINDOWS_SCRIPTS_DIR/$file" ]]; then
                        cp "$WINDOWS_SCRIPTS_DIR/$file" "$pkg_dir/scripts/windows/"
                        echo "📦 Copied $file"
                    fi
                done
            fi
            
            # Create dist directory structure for binaries
            mkdir -p "$pkg_dir/$BUILD_DIR" 
            mkdir -p "$pkg_dir/$OSQUERY_BUILD_DIR"
            
            # Copy binary with proper naming (build script expects scanx-windows-{arch}.exe)
            BINARY_SOURCE="$BUILD_DIR/${BINARY_NAME}-${platform}-${arch}${ext}"
            BINARY_DEST="$pkg_dir/$BUILD_DIR/${BINARY_NAME}-${platform}-${arch}${ext}"
            if [[ -f "$BINARY_SOURCE" ]]; then
                cp "$BINARY_SOURCE" "$BINARY_DEST"
                echo "📦 Copied binary: ${BINARY_NAME}-${platform}-${arch}${ext}"
            fi
            
            # Copy config files
            mkdir -p "$pkg_dir/config"
            cp config/* "$pkg_dir/config/"
            echo "📦 Copied config files"
            
            # Copy bundled osqueryi.exe based on architecture
            OSQUERY_SOURCE=""
            if [[ "$arch" == "amd64" ]]; then
                OSQUERY_SOURCE="$OSQUERY_BUILD_DIR/osqueryi-windows-amd64${ext}"
            elif [[ "$arch" == "arm64" ]]; then
                OSQUERY_SOURCE="$OSQUERY_BUILD_DIR/osqueryi-windows-arm64${ext}"
            fi
            
            if [[ -f "$OSQUERY_SOURCE" ]]; then
                OSQUERY_DEST="$pkg_dir/$OSQUERY_BUILD_DIR/osqueryi-windows-${arch}${ext}"
                cp "$OSQUERY_SOURCE" "$OSQUERY_DEST"
                echo "📦 Copied bundled osqueryi.exe for ${arch}"
            else
                echo "⚠️  Warning: Bundled osqueryi.exe not found at $OSQUERY_SOURCE"
                echo "   Package will rely on system osquery installation"
            fi
            ;;
    esac
    
    # Create README
    if [[ "$platform" == "windows" ]]; then
        cat > "$pkg_dir/README.md" << EOF
# scanx v$VERSION - Windows Package

## Building MSI Installer

This package contains all necessary files to build a Windows MSI installer locally.

### Prerequisites:
1. **WiX Toolset** - Download and install from https://wixtoolset.org/releases/
2. **PowerShell** - Windows PowerShell 5.1 or later

### Build MSI:

\`\`\`powershell
# Navigate to the package directory
cd scanx-windows-${arch}-v${VERSION}

# Build MSI (will prompt for architecture if not specified)
.\scripts\build-msi.ps1 ${arch}

# Or specify architecture directly:
.\scripts\build-msi.ps1 amd64
.\scripts\build-msi.ps1 arm64
\`\`\`

The MSI will be created at: \`dist\windows-build\${arch}-build\scanx-v${VERSION}-windows-${arch}.msi\`

### Package Structure:
\`\`\`
scanx-windows-${arch}-v${VERSION}/
├── scripts/
│   ├── build-msi.ps1          # Main MSI build script
│   └── windows/                # WiX source files
│       ├── scanx.wxs
│       ├── scanx-manager.bat
│       ├── scanx-task.xml
│       └── license.rtf
├── dist/
│   ├── builds/                 # Binary location
│   │   └── scanx-windows-${arch}.exe
│   └── builds-osqueryi/         # OSQuery binary
│       └── osqueryi-windows-${arch}.exe
├── config/                     # Configuration files
│   └── agent.conf
├── install/                    # Installation scripts
│   └── install-windows.ps1
├── services/                   # Service files
│   └── scanx-service.xml
├── scanx.exe                   # Binary (root, for convenience)
└── osqueryi.exe                # OSQuery (root, for convenience)
\`\`\`

## Manual Installation

If you prefer manual installation instead of MSI:

\`\`\`powershell
# Run as Administrator
.\install\install-windows.ps1
\`\`\`

## Configuration

Edit \`config\agent.conf\` to set your email and preferences.

## Service Management

### Start the service:
\`sc start scanx\`

### Check status:
\`sc query scanx\`

### Stop the service:
\`sc stop scanx\`
EOF
    else
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

## Configuration

Edit \`config/agent.conf\` to set your email and preferences.

## Service Management

### Start the service:
- macOS: \`sudo launchctl load /Library/LaunchDaemons/com.company.scanx.plist\`
- Linux: \`sudo systemctl start scanx\`

### Check status:
- macOS: \`sudo launchctl list | grep scanx\`
- Linux: \`sudo systemctl status scanx\`
EOF
    fi
    
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

create_checksum_json(){
    local dir=$1
    local checksum_file="$dir/checksums.json"
    
    # Check if directory exists
    if [[ ! -d "$dir" ]]; then
        echo "⚠️  Directory not found: $dir (skipping checksum generation)"
        return 0
    fi
    
    # Check if directory has any files (excluding checksums.json itself)
    local file_count=$(find "$dir" -type f ! -name "checksums.json" | wc -l | tr -d ' ')
    if [[ "$file_count" -eq 0 ]]; then
        echo "⚠️  No files found in $dir (skipping checksum generation)"
        return 0
    fi
    
    echo "📝 Generating checksums for files in $dir..."
    
    # Determine checksum command based on OS
    local checksum_cmd=""
    if command -v shasum &> /dev/null; then
        # macOS/Linux with shasum
        checksum_cmd="shasum -a 256"
    elif command -v sha256sum &> /dev/null; then
        # Linux with sha256sum
        checksum_cmd="sha256sum"
    else
        echo "❌ No SHA256 checksum tool found (shasum or sha256sum required)"
        return 1
    fi
    
    # Start building JSON
    local json_content="{\n"
    json_content+="  \"version\": \"$VERSION\",\n"
    json_content+="  \"algorithm\": \"SHA256\",\n"
    json_content+="  \"checksums\": {\n"
    
    # Process each file in the directory and count processed files
    local first=true
    local processed_count=0
    while IFS= read -r -d '' file; do
        # Skip the checksums.json file itself
        if [[ "$(basename "$file")" == "checksums.json" || "$(basename "$file")" == "naming_convention.conf" ]]; then
            continue
        fi
        
        # Calculate checksum
        local checksum
        if [[ "$checksum_cmd" == "shasum -a 256" ]]; then
            checksum=$($checksum_cmd "$file" | awk '{print $1}')
        else
            checksum=$($checksum_cmd "$file" | awk '{print $1}')
        fi
        
        # Get relative filename from directory
        local filename=$(basename "$file")
        
        # Add comma if not first entry
        if [[ "$first" == true ]]; then
            first=false
        else
            json_content+=",\n"
        fi
        
        # Add checksum entry
        json_content+="    \"$filename\": \"$checksum\""
        ((processed_count++))
        
    done < <(find "$dir" -type f ! -name "checksums.json" -print0 | sort -z)
    
    # Close JSON
    json_content+="\n  }\n"
    json_content+="}\n"
    
    # Write JSON to file
    echo -e "$json_content" > "$checksum_file"
    
    echo "✅ Checksum file created: $checksum_file"
    echo "   Generated checksums for $processed_count file(s)"
}

# Create packages for all platforms
create_package "darwin" "amd64" ""
create_package "darwin" "arm64" ""
create_package "linux" "amd64" ""
create_package "linux" "arm64" ""
create_package "windows" "amd64" ".exe"
create_package "windows" "arm64" ".exe"

create_checksum_json $BUILD_DIR
create_checksum_json $OSQUERY_BUILD_DIR


echo ""
echo "🎉 Build complete! Distribution structure:"
echo "📁 $DIST_DIR/"
echo "├── builds/                    # Raw binaries"
echo "├── packages/                  # Platform-specific packages"
echo "├── scanx-${VERSION}.pkg           # macOS installer (if built)"
echo "├── linux-packages/           # DEB/RPM structures (if built)"
echo "├── windows-build/            # Windows MSI build output (if built)"
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
echo "      • Windows .msi: .\scripts\build-msi.ps1 [amd64|arm64] (requires Windows + WiX Toolset)"
echo ""
echo "3. Deploy via your organization's software distribution system"