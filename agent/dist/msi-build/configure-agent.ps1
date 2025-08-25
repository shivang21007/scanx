param(
    [string]$Email,
    [string]$Interval = "10m"
)

# Configuration form
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

$form = New-Object System.Windows.Forms.Form
$form.Text = "scanx Configuration"
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
        $configFile = "C:\Program Files\scanx\config\agent.conf"
        $config = Get-Content $configFile -Raw
        $config = $config -replace '"user_email": "[^"]*"', "`"user_email`": `"$($emailTextBox.Text)`""
        $config = $config -replace '"interval": "[^"]*"', "`"interval`": `"$($intervalComboBox.SelectedItem)`""
        $config | Set-Content $configFile
        
        [System.Windows.Forms.MessageBox]::Show("Configuration saved successfully!", "scanx", "OK", "Information")
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
