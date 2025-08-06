package main

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
)

// Platform-specific service management functions

// macOS service management using launchd
func installMacOSService() error {
	plistPath := "/Library/LaunchDaemons/com.company.mdm-agent.plist"

	// Get current executable path
	execPath, err := os.Executable()
	if err != nil {
		return fmt.Errorf("failed to get executable path: %w", err)
	}

	// Create plist content
	plistContent := fmt.Sprintf(`<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.company.mdm-agent</string>
    <key>ProgramArguments</key>
    <array>
        <string>%s</string>
        <string>-daemon</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <dict>
        <key>SuccessfulExit</key>
        <false/>
        <key>Crashed</key>
        <true/>
    </dict>
    <key>StandardOutPath</key>
    <string>/var/log/mdm-agent.log</string>
    <key>StandardErrorPath</key>
    <string>/var/log/mdm-agent.error.log</string>
</dict>
</plist>`, execPath)

	// Write plist file
	if err := os.WriteFile(plistPath, []byte(plistContent), 0644); err != nil {
		return fmt.Errorf("failed to write plist file: %w", err)
	}

	// Load the service
	cmd := exec.Command("launchctl", "load", plistPath)
	if err := cmd.Run(); err != nil {
		return fmt.Errorf("failed to load service: %w", err)
	}

	fmt.Printf("✅ Service installed and started: %s\n", plistPath)
	return nil
}

func uninstallMacOSService() error {
	plistPath := "/Library/LaunchDaemons/com.company.mdm-agent.plist"

	// Unload the service
	cmd := exec.Command("launchctl", "unload", plistPath)
	cmd.Run() // Ignore errors if service isn't loaded

	// Remove plist file
	if err := os.Remove(plistPath); err != nil && !os.IsNotExist(err) {
		return fmt.Errorf("failed to remove plist file: %w", err)
	}

	fmt.Println("✅ Service uninstalled")
	return nil
}

func startMacOSService() error {
	plistPath := "/Library/LaunchDaemons/com.company.mdm-agent.plist"
	cmd := exec.Command("launchctl", "load", plistPath)
	if err := cmd.Run(); err != nil {
		return fmt.Errorf("failed to start service: %w", err)
	}
	fmt.Println("✅ Service started")
	return nil
}

func stopMacOSService() error {
	plistPath := "/Library/LaunchDaemons/com.company.mdm-agent.plist"
	cmd := exec.Command("launchctl", "unload", plistPath)
	if err := cmd.Run(); err != nil {
		return fmt.Errorf("failed to stop service: %w", err)
	}
	fmt.Println("✅ Service stopped")
	return nil
}

func statusMacOSService() error {
	cmd := exec.Command("launchctl", "list", "com.company.mdm-agent")
	output, err := cmd.Output()
	if err != nil {
		fmt.Println("❌ Service not running")
		return nil
	}
	fmt.Printf("✅ Service status:\n%s", string(output))
	return nil
}

// Linux service management using systemd
func installLinuxService() error {
	serviceFile := "/etc/systemd/system/mdm-agent.service"

	// Get current executable path
	execPath, err := os.Executable()
	if err != nil {
		return fmt.Errorf("failed to get executable path: %w", err)
	}

	// Get working directory (where config files are)
	workDir := filepath.Dir(execPath)

	// Create service content
	serviceContent := fmt.Sprintf(`[Unit]
Description=MDM Agent - System Monitoring and Device Management
After=network.target
Wants=network.target

[Service]
Type=simple
User=root
Group=root
ExecStart=%s -daemon
WorkingDirectory=%s
Restart=always
RestartSec=10
KillMode=process
TimeoutStopSec=30

[Install]
WantedBy=multi-user.target`, execPath, workDir)

	// Write service file
	if err := os.WriteFile(serviceFile, []byte(serviceContent), 0644); err != nil {
		return fmt.Errorf("failed to write service file: %w", err)
	}

	// Reload systemd
	cmd := exec.Command("systemctl", "daemon-reload")
	if err := cmd.Run(); err != nil {
		return fmt.Errorf("failed to reload systemd: %w", err)
	}

	// Enable and start service
	cmd = exec.Command("systemctl", "enable", "mdm-agent")
	if err := cmd.Run(); err != nil {
		return fmt.Errorf("failed to enable service: %w", err)
	}

	cmd = exec.Command("systemctl", "start", "mdm-agent")
	if err := cmd.Run(); err != nil {
		return fmt.Errorf("failed to start service: %w", err)
	}

	fmt.Printf("✅ Service installed and started: %s\n", serviceFile)
	return nil
}

