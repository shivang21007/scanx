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
