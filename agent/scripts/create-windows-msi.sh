#!/bin/bash

# Create Windows MSI Installer for MDM Agent
# Requires: WiX Toolset or wine + WiX on macOS/Linux

set -e

VERSION=$(cat config/agent.conf | grep -o '"version": "[^"]*"' | cut -d'"' -f4)
MSI_NAME="MDMAgent-${VERSION}"
BUILD_DIR="dist/msi-build"
WXS_FILE="$BUILD_DIR/mdmagent.wxs"

echo "🪟 Creating Windows MSI Installer"
echo "================================"

# Check if we can build MSI (WiX Toolset)
if ! command -v candle &> /dev/null && ! command -v wine &> /dev/null; then
    echo "❌ WiX Toolset not found. Options:"
    echo "1. Install WiX Toolset on Windows"
    echo "2. Install wine + WiX on macOS/Linux"
    echo "3. Use Docker with Windows container"
    echo ""
    echo "For now, creating WiX source files for manual compilation..."
fi

# Clean and create build directory
rm -rf "$BUILD_DIR"
mkdir -p "$BUILD_DIR"

# Create WiX source file
echo "📝 Creating WiX source file..."
cat > "$WXS_FILE" << EOF
<?xml version="1.0" encoding="UTF-8"?>
<Wix xmlns="http://schemas.microsoft.com/wix/2006/wi">
  <Product Id="*" 
           Name="MDM Agent" 
           Language="1033" 
           Version="$VERSION" 
           Manufacturer="Your Company" 
           UpgradeCode="12345678-1234-1234-1234-123456789012">
    
    <Package InstallerVersion="200" 
             Compressed="yes" 
             InstallScope="perMachine"
             Description="MDM Agent - System Monitoring and Device Management" />

    <MajorUpgrade DowngradeErrorMessage="A newer version of [ProductName] is already installed." />
    <MediaTemplate EmbedCab="yes" />

    <!-- Features -->
    <Feature Id="ProductFeature" Title="MDM Agent" Level="1">
      <ComponentGroupRef Id="ProductComponents" />
      <ComponentRef Id="ServiceComponent" />
    </Feature>

    <!-- Directory Structure -->
    <Directory Id="TARGETDIR" Name="SourceDir">
      <Directory Id="ProgramFilesFolder">
        <Directory Id="INSTALLFOLDER" Name="MDMAgent">
          <Directory Id="ConfigFolder" Name="config" />
          <Directory Id="LogsFolder" Name="logs" />
        </Directory>
      </Directory>
      <Directory Id="CommonAppDataFolder">
        <Directory Id="CompanyDataFolder" Name="MDMAgent" />
      </Directory>
    </Directory>

    <!-- Components -->
    <ComponentGroup Id="ProductComponents" Directory="INSTALLFOLDER">
      <Component Id="MainExecutable" Guid="11111111-1111-1111-1111-111111111111">
        <File Id="mdm_agent.exe" Source="dist/builds/mdmagent-windows-amd64.exe" KeyPath="yes" />
      </Component>
      
      <Component Id="ConfigFiles" Guid="22222222-2222-2222-2222-222222222222" Directory="ConfigFolder">
        <File Id="agent.conf" Source="config/agent.conf" />
        <File Id="queries.yml" Source="config/queries.yml" />
      </Component>
    </ComponentGroup>

    <!-- Service Component -->
    <Component Id="ServiceComponent" Directory="INSTALLFOLDER" Guid="33333333-3333-3333-3333-333333333333">
      <ServiceInstall Id="MDMAgentService"
                      Type="ownProcess"
                      Name="MDMAgent"
                      DisplayName="MDM Agent"
                      Description="MDM Agent - System Monitoring and Device Management"
                      Start="auto"
                      Account="LocalSystem"
                      ErrorControl="ignore"
                      Interactive="no"
                      Arguments="-daemon">
        <ServiceDependency Id="Tcpip" />
      </ServiceInstall>
      
      <ServiceControl Id="StartService" 
                      Start="install" 
                      Stop="both" 
                      Remove="uninstall" 
                      Name="MDMAgent" 
                      Wait="yes" />
    </Component>

    <!-- UI -->
    <UI>
      <UIRef Id="WixUI_Minimal" />
      <Publish Dialog="ExitDialog" Control="Finish" Event="DoAction" Value="LaunchConfigDialog">WIXUI_EXITDIALOGOPTIONALTEXT</Publish>
    </UI>

    <!-- Custom Actions for Configuration -->
    <CustomAction Id="LaunchConfigDialog" 
                  BinaryKey="WixCA" 
                  DllEntry="CAQuietExec" 
                  Execute="immediate" 
                  Return="ignore" />

    <!-- Properties -->
    <Property Id="WIXUI_EXITDIALOGOPTIONALTEXT" Value="Configuration setup will launch after installation." />
    <Property Id="USER_EMAIL" />
    <Property Id="COLLECTION_INTERVAL" Value="2h" />

  </Product>
</Wix>
EOF

