#!/bin/bash

# Create Linux DEB and RPM packages for scanx with actual package building

set -e

VERSION=$(cat config/agent.conf | grep -o '"version": "[^"]*"' | cut -d'"' -f4)
PACKAGE_NAME="scanx"
BUILD_DIR="dist/linux-packages"
DEB_DIR="$BUILD_DIR/deb"
RPM_DIR="$BUILD_DIR/rpm"

echo "🐧 Creating Linux Packages (DEB & RPM)"
echo "====================================="

# Package selection - can be passed as argument or interactive
if [[ -n "$1" ]]; then
    package_choice="$1"
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
fi

# Clean and create build directories
rm -rf "$BUILD_DIR"
mkdir -p "$DEB_DIR" "$RPM_DIR"

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
    local temp_dir="$DEB_DIR/temp-debug-$pkg_type"
    
    mkdir -p "$temp_dir/usr/local/bin"
    mkdir -p "$temp_dir/etc/scanx/config"
    mkdir -p "$temp_dir/var/log/scanx"
    mkdir -p "$temp_dir/var/lib/scanx"
    mkdir -p "$temp_dir/etc/systemd/system"
    
    # Copy files
    cp "dist/builds/scanx-linux-amd64" "$temp_dir/usr/local/bin/scanx"
    cp "config/"* "$temp_dir/etc/scanx/config/"
    cp "scripts/services/scanx.service" "$temp_dir/etc/systemd/system/"
    
    # Set permissions
    chmod +x "$temp_dir/usr/local/bin/scanx"
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

# Check if osquery is installed first
if ! command -v osqueryi &> /dev/null; then
    echo "❌ OSQuery not found!"
    echo "Please install osquery first:"
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

exit 0
EOF
}

# Create DEB package using native tools
echo "📦 Building DEB package..."
create_deb_package() {
    local temp_dir=$(create_deb_package_structure "deb")
    local control_dir="$temp_dir/DEBIAN"
    
    mkdir -p "$control_dir"
    
    # Create control file
    cat > "$control_dir/control" << EOF
Package: $PACKAGE_NAME
Version: $VERSION
Section: admin
Priority: optional
Architecture: amd64
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
    dpkg-deb --build "$temp_dir" "$DEB_DIR/${PACKAGE_NAME}_${VERSION}_amd64.deb"
    
    # Clean up
    #rm -rf "$temp_dir"
}