func uninstallLinuxService() error {
	serviceFile := "/etc/systemd/system/mdm-agent.service"

	// Stop and disable service
	exec.Command("systemctl", "stop", "mdm-agent").Run()
	exec.Command("systemctl", "disable", "mdm-agent").Run()

	// Remove service file
	if err := os.Remove(serviceFile); err != nil && !os.IsNotExist(err) {
		return fmt.Errorf("failed to remove service file: %w", err)
	}

	// Reload systemd
	exec.Command("systemctl", "daemon-reload").Run()

	fmt.Println("✅ Service uninstalled")
	return nil
}

func startLinuxService() error {
	cmd := exec.Command("systemctl", "start", "mdm-agent")
	if err := cmd.Run(); err != nil {
		return fmt.Errorf("failed to start service: %w", err)
	}
	fmt.Println("✅ Service started")
	return nil
}

func stopLinuxService() error {
	cmd := exec.Command("systemctl", "stop", "mdm-agent")
	if err := cmd.Run(); err != nil {
		return fmt.Errorf("failed to stop service: %w", err)
	}
	fmt.Println("✅ Service stopped")
	return nil
}

func statusLinuxService() error {
	cmd := exec.Command("systemctl", "status", "mdm-agent")
	output, err := cmd.Output()
	if err != nil {
		fmt.Printf("❌ Service status check failed: %v\n", err)
		return nil
	}
	fmt.Printf("✅ Service status:\n%s", string(output))
	return nil
}

// Windows service management using sc.exe
func installWindowsService() error {
	serviceName := "MDMAgent"

	// Get current executable path
	execPath, err := os.Executable()
	if err != nil {
		return fmt.Errorf("failed to get executable path: %w", err)
	}

	// Create service using sc.exe
	binPath := fmt.Sprintf(`"%s" -daemon`, execPath)
	cmd := exec.Command("sc.exe", "create", serviceName, "binPath=", binPath, "start=", "auto", "DisplayName=", "MDM Agent")
	if err := cmd.Run(); err != nil {
		return fmt.Errorf("failed to create service: %w", err)
	}

	// Set service description
	cmd = exec.Command("sc.exe", "description", serviceName, "MDM Agent - System Monitoring and Device Management Service")
	cmd.Run() // Ignore errors

	// Configure service recovery
	cmd = exec.Command("sc.exe", "failure", serviceName, "reset=", "86400", "actions=", "restart/10000/restart/20000/restart/30000")
	cmd.Run() // Ignore errors

	// Start service
	cmd = exec.Command("sc.exe", "start", serviceName)
	if err := cmd.Run(); err != nil {
		return fmt.Errorf("failed to start service: %w", err)
	}

	fmt.Printf("✅ Service installed and started: %s\n", serviceName)
	return nil
}

func uninstallWindowsService() error {
	serviceName := "MDMAgent"

	// Stop service
	exec.Command("sc.exe", "stop", serviceName).Run()

	// Delete service
	cmd := exec.Command("sc.exe", "delete", serviceName)
	if err := cmd.Run(); err != nil {
		return fmt.Errorf("failed to delete service: %w", err)
	}

	fmt.Println("✅ Service uninstalled")
	return nil
}

func startWindowsService() error {
	serviceName := "MDMAgent"
	cmd := exec.Command("sc.exe", "start", serviceName)
	if err := cmd.Run(); err != nil {
		return fmt.Errorf("failed to start service: %w", err)
	}
	fmt.Println("✅ Service started")
	return nil
}

func stopWindowsService() error {
	serviceName := "MDMAgent"
	cmd := exec.Command("sc.exe", "stop", serviceName)
	if err := cmd.Run(); err != nil {
		return fmt.Errorf("failed to stop service: %w", err)
	}
	fmt.Println("✅ Service stopped")
	return nil
}

func statusWindowsService() error {
	serviceName := "MDMAgent"
	cmd := exec.Command("sc.exe", "query", serviceName)
	output, err := cmd.Output()
	if err != nil {
		fmt.Printf("❌ Service not found or query failed: %v\n", err)
		return nil
	}
	fmt.Printf("✅ Service status:\n%s", string(output))
	return nil
}
