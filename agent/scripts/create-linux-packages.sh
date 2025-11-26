#!/bin/bash

# Create Linux DEB and RPM packages for scanx with actual package building
# Supports both AMD64 and ARM64 architectures
# "💡 Usage:"
# "   Build for specific arch: ./scripts/create-linux-packages.sh <1=deb, 2=rpm, 3=both> <amd64 or arm64 or both>"
# "   Build for both archs: ./scripts/create-linux-packages.sh <1=deb, 2=rpm, 3=both> <amd64 or arm64 or both>"

# Example:
# ./scripts/create-linux-packages.sh 1 amd64 # Build DEB package for AMD64
# ./scripts/create-linux-packages.sh 2 arm64 # Build RPM package for ARM64
# ./scripts/create-linux-packages.sh 3 both # Build both DEB and RPM packages for both AMD64 and ARM64

set -e

VERSION=$(cat config/agent.conf | grep -o '"version": "[^"]*"' | cut -d'"' -f4)
PACKAGE_NAME="scanx"
BUILD_DIR="dist/linux-packages"

echo "🐧 Creating Linux Packages (DEB & RPM)"
echo "====================================="
echo "Version: ${VERSION}"
echo ""

# Architecture selection - can be passed as second argument
if [[ -n "$2" ]]; then
    ARCH="$2"
else
    echo "📦 Architecture Options:"
    echo "1. AMD64 (x86_64)"
    echo "2. ARM64 (aarch64)"
    echo "3. Both architectures"
    echo ""
    read -p "Choose architecture [1-3]: " -n 1 -r arch_choice
    echo
    
    case $arch_choice in
        1) ARCH="amd64" ;;
        2) ARCH="arm64" ;;
        3) ARCH="both" ;;
        *) echo "❌ Invalid choice"; exit 1 ;;
    esac
fi

# Package selection - can be passed as first argument or interactive
if [[ -n "$1" ]]; then
    # Convert numeric argument to string if needed
    case "$1" in
        1|deb) package_choice="deb" ;;
        2|rpm) package_choice="rpm" ;;
        3|both) package_choice="both" ;;
        *) echo "❌ Invalid argument: $1. Use 1/deb, 2/rpm, or 3/both"; exit 1 ;;
    esac
    echo "📦 Building package type: $package_choice"
else
    # Interactive package selection
    echo ""
    echo "📦 Package Building Options:"
    echo "1. DEB package (Ubuntu/Debian)"
    echo "2. RPM package (CentOS/RHEL)"
    echo "3. Both packages"
    echo ""
    read -p "Choose option [1-3]: " -n 1 -r package_choice
    echo

    case $package_choice in
        1) package_choice="deb" ;;
        2) package_choice="rpm" ;;
        3) package_choice="both" ;;
        *) echo "❌ Invalid choice"; exit 1 ;;
    esac
fi

# Clean and create build directories
# Only clean if building for "both" architectures, otherwise preserve existing packages
if [[ "$ARCH" == "both" ]]; then
    rm -rf "$BUILD_DIR"
fi
mkdir -p "$BUILD_DIR"

# Check for required tools and install if needed
check_and_install_fpm() {
    if ! command -v fpm &> /dev/null; then
        echo "📦 Installing fpm (Effing Package Management)..."
        if command -v gem &> /dev/null; then
            gem install fpm
            echo "✅ fpm installed successfully"
        else
            echo "❌ Ruby/gem not found. Install with:"
            echo "   macOS: brew install ruby"
            echo "   Ubuntu: sudo apt install ruby ruby-dev"
            echo "   RHEL: sudo yum install ruby ruby-devel"
            return 1
        fi
    fi
}