# Create configuration dialog WiX file
cat > "$BUILD_DIR/config-dialog.wxs" << 'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<Wix xmlns="http://schemas.microsoft.com/wix/2006/wi">
  <Fragment>
    <UI>
      <Dialog Id="ConfigDialog" Width="370" Height="270" Title="MDM Agent Configuration">
        <Control Id="EmailLabel" Type="Text" X="20" Y="60" Width="100" Height="17" Text="Email Address:" />
        <Control Id="EmailEdit" Type="Edit" X="20" Y="80" Width="200" Height="17" Property="USER_EMAIL" />
        
        <Control Id="IntervalLabel" Type="Text" X="20" Y="120" Width="100" Height="17" Text="Collection Interval:" />
        <Control Id="IntervalCombo" Type="ComboBox" X="20" Y="140" Width="100" Height="17" Property="COLLECTION_INTERVAL">
          <ComboBox Property="COLLECTION_INTERVAL">
            <ListItem Text="5m" Value="5m" />
            <ListItem Text="10m" Value="10m" />
            <ListItem Text="15m" Value="15m" />
            <ListItem Text="30m" Value="30m" />
            <ListItem Text="1h" Value="1h" />
            <ListItem Text="2h" Value="2h" />
          </ComboBox>
        </Control>

        <Control Id="Next" Type="PushButton" X="236" Y="243" Width="56" Height="17" Default="yes" Text="Next" />
        <Control Id="Cancel" Type="PushButton" X="304" Y="243" Width="56" Height="17" Cancel="yes" Text="Cancel" />
      </Dialog>
    </UI>
  </Fragment>
</Wix>
EOF

# Create PowerShell configuration script
cat > "$BUILD_DIR/configure-agent.ps1" << 'EOF'
param(
    [string]$Email,
    [string]$Interval = "10m"
)

# Configuration form
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

$form = New-Object System.Windows.Forms.Form
$form.Text = "MDM Agent Configuration"
$form.Size = New-Object System.Drawing.Size(400, 250)
$form.StartPosition = "CenterScreen"

$emailLabel = New-Object System.Windows.Forms.Label
$emailLabel.Text = "Employee Email:"
$emailLabel.Location = New-Object System.Drawing.Point(20, 30)
$emailLabel.Size = New-Object System.Drawing.Size(150, 20)
$form.Controls.Add($emailLabel)

$emailTextBox = New-Object System.Windows.Forms.TextBox
$emailTextBox.Location = New-Object System.Drawing.Point(20, 55)
$emailTextBox.Size = New-Object System.Drawing.Size(340, 20)
$form.Controls.Add($emailTextBox)

$intervalLabel = New-Object System.Windows.Forms.Label
$intervalLabel.Text = "Collection Interval:"
$intervalLabel.Location = New-Object System.Drawing.Point(20, 90)
$intervalLabel.Size = New-Object System.Drawing.Size(150, 20)
$form.Controls.Add($intervalLabel)

$intervalComboBox = New-Object System.Windows.Forms.ComboBox
$intervalComboBox.Location = New-Object System.Drawing.Point(20, 115)
$intervalComboBox.Size = New-Object System.Drawing.Size(150, 20)
$intervalComboBox.Items.AddRange(@("5m", "10m", "15m", "30m", "1h", "2h"))
$intervalComboBox.SelectedItem = "10m"
$form.Controls.Add($intervalComboBox)

$okButton = New-Object System.Windows.Forms.Button
$okButton.Text = "OK"
$okButton.Location = New-Object System.Drawing.Point(200, 160)
$okButton.Size = New-Object System.Drawing.Size(75, 25)
$okButton.Add_Click({
    if ($emailTextBox.Text -match "@") {
        $configFile = "C:\Program Files\MDMAgent\config\agent.conf"
        $config = Get-Content $configFile -Raw
        $config = $config -replace '"user_email": "[^"]*"', "`"user_email`": `"$($emailTextBox.Text)`""
        $config = $config -replace '"interval": "[^"]*"', "`"interval`": `"$($intervalComboBox.SelectedItem)`""
        $config | Set-Content $configFile
        
        [System.Windows.Forms.MessageBox]::Show("Configuration saved successfully!", "MDM Agent", "OK", "Information")
        $form.Close()
    } else {
        [System.Windows.Forms.MessageBox]::Show("Please enter a valid email address.", "Error", "OK", "Error")
    }
})
$form.Controls.Add($okButton)

$cancelButton = New-Object System.Windows.Forms.Button
$cancelButton.Text = "Cancel"
$cancelButton.Location = New-Object System.Drawing.Point(285, 160)
$cancelButton.Size = New-Object System.Drawing.Size(75, 25)
$cancelButton.Add_Click({ $form.Close() })
$form.Controls.Add($cancelButton)

$form.ShowDialog()
EOF

# Create build script
cat > "$BUILD_DIR/build-msi.bat" << 'EOF'
@echo off
echo Building MDM Agent MSI...

REM Compile WiX sources
candle mdmagent.wxs config-dialog.wxs
if %ERRORLEVEL% neq 0 goto error

REM Link to create MSI
light -ext WixUIExtension mdmagent.wixobj config-dialog.wixobj -o MDMAgent.msi
if %ERRORLEVEL% neq 0 goto error

echo MSI created successfully: MDMAgent.msi
goto end

:error
echo Build failed!
pause

:end
EOF

echo "✅ WiX source files created in $BUILD_DIR/"
echo ""
echo "📋 To build MSI on Windows:"
echo "1. Install WiX Toolset"
echo "2. Copy $BUILD_DIR/ to Windows machine"
echo "3. Run: cd $BUILD_DIR && build-msi.bat"
echo ""
echo "📋 Files created:"
echo "   - mdmagent.wxs (main installer definition)"
echo "   - config-dialog.wxs (configuration UI)"
echo "   - configure-agent.ps1 (PowerShell config script)"
echo "   - build-msi.bat (build script)"

echo ""
echo "🎉 Windows MSI package definition ready!"
