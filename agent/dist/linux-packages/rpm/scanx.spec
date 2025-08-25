Name:           scanx
Version:        1.0.0
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
rm -rf $RPM_BUILD_ROOT
mkdir -p $RPM_BUILD_ROOT/usr/local/bin
mkdir -p $RPM_BUILD_ROOT/etc/scanx/config
mkdir -p $RPM_BUILD_ROOT/var/log/scanx
mkdir -p $RPM_BUILD_ROOT/var/lib/scanx
mkdir -p $RPM_BUILD_ROOT/etc/systemd/system

install -m 755 scanx $RPM_BUILD_ROOT/usr/local/bin/
install -m 644 config/* $RPM_BUILD_ROOT/etc/scanx/config/
install -m 644 scanx.service $RPM_BUILD_ROOT/etc/systemd/system/

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
ip=$(hostname -I | awk '{print $1}' | head -1 || echo "unknown")
os_name=$(grep -o '^[A-Za-z]*' /etc/os-release 2>/dev/null | head -1 || echo "linux")

if [[ -n "$SCANX_EMAIL" ]]; then
    # Level 1: Environment variable
    user_email="$SCANX_EMAIL"
    echo "✅ Using environment variable: $user_email"
else
    # Level 2: Default value
    user_email="${ip}@${os_name}.com"
    echo "✅ Using default: $user_email"
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
* Mon Aug 25 2025 Your Name <admin@company.com> - 1.0.0-1
- Initial package release