# Create temporary directory structure for DEB packaging
create_deb_package_structure() {
    local pkg_type=$1
    local arch=$2
    local temp_dir="$BUILD_DIR/${pkg_type}-${arch}/temp-${pkg_type}"
    local binary_name="${PACKAGE_NAME}-linux-${arch}" # to check in dist/builds/
    
    # Check if binary exists
    if [[ ! -f "dist/builds/${binary_name}" ]]; then
        echo "❌ Binary not found: dist/builds/${binary_name}"
        echo "Please run ./scripts/build.sh first to build the binaries."
        return 1
    fi
    
    mkdir -p "$temp_dir/usr/local/bin"
    mkdir -p "$temp_dir/usr/local/lib/scanx"
    mkdir -p "$temp_dir/etc/scanx/config"
    mkdir -p "$temp_dir/var/log/scanx"
    mkdir -p "$temp_dir/var/lib/scanx"
    mkdir -p "$temp_dir/etc/systemd/system"
    
    # Copy files
    cp "dist/builds/${binary_name}" "$temp_dir/usr/local/bin/scanx"
    cp "config/"* "$temp_dir/etc/scanx/config/"
    cp "scripts/services/scanx.service" "$temp_dir/etc/systemd/system/"
    
    # Copy bundled osqueryi binary based on architecture
    OSQUERY_SOURCE=""
    if [[ "$arch" == "amd64" ]]; then
        OSQUERY_SOURCE="dist/builds-osquery/osqueryi-5.20.0.linux_x86_64"
    elif [[ "$arch" == "arm64" ]]; then
        OSQUERY_SOURCE="dist/builds-osquery/osqueryi-5.20.0.linux_arm64"
    fi
    
    if [[ -f "$OSQUERY_SOURCE" ]]; then
        echo "📦 Including bundled osqueryi for ${arch}..." >&2
        cp "$OSQUERY_SOURCE" "$temp_dir/usr/local/lib/scanx/osqueryi"
        chmod +x "$temp_dir/usr/local/lib/scanx/osqueryi"
        echo "✅ Bundled osqueryi included" >&2
    else
        echo "⚠️  Warning: Bundled osqueryi not found at $OSQUERY_SOURCE" >&2
        echo "   Package will rely on system osquery installation" >&2
    fi
    
    # Set permissions
    chmod +x "$temp_dir/usr/local/bin/scanx"
    chmod 755 "$temp_dir/usr/local/lib/scanx"
    chmod 644 "$temp_dir/etc/scanx/config/"*
    chmod 644 "$temp_dir/etc/systemd/system/scanx.service"
    chmod 755 "$temp_dir/var/log/scanx"
    chmod 755 "$temp_dir/var/lib/scanx"
    
    echo "$temp_dir"
}

# Create post-installation script
create_postinstall_script() {
    cat << 'EOF'
#!/bin/bash

set -e

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

if [ "$osquery_found" = false ]; then
    echo "❌ OSQuery not found!"
    echo ""
    echo "The bundled osqueryi was not found and no system osquery installation was detected."
    echo ""
    echo "Please install osquery:"
    echo ""
    if [ -f /etc/debian_version ]; then
        echo "  # Add osquery repository"
        echo "  curl -L https://pkg.osquery.io/deb/GPG | sudo apt-key add -"
        echo "  echo 'deb [arch=amd64] https://pkg.osquery.io/deb deb main' | sudo tee /etc/apt/sources.list.d/osquery.list"
        echo "  sudo apt update && sudo apt install osquery"
    elif [ -f /etc/redhat-release ]; then
        echo "  # Add osquery repository"
        echo "  curl -L https://pkg.osquery.io/rpm/GPG | sudo rpm --import -"
        echo "  sudo yum-config-manager --add-repo https://pkg.osquery.io/rpm/osquery-s3-rpm.repo"
        echo "  sudo yum install osquery"
    else
        echo "  Visit: https://osquery.io/downloads/linux"
    fi
    echo ""
    echo "Or reinstall this package to ensure bundled osqueryi is included."
    echo "Then reconfigure the package: sudo dpkg-reconfigure scanx"
    exit 1
fi

# Configuration setup
config_file="/etc/scanx/config/agent.conf"

echo "📋 scanx Configuration"
echo "========================="

# Get email from user
while true; do
    read -p "📧 Enter employee email (required): " user_email
    if [[ -n "$user_email" && "$user_email" == *"@"* ]]; then
        break
    else
        echo "❌ Please enter a valid email address"
    fi
done

# Get interval from user (default to 2 hours)
echo ""
echo "⏱️  Data collection interval examples:"
echo "   - 5m   (5 minutes)"
echo "   - 10m  (10 minutes)"
echo "   - 1h   (1 hour)"
echo "   - 2h   (2 hours - default)"
read -p "⏱️  Enter collection interval [2h]: " user_interval
if [[ -z "$user_interval" ]]; then
    user_interval="2h"
fi

# Update configuration
sed -i "s/\"user_email\": \"[^\"]*\"/\"user_email\": \"$user_email\"/" "$config_file"
sed -i "s/\"interval\": \"[^\"]*\"/\"interval\": \"$user_interval\"/" "$config_file"

echo ""
echo "✅ Configuration updated:"
echo "   📧 Email: $user_email"
echo "   ⏱️  Interval: $user_interval"

# Create log file
touch /var/log/scanx/scanx-std.log
chmod 644 /var/log/scanx/scanx-std.log

# Ensure osqueryi directory exists and has proper permissions
mkdir -p /usr/local/lib/scanx
if [ -f "/usr/local/lib/scanx/osqueryi" ]; then
    chmod +x /usr/local/lib/scanx/osqueryi
    chmod 755 /usr/local/lib/scanx
fi

# Add /usr/local/lib/scanx to system PATH via /etc/profile.d/ (idempotent - safe to run multiple times)
# This ensures osqueryi can be found even in fresh user contexts
# Using /etc/profile.d/ is the standard Linux way (more modular than /etc/environment)
mkdir -p /etc/profile.d
if [ ! -f "/etc/profile.d/scanx.sh" ] || ! grep -q "/usr/local/lib/scanx" /etc/profile.d/scanx.sh; then
    echo "📝 Adding /usr/local/lib/scanx to system PATH..."
    cat > /etc/profile.d/scanx.sh << 'PROFILE_EOF'
#!/bin/bash
# scanx PATH configuration
# This file is sourced by login shells to add scanx tools to PATH
if [[ ":$PATH:" != *":/usr/local/lib/scanx:"* ]]; then
    export PATH="$PATH:/usr/local/lib/scanx"
fi
PROFILE_EOF
    chmod 644 /etc/profile.d/scanx.sh
    echo "✅ Created /etc/profile.d/scanx.sh for PATH configuration"
    echo "   Note: New login sessions will have /usr/local/lib/scanx in PATH"
    echo "   Current session: export PATH=\"\$PATH:/usr/local/lib/scanx\" (if needed)"
else
    echo "✅ /usr/local/lib/scanx already configured in PATH"
fi

# Enable and start service
systemctl daemon-reload
systemctl enable scanx
systemctl start scanx

echo ""
echo "🎉 scanx installed and started successfully!"
echo ""
echo "📋 File locations:"
echo "   Binary:  /usr/local/bin/scanx"
echo "   Config:  /etc/scanx/config/"
echo "   Logs:    /var/log/scanx/scanx-std.log"
echo "   Data:    /var/lib/scanx/"
echo ""
echo "📋 Service commands:"
echo "   Status:  systemctl status scanx"
echo "   Logs:    journalctl -u scanx -f"
echo "   Stop:    systemctl stop scanx"

exit 0
EOF
}