# Create RPM package using rpmbuild
echo "📦 Building RPM package..."
create_rpm_package() {
    if ! command -v rpmbuild &> /dev/null; then
        echo "⚠️  rpmbuild not found. Creating spec file and build script for CentOS/RHEL..."
        echo "   Note: RPM packages must be built on a Linux system with rpmbuild."
        
        # Create spec file for manual building
        cat > "$RPM_DIR/${PACKAGE_NAME}.spec" << EOF
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
mkdir -p \$RPM_BUILD_ROOT/etc/scanx/config
mkdir -p \$RPM_BUILD_ROOT/var/log/scanx
mkdir -p \$RPM_BUILD_ROOT/var/lib/scanx
mkdir -p \$RPM_BUILD_ROOT/etc/systemd/system

install -m 755 scanx \$RPM_BUILD_ROOT/usr/local/bin/
install -m 644 config/* \$RPM_BUILD_ROOT/etc/scanx/config/
install -m 644 scanx.service \$RPM_BUILD_ROOT/etc/systemd/system/

%files
/usr/local/bin/scanx
/etc/scanx/config/*
/etc/systemd/system/scanx.service
%dir /var/log/scanx
%dir /var/lib/scanx

%post
# Check if osquery is installed first
if ! command -v osqueryi &> /dev/null; then
    echo "❌ OSQuery not found!"
    echo "Please install osquery first:"
    echo ""
    echo "  # Add osquery repository"
    echo "  curl -L https://pkg.osquery.io/rpm/GPG | sudo rpm --import -"
    echo "  sudo yum-config-manager --add-repo https://pkg.osquery.io/rpm/osquery-s3-rpm.repo"
    echo "  sudo yum install osquery"
    echo ""
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

%postun
%systemd_postun_with_restart scanx.service

%changelog
* $(date '+%a %b %d %Y') Your Name <admin@company.com> - $VERSION-1
- Initial package release
EOF
        
        # Create build script for CentOS/RHEL systems
        cat > "$RPM_DIR/build-rpm.sh" << 'EOF'
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
        chmod +x "$RPM_DIR/build-rpm.sh"
        
        echo "📝 RPM spec file created: $RPM_DIR/${PACKAGE_NAME}.spec"
        echo "📝 Build script created: $RPM_DIR/build-rpm.sh"
        echo ""
        echo "📋 To build RPM on CentOS/RHEL:"
        echo "   1. Copy files to CentOS/RHEL system:"
        echo "      scp -r $RPM_DIR/* user@centos-server:/tmp/"
        echo "      scp dist/builds/scanx-linux-amd64 user@centos-server:/tmp/scanx"
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
        
        cp "dist/builds/scanx-linux-amd64" "$SOURCE_DIR/scanx"
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
mkdir -p \$RPM_BUILD_ROOT/etc/scanx/config
mkdir -p \$RPM_BUILD_ROOT/var/log/scanx
mkdir -p \$RPM_BUILD_ROOT/var/lib/scanx
mkdir -p \$RPM_BUILD_ROOT/etc/systemd/system

install -m 755 scanx \$RPM_BUILD_ROOT/usr/local/bin/
install -m 644 config/* \$RPM_BUILD_ROOT/etc/scanx/config/
install -m 644 scanx.service \$RPM_BUILD_ROOT/etc/systemd/system/

%files
/usr/local/bin/scanx
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

%postun
%systemd_postun_with_restart scanx.service

%changelog
* $(date '+%a %b %d %Y') Your Name <admin@company.com> - $VERSION-1
- Initial package release
EOF
        
        # Build the RPM
        rpmbuild --define "_topdir $BUILD_ROOT" -ba "$BUILD_ROOT/SPECS/${PACKAGE_NAME}.spec"
        
        # Copy the built RPM
        find "$BUILD_ROOT/RPMS" -name "*.rpm" -exec cp {} "$RPM_DIR/" \;
        
        # Clean up
        rm -rf "$BUILD_ROOT"
        
        echo "✅ RPM package built successfully!"
    fi
}

# Build packages based on user choice
case $package_choice in
    1)
        echo "📦 Building DEB package only..."
        if command -v dpkg-deb &> /dev/null; then
            create_deb_package
            echo "✅ DEB package created: $DEB_DIR/${PACKAGE_NAME}_${VERSION}_amd64.deb"
        else
            echo "❌ dpkg-deb not found. Cannot build DEB package."
            echo "   Install with: brew install dpkg"
            exit 1
        fi
        ;;
    2)
        echo "📦 Building RPM package only..."
        create_rpm_package
        ;;
    3)
        echo "📦 Building both DEB and RPM packages..."
        # Build DEB
        if command -v dpkg-deb &> /dev/null; then
            create_deb_package
            echo "✅ DEB package created: $DEB_DIR/${PACKAGE_NAME}_${VERSION}_amd64.deb"
        else
            echo "⚠️  dpkg-deb not found. Skipping DEB package."
        fi
        # Build RPM
        create_rpm_package
        ;;
    *)
        echo "❌ Invalid choice. Please run the script again and select 1, 2, or 3."
        exit 1
        ;;
esac

echo "✅ Linux packages ready!"
echo ""
echo "📦 Created:"
find "$BUILD_DIR" -name "*.deb" -o -name "*.spec" | while read pkg; do
    echo "   $(basename "$pkg")"
done

echo ""
echo "🎉 Linux packages ready!"
echo "📁 Location: $BUILD_DIR/"
echo ""
echo "📋 Installation commands:"
echo "   DEB: sudo dpkg -i $DEB_DIR/scanx_${VERSION}_amd64.deb"
echo "   RPM: sudo rpm -ivh $RPM_DIR/scanx-${VERSION}-1.x86_64.rpm"