# Create pre-removal script
create_preremove_script() {
    cat << 'EOF'
#!/bin/bash

set -e

# Stop and disable service
systemctl stop scanx || true
systemctl disable scanx || true

# Remove configuration files
rm -rf /etc/scanx/config/*

# Remove binary
rm -f /usr/local/bin/scanx

# Remove service file
rm -f /etc/systemd/system/scanx.service

# Remove log files
rm -rf /var/log/scanx/*

# Remove data files
rm -rf /var/lib/scanx/*

# Remove /usr/local/lib/scanx from system PATH
if [ -f "/etc/profile.d/scanx.sh" ]; then
    echo "📝 Removing /usr/local/lib/scanx from system PATH..."
    rm -f /etc/profile.d/scanx.sh
    echo "✅ Removed /etc/profile.d/scanx.sh"
fi

exit 0
EOF
}

# Create DEB package using native tools
create_deb_package() {
    local arch=$1
    local deb_arch=$arch
    
    # Convert architecture naming for DEB
    if [[ "$arch" == "amd64" ]]; then
        deb_arch="amd64"
    elif [[ "$arch" == "arm64" ]]; then
        deb_arch="arm64"
    fi
    
    echo "📦 Building DEB package for ${arch}..."
    
    local temp_dir=$(create_deb_package_structure "deb" "$arch")
    if [[ $? -ne 0 ]]; then
        return 1
    fi
    
    local control_dir="$temp_dir/DEBIAN"
    local output_dir="$BUILD_DIR/deb-${arch}"
    
    mkdir -p "$control_dir"
    mkdir -p "$output_dir"
    
    # Create control file
    cat > "$control_dir/control" << EOF
Package: $PACKAGE_NAME
Version: $VERSION
Section: admin
Priority: optional
Architecture: $deb_arch
Depends: systemd
Maintainer: Your Company <admin@company.com>
Description: scanx - System Monitoring and Device Management
 A cross-platform agent for system monitoring and device management.
 Collects system information and sends it to a central management server.
EOF
    
    # Create postinst script
    create_postinstall_script > "$control_dir/postinst"
    chmod +x "$control_dir/postinst"
    
    # Create prerm script
    create_preremove_script > "$control_dir/prerm"
    chmod +x "$control_dir/prerm"
    
    # Build DEB
    # Use --root-owner-group to suppress ownership warnings when building as non-root user
    dpkg-deb --build --root-owner-group "$temp_dir" "$output_dir/${PACKAGE_NAME}_${VERSION}_${deb_arch}.deb"
    
    echo "✅ DEB package created: $output_dir/${PACKAGE_NAME}_${VERSION}_${deb_arch}.deb"
    
    # Clean up
    rm -rf "$temp_dir"
}

# Create RPM package using rpmbuild
create_rpm_package() {
    local arch=$1
    local rpm_arch=$arch
    
    # Convert architecture naming for RPM
    if [[ "$arch" == "amd64" ]]; then
        rpm_arch="x86_64"
    elif [[ "$arch" == "arm64" ]]; then
        rpm_arch="aarch64"
    fi
    
    local binary_name="scanx-linux-${arch}"
    local output_dir="$BUILD_DIR/rpm-${arch}"
    
    # Check if binary exists
    if [[ ! -f "dist/builds/${binary_name}" ]]; then
        echo "❌ Binary not found: dist/builds/${binary_name}"
        echo "Please run ./scripts/build.sh first to build the binaries."
        return 1
    fi
    
    mkdir -p "$output_dir"
    
    echo "📦 Building RPM package for ${arch}..."
    
    if ! command -v rpmbuild &> /dev/null; then
        echo "⚠️  rpmbuild not found. Creating spec file and build script for CentOS/RHEL..."
        echo "   Note: RPM packages must be built on a Linux system with rpmbuild."
        
        # Create spec file for manual building
        cat > "$output_dir/${PACKAGE_NAME}-${arch}.spec" << EOF
Name:           $PACKAGE_NAME
Version:        $VERSION
Release:        1%{?dist}
Summary:        scanx - System Monitoring and Device Management

%global debug_package %{nil}
License:        Proprietary
URL:            https://github.com/your-company/scanx
Source0:        %{name}-%{version}.tar.gz

Requires:       systemd
BuildRequires:  systemd-rpm-macros

%description
A cross-platform agent for system monitoring and device management.
Collects system information and sends it to a central management server.

%prep
# remove existing installation
echo "🔴 Removing existing installation"
systemctl stop scanx || true
systemctl disable scanx || true
rm -rf /etc/scanx/config/*
rm -f /usr/local/bin/scanx
rm -f /etc/systemd/system/scanx.service
rm -rf /var/log/scanx/*
rm -rf /var/lib/scanx/*
systemctl daemon-reload

echo "✅ old installation removed successfully ..."

%setup -q

%build
# No build needed - pre-built binary

%install
rm -rf \$RPM_BUILD_ROOT
mkdir -p \$RPM_BUILD_ROOT/usr/local/bin
mkdir -p \$RPM_BUILD_ROOT/usr/local/lib/scanx
mkdir -p \$RPM_BUILD_ROOT/etc/scanx/config
mkdir -p \$RPM_BUILD_ROOT/var/log/scanx
mkdir -p \$RPM_BUILD_ROOT/var/lib/scanx
mkdir -p \$RPM_BUILD_ROOT/etc/systemd/system

install -m 755 scanx \$RPM_BUILD_ROOT/usr/local/bin/
install -m 755 osqueryi \$RPM_BUILD_ROOT/usr/local/lib/scanx/ 2>/dev/null || true
install -m 644 config/* \$RPM_BUILD_ROOT/etc/scanx/config/
install -m 644 scanx.service \$RPM_BUILD_ROOT/etc/systemd/system/

%files
/usr/local/bin/scanx
/usr/local/lib/scanx/osqueryi
/etc/scanx/config/*
/etc/systemd/system/scanx.service
%dir /var/log/scanx
%dir /var/lib/scanx

%post
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

if [ "$osquery_found" = false ]; then
    echo "❌ OSQuery not found!"
    echo ""
    echo "The bundled osqueryi was not found and no system osquery installation was detected."
    echo ""
    echo "Please install osquery:"
    echo ""
    echo "  # Add osquery repository"
    echo "  curl -L https://pkg.osquery.io/rpm/GPG | sudo rpm --import -"
    echo "  sudo yum-config-manager --add-repo https://pkg.osquery.io/rpm/osquery-s3-rpm.repo"
    echo "  sudo yum install osquery"
    echo ""
    echo "Or reinstall this package to ensure bundled osqueryi is included."
    echo "Then reconfigure: sudo rpm --force -i %{name}-%{version}-%{release}.%{_arch}.rpm"
    exit 1
fi

# Configuration setup
config_file="/etc/scanx/config/agent.conf"

echo "📋 scanx Configuration"
echo "========================="

# 2-Level Fallback for Email: Environment Variable -> Default
echo "📧 Email Configuration (2-level fallback):"
echo "   1. Environment variable SCANX_EMAIL (if set)"
echo "   2. Default: {ip}@{os_name}.com"

# Generate default email based on system info
ip=\$(hostname -I | awk '{print \$1}' | head -1 || echo "unknown")
os_name=\$(grep -o '^[A-Za-z]*' /etc/os-release 2>/dev/null | head -1 || echo "linux")

if [[ -n "\$SCANX_EMAIL" ]]; then
    # Level 1: Environment variable
    user_email="\$SCANX_EMAIL"
    echo "✅ Using environment variable: \$user_email"
else
    # Level 2: Default value
    user_email="\${ip}@\${os_name}.com"
    echo "✅ Using default: \$user_email"
fi

# 2-Level Fallback for Interval: Environment Variable -> Default
echo ""
echo "⏱️  Interval Configuration (2-level fallback):"
echo "   1. Environment variable SCANX_INTERVAL (if set)"
echo "   2. Default: 2h"

if [[ -n "\$SCANX_INTERVAL" ]]; then
    # Level 1: Environment variable
    user_interval="\$SCANX_INTERVAL"
    echo "✅ Using environment variable: \$user_interval"
else
    # Level 2: Default value
    user_interval="2h"
    echo "✅ Using default: \$user_interval"
fi

# Update configuration
sed -i "s/\"user_email\": \"[^\"]*\"/\"user_email\": \"\$user_email\"/" "\$config_file"
sed -i "s/\"interval\": \"[^\"]*\"/\"interval\": \"\$user_interval\"/" "\$config_file"

echo ""
echo "✅ Configuration updated:"
echo "   📧 Email: \$user_email"
echo "   ⏱️  Interval: \$user_interval"

# Create log file
touch /var/log/scanx/scanx-std.log
chmod 644 /var/log/scanx/scanx-std.log

# Ensure osqueryi directory exists and has proper permissions
mkdir -p /usr/local/lib/scanx
if [ -f "/usr/local/lib/scanx/osqueryi" ]; then
    chmod +x /usr/local/lib/scanx/osqueryi
    chmod 755 /usr/local/lib/scanx
fi

# Add /usr/local/lib/scanx to system PATH via /etc/profile.d/ (idempotent - safe to run multiple times)
# This ensures osqueryi can be found even in fresh user contexts
# Using /etc/profile.d/ is the standard Linux way (more modular than /etc/environment)
mkdir -p /etc/profile.d
if [ ! -f "/etc/profile.d/scanx.sh" ] || ! grep -q "/usr/local/lib/scanx" /etc/profile.d/scanx.sh; then
    echo "📝 Adding /usr/local/lib/scanx to system PATH..."
    cat > /etc/profile.d/scanx.sh << 'PROFILE_EOF'
#!/bin/bash
# scanx PATH configuration
# This file is sourced by login shells to add scanx tools to PATH
if [[ ":$PATH:" != *":/usr/local/lib/scanx:"* ]]; then
    export PATH="$PATH:/usr/local/lib/scanx"
fi
PROFILE_EOF
    chmod 644 /etc/profile.d/scanx.sh
    echo "✅ Created /etc/profile.d/scanx.sh for PATH configuration"
    echo "   Note: New login sessions will have /usr/local/lib/scanx in PATH"
    echo "   Current session: export PATH=\"\$PATH:/usr/local/lib/scanx\" (if needed)"
else
    echo "✅ /usr/local/lib/scanx already configured in PATH"
fi

# Enable and start service
%systemd_post scanx.service
systemctl daemon-reload
systemctl enable scanx
systemctl start scanx

echo ""
echo "🎉 scanx installed and started successfully!"
echo ""
echo "📋 File locations:"
echo "   Binary:  /usr/local/bin/scanx"
echo "   Config:  /etc/scanx/config/"
echo "   Logs:    /var/log/scanx/scanx-std.log"
echo "   Data:    /var/lib/scanx/"
echo ""
echo "📋 Service commands:"
echo "   Status:  systemctl status scanx"
echo "   Logs:    journalctl -u scanx -f"
echo "   Stop:    systemctl stop scanx"

%preun
%systemd_preun scanx.service

# Remove /usr/local/lib/scanx from system PATH
if [ -f "/etc/profile.d/scanx.sh" ]; then
    echo "📝 Removing /usr/local/lib/scanx from system PATH..."
    rm -f /etc/profile.d/scanx.sh
    echo "✅ Removed /etc/profile.d/scanx.sh"
fi

%postun
%systemd_postun_with_restart scanx.service

%changelog
* $(date '+%a %b %d %Y') Your Name <admin@company.com> - $VERSION-1
- Initial package release
EOF
        
        # Create build script for CentOS/RHEL systems
        cat > "$output_dir/build-rpm.sh" << 'EOF'
#!/bin/bash

# Build RPM package on CentOS/RHEL system
set -e

echo "🔴 Building RPM Package on CentOS/RHEL"
echo "======================================"

# Check if files exist
if [[ ! -f "scanx" ]] || [[ ! -d "config" ]] || [[ ! -f "scanx.service" ]]; then
    echo "❌ Required files not found. Please ensure you have:"
    echo "   - scanx (binary)"
    echo "   - config/ (directory with agent.conf and queries.yml)"
    echo "   - scanx.service (systemd service file)"
    exit 1
fi

VERSION=$(cat config/agent.conf | grep -o '"version": "[^"]*"' | cut -d'"' -f4)
PACKAGE_NAME="scanx"

# Setup RPM build environment
if command -v rpmdev-setuptree &> /dev/null; then
    rpmdev-setuptree
else
    mkdir -p ~/rpmbuild/{BUILD,RPMS,SOURCES,SPECS,SRPMS}
fi

# Create source directory and tarball
mkdir -p ${PACKAGE_NAME}-${VERSION}
cp scanx ${PACKAGE_NAME}-${VERSION}/
if [[ -f "osqueryi" ]]; then
    cp osqueryi ${PACKAGE_NAME}-${VERSION}/
fi
cp -r config ${PACKAGE_NAME}-${VERSION}/
cp scanx.service ${PACKAGE_NAME}-${VERSION}/

tar -czf ~/rpmbuild/SOURCES/${PACKAGE_NAME}-${VERSION}.tar.gz ${PACKAGE_NAME}-${VERSION}
rm -rf ${PACKAGE_NAME}-${VERSION}

# Copy spec file
cp ${PACKAGE_NAME}.spec ~/rpmbuild/SPECS/

# Build RPM
echo "🔨 Building RPM..."
rpmbuild -ba ~/rpmbuild/SPECS/${PACKAGE_NAME}.spec

# Copy result
find ~/rpmbuild/RPMS -name "*.rpm" -exec cp {} . \;

echo "✅ RPM package built successfully!"
ls -la *.rpm
EOF
        chmod +x "$output_dir/build-rpm.sh"
        
        echo "📝 RPM spec file created: $output_dir/${PACKAGE_NAME}-${arch}.spec"
        echo "📝 Build script created: $output_dir/build-rpm.sh"
        echo ""
        echo "📋 To build RPM on CentOS/RHEL:"
        echo "   1. Copy files to CentOS/RHEL system:"
        echo "      scp -r $output_dir/* user@centos-server:/tmp/"
        echo "      scp dist/builds/scanx-linux-${arch} user@centos-server:/tmp/scanx"
        if [[ "$arch" == "amd64" ]]; then
            echo "      scp dist/builds-osquery/osqueryi-5.20.0.linux_x86_64 user@centos-server:/tmp/osqueryi"
        elif [[ "$arch" == "arm64" ]]; then
            echo "      scp dist/builds-osquery/osqueryi-5.20.0.linux_arm64 user@centos-server:/tmp/osqueryi"
        fi
        echo "      scp -r config user@centos-server:/tmp/"
        echo "      scp scripts/services/scanx.service user@centos-server:/tmp/"
        echo "   2. On CentOS/RHEL system:"
        echo "      cd /tmp && ./build-rpm.sh"
        
    else
        echo "✅ rpmbuild found. Building RPM package locally..."
        
        # Setup RPM build environment
        BUILD_ROOT="/tmp/rpm-build-$$"
        mkdir -p "$BUILD_ROOT"/{BUILD,RPMS,SOURCES,SPECS,SRPMS}
        
        # Create source tarball
        SOURCE_DIR="/tmp/${PACKAGE_NAME}-${VERSION}"
        rm -rf "$SOURCE_DIR"
        mkdir -p "$SOURCE_DIR"
        
        cp "dist/builds/${binary_name}" "$SOURCE_DIR/scanx"
        
        # Copy bundled osqueryi binary based on architecture
        OSQUERY_SOURCE=""
        if [[ "$arch" == "amd64" ]]; then
            OSQUERY_SOURCE="dist/builds-osquery/osqueryi-5.20.0.linux_x86_64"
        elif [[ "$arch" == "arm64" ]]; then
            OSQUERY_SOURCE="dist/builds-osquery/osqueryi-5.20.0.linux_arm64"
        fi
        
        if [[ -f "$OSQUERY_SOURCE" ]]; then
            echo "📦 Including bundled osqueryi for ${arch}..."
            cp "$OSQUERY_SOURCE" "$SOURCE_DIR/osqueryi"
            chmod +x "$SOURCE_DIR/osqueryi"
            echo "✅ Bundled osqueryi included"
        else
            echo "⚠️  Warning: Bundled osqueryi not found at $OSQUERY_SOURCE"
            echo "   Package will rely on system osquery installation"
        fi
        
        cp -r config "$SOURCE_DIR/"
        cp "scripts/services/scanx.service" "$SOURCE_DIR/"
        
        cd /tmp
        tar -czf "$BUILD_ROOT/SOURCES/${PACKAGE_NAME}-${VERSION}.tar.gz" "${PACKAGE_NAME}-${VERSION}"
        rm -rf "$SOURCE_DIR"
        cd - > /dev/null
        
        # Create spec file
        cat > "$BUILD_ROOT/SPECS/${PACKAGE_NAME}.spec" << EOF
Name:           $PACKAGE_NAME
Version:        $VERSION
Release:        1%{?dist}
Summary:        scanx - System Monitoring and Device Management

%global debug_package %{nil}
License:        Proprietary
URL:            https://github.com/your-company/scanx
Source0:        %{name}-%{version}.tar.gz

Requires:       systemd
BuildRequires:  systemd-rpm-macros

%description
A cross-platform agent for system monitoring and device management.
Collects system information and sends it to a central management server.

%prep
%setup -q

%build
# No build needed - pre-built binary

%install
rm -rf \$RPM_BUILD_ROOT
mkdir -p \$RPM_BUILD_ROOT/usr/local/bin
mkdir -p \$RPM_BUILD_ROOT/usr/local/lib/scanx
mkdir -p \$RPM_BUILD_ROOT/etc/scanx/config
mkdir -p \$RPM_BUILD_ROOT/var/log/scanx
mkdir -p \$RPM_BUILD_ROOT/var/lib/scanx
mkdir -p \$RPM_BUILD_ROOT/etc/systemd/system

install -m 755 scanx \$RPM_BUILD_ROOT/usr/local/bin/
install -m 755 osqueryi \$RPM_BUILD_ROOT/usr/local/lib/scanx/ 2>/dev/null || true
install -m 644 config/* \$RPM_BUILD_ROOT/etc/scanx/config/
install -m 644 scanx.service \$RPM_BUILD_ROOT/etc/systemd/system/

%files
/usr/local/bin/scanx
/usr/local/lib/scanx/osqueryi
/etc/scanx/config/*
/etc/systemd/system/scanx.service
%dir /var/log/scanx
%dir /var/lib/scanx

%post
# Configuration setup
config_file="/etc/scanx/config/agent.conf"

echo "📋 scanx Configuration"
echo "========================="

# 2-Level Fallback for Email: Environment Variable -> Default
echo "📧 Email Configuration (2-level fallback):"
echo "   1. Environment variable SCANX_EMAIL (if set)"
echo "   2. Default: {ip}@{os_name}.com"

# Generate default email based on system info
ip=\$(hostname -I | awk '{print \$1}' | head -1 || echo "unknown")
os_name=\$(grep -o '^[A-Za-z]*' /etc/os-release 2>/dev/null | head -1 || echo "linux")

if [[ -n "\$SCANX_EMAIL" ]]; then
    # Level 1: Environment variable
    user_email="\$SCANX_EMAIL"
    echo "✅ Using environment variable: \$user_email"
else
    # Level 2: Default value
    user_email="\${ip}@\${os_name}.com"
    echo "✅ Using default: \$user_email"
fi

# 2-Level Fallback for Interval: Environment Variable -> Default
echo ""
echo "⏱️  Interval Configuration (2-level fallback):"
echo "   1. Environment variable SCANX_INTERVAL (if set)"
echo "   2. Default: 2h"

if [[ -n "\$SCANX_INTERVAL" ]]; then
    # Level 1: Environment variable
    user_interval="\$SCANX_INTERVAL"
    echo "✅ Using environment variable: \$user_interval"
else
    # Level 2: Default value
    user_interval="2h"
    echo "✅ Using default: \$user_interval"
fi

# Update configuration
sed -i "s/\"user_email\": \"[^\"]*\"/\"user_email\": \"\$user_email\"/" "\$config_file"
sed -i "s/\"interval\": \"[^\"]*\"/\"interval\": \"\$user_interval\"/" "\$config_file"

echo ""
echo "✅ Configuration updated:"
echo "   📧 Email: \$user_email"
echo "   ⏱️  Interval: \$user_interval"

# Create log file
touch /var/log/scanx/scanx-std.log
chmod 644 /var/log/scanx/scanx-std.log

# Ensure osqueryi directory exists and has proper permissions
mkdir -p /usr/local/lib/scanx
if [ -f "/usr/local/lib/scanx/osqueryi" ]; then
    chmod +x /usr/local/lib/scanx/osqueryi
    chmod 755 /usr/local/lib/scanx
fi

# Add /usr/local/lib/scanx to system PATH via /etc/profile.d/ (idempotent - safe to run multiple times)
# This ensures osqueryi can be found even in fresh user contexts
# Using /etc/profile.d/ is the standard Linux way (more modular than /etc/environment)
mkdir -p /etc/profile.d
if [ ! -f "/etc/profile.d/scanx.sh" ] || ! grep -q "/usr/local/lib/scanx" /etc/profile.d/scanx.sh; then
    echo "📝 Adding /usr/local/lib/scanx to system PATH..."
    cat > /etc/profile.d/scanx.sh << 'PROFILE_EOF'
#!/bin/bash
# scanx PATH configuration
# This file is sourced by login shells to add scanx tools to PATH
if [[ ":$PATH:" != *":/usr/local/lib/scanx:"* ]]; then
    export PATH="$PATH:/usr/local/lib/scanx"
fi
PROFILE_EOF
    chmod 644 /etc/profile.d/scanx.sh
    echo "✅ Created /etc/profile.d/scanx.sh for PATH configuration"
    echo "   Note: New login sessions will have /usr/local/lib/scanx in PATH"
    echo "   Current session: export PATH=\"\$PATH:/usr/local/lib/scanx\" (if needed)"
else
    echo "✅ /usr/local/lib/scanx already configured in PATH"
fi

# Enable and start service
%systemd_post scanx.service
systemctl daemon-reload
systemctl enable scanx
systemctl start scanx

echo ""
echo "🎉 scanx installed and started successfully!"
echo ""
echo "📋 File locations:"
echo "   Binary:  /usr/local/bin/scanx"
echo "   Config:  /etc/scanx/config/"
echo "   Logs:    /var/log/scanx/scanx-std.log"
echo "   Data:    /var/lib/scanx/"
echo ""
echo "📋 Service commands:"
echo "   Status:  systemctl status scanx"
echo "   Logs:    journalctl -u scanx -f"
echo "   Stop:    systemctl stop scanx"

%preun
%systemd_preun scanx.service

# Remove /usr/local/lib/scanx from system PATH
if [ -f "/etc/profile.d/scanx.sh" ]; then
    echo "📝 Removing /usr/local/lib/scanx from system PATH..."
    rm -f /etc/profile.d/scanx.sh
    echo "✅ Removed /etc/profile.d/scanx.sh"
fi

%postun
%systemd_postun_with_restart scanx.service

%changelog
* $(date '+%a %b %d %Y') Your Name <admin@company.com> - $VERSION-1
- Initial package release
EOF
        
        # Build the RPM
        rpmbuild --define "_topdir $BUILD_ROOT" -ba "$BUILD_ROOT/SPECS/${PACKAGE_NAME}.spec"
        
        # Copy the built RPM
        find "$BUILD_ROOT/RPMS" -name "*.rpm" -exec cp {} "$output_dir/" \;
        
        # Clean up
        rm -rf "$BUILD_ROOT"
        
        echo "✅ RPM package built successfully!"
    fi
}

# Function to build packages for a specific architecture
build_packages_for_arch() {
    local arch=$1
    
    echo ""
    echo "🏗️  Building packages for ${arch}..."
    echo "=================================="
    
    case $package_choice in
        deb)
            echo "📦 Building DEB package for ${arch}..."
            if command -v dpkg-deb &> /dev/null; then
                create_deb_package "$arch"
            else
                echo "❌ dpkg-deb not found. Cannot build DEB package."
                echo "   Install with: brew install dpkg"
                return 1
            fi
            ;;
        rpm)
            echo "📦 Building RPM package for ${arch}..."
            create_rpm_package "$arch"
            ;;
        both)
            echo "📦 Building both DEB and RPM packages for ${arch}..."
            # Build DEB
            if command -v dpkg-deb &> /dev/null; then
                create_deb_package "$arch"
            else
                echo "⚠️  dpkg-deb not found. Skipping DEB package."
            fi
            # Build RPM
            create_rpm_package "$arch"
            ;;
        *)
            echo "❌ Invalid choice. Please run the script again and select deb, rpm, or both."
            return 1
            ;;
    esac
}

# Build packages based on architecture choice
if [[ "$ARCH" == "both" ]]; then
    build_packages_for_arch "amd64"
    build_packages_for_arch "arm64"
else
    build_packages_for_arch "$ARCH"
fi

echo ""
echo "🎉 Linux packages ready!"
echo "📁 Location: $BUILD_DIR/"
echo ""
echo "📦 Created packages:"
find "$BUILD_DIR" -name "*.deb" -o -name "*.rpm" -o -name "*.spec" | while read pkg; do
    if [[ -f "$pkg" ]]; then
        echo "   $(basename "$pkg")"
    fi
done

echo ""
echo "📋 Installation commands:"
echo "   DEB (amd64): sudo dpkg -i $BUILD_DIR/deb-amd64/scanx_${VERSION}_amd64.deb"
echo "   DEB (arm64): sudo dpkg -i $BUILD_DIR/deb-arm64/scanx_${VERSION}_arm64.deb"
echo "   RPM (x86_64): sudo rpm -ivh $BUILD_DIR/rpm-amd64/scanx-${VERSION}-1.x86_64.rpm"
echo "   RPM (aarch64): sudo rpm -ivh $BUILD_DIR/rpm-arm64/scanx-${VERSION}-1.aarch64.rpm"
echo ""
echo "💡 Usage:"
echo "   Build for specific arch: ./scripts/create-linux-packages.sh <1=deb, 2=rpm, 3=both> <amd64 or arm64 or both>"
echo "   Build for both archs: ./scripts/create-linux-packages.sh <1=deb, 2=rpm, 3=both> <amd64 or arm64 or both>"

# Example:
# ./scripts/create-linux-packages.sh 1 amd64 # Build DEB package for AMD64
# ./scripts/create-linux-packages.sh 2 arm64 # Build RPM package for ARM64
# ./scripts/create-linux-packages.sh 3 both # Build both DEB and RPM packages for both AMD64 and ARM64