package updater

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"scanx/internal/config"
	"scanx/internal/utils"
	"strings"
	"time"
)

type UpdateInfo struct {
	Description   string                 `json:"description"`
	Details       UpdateDetails          `json:"details"`
	RequestedHost map[string]interface{} `json:"requested_host"`
	Timestamp     string                 `json:"timestamp"`
}

type UpdateDetails struct {
	Scanx    BinaryUpdate `json:"scanx"`
	Osqueryi BinaryUpdate `json:"osqueryi"`
}

type BinaryUpdate struct {
	Version      string `json:"version"`
	DownloadURL  string `json:"download_url"`
	ChecksumURL  string `json:"checksum_url"`
	Mandatory    bool   `json:"mandatory"`
	ReleaseNotes string `json:"release_notes"`
}

type ChecksumFile struct {
	Version   string            `json:"version"`
	Algorithm string            `json:"algorithm"`
	Checksums map[string]string `json:"checksums"`
}

type Updater struct {
	config                 *config.Config
	httpClient             *http.Client
	baseURL                string
	currentScanxVersion    string
	currentOsqueryiVersion string
}

func NewUpdater(cfg *config.Config) (*Updater, error) {
	return &Updater{
		config:                 cfg,
		httpClient:             &http.Client{Timeout: 60 * time.Second},
		baseURL:                cfg.GetBackendURL(),
		currentScanxVersion:    cfg.Agent.ScanxVersion,
		currentOsqueryiVersion: cfg.Agent.OsqueryiVersion,
	}, nil
}

// CheckForUpdates checks if a new version is available
func (u *Updater) CheckForUpdates() (*UpdateInfo, error) {
	url := fmt.Sprintf("%s/api/updates/update-check", u.baseURL)

	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("User-Agent", "scanx/"+u.currentScanxVersion)

	resp, err := u.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to check for updates: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("update check failed with status: %d", resp.StatusCode)
	}

	var updateInfo UpdateInfo
	if err := json.NewDecoder(resp.Body).Decode(&updateInfo); err != nil {
		return nil, fmt.Errorf("failed to parse update info: %w", err)
	}

	return &updateInfo, nil
}

// substituteURLTemplate replaces {platform}, {arch}, {.exe} in URL template
func (u *Updater) substituteURLTemplate(template string) string {
	// Get platform and arch
	platform := runtime.GOOS
	arch := runtime.GOARCH

	// Determine extension
	ext := ""
	if platform == "windows" {
		ext = ".exe"
	}

	// Substitute placeholders
	url := strings.ReplaceAll(template, "{platform}", platform)
	url = strings.ReplaceAll(url, "{arch}", arch)
	url = strings.ReplaceAll(url, "{.exe}", ext)

	return url
}

// downloadFile downloads a file using curl or wget
func (u *Updater) downloadFile(url string, destPath string) error {
	utils.Info("Downloading: %s", url)

	// Determine which download tool is available
	var cmd *exec.Cmd

	if runtime.GOOS == "windows" {
		// Use PowerShell Invoke-WebRequest on Windows
		psScript := fmt.Sprintf("Invoke-WebRequest -Uri '%s' -OutFile '%s' -UseBasicParsing", url, destPath)
		cmd = exec.Command("powershell.exe", "-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", psScript)
	} else {
		// Try curl first, then wget
		if _, err := exec.LookPath("curl"); err == nil {
			cmd = exec.Command("curl", "-L", "-o", destPath, url)
		} else if _, err := exec.LookPath("wget"); err == nil {
			cmd = exec.Command("wget", "-O", destPath, url)
		} else {
			return fmt.Errorf("neither curl nor wget found, cannot download update")
		}
	}

	output, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("download failed: %w\nOutput: %s", err, string(output))
	}

	// Verify file was downloaded
	if _, err := os.Stat(destPath); os.IsNotExist(err) {
		return fmt.Errorf("download completed but file not found: %s", destPath)
	}

	fileInfo, _ := os.Stat(destPath)
	utils.Info("Downloaded: %d bytes", fileInfo.Size())

	return nil
}

// downloadChecksumFile downloads and parses the checksum file
func (u *Updater) downloadChecksumFile(checksumURL string) (*ChecksumFile, error) {
	req, err := http.NewRequest("GET", checksumURL, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	resp, err := u.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to download checksum file: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("checksum download failed with status: %d", resp.StatusCode)
	}

	var checksumFile ChecksumFile
	if err := json.NewDecoder(resp.Body).Decode(&checksumFile); err != nil {
		return nil, fmt.Errorf("failed to parse checksum file: %w", err)
	}

	return &checksumFile, nil
}

// verifyChecksum calculates and verifies the SHA256 checksum of a file
func (u *Updater) verifyChecksum(filePath string, expectedChecksum string) error {
	file, err := os.Open(filePath)
	if err != nil {
		return fmt.Errorf("failed to open file for checksum: %w", err)
	}
	defer file.Close()

	hash := sha256.New()
	if _, err := io.Copy(hash, file); err != nil {
		return fmt.Errorf("failed to calculate checksum: %w", err)
	}

	actualChecksum := hex.EncodeToString(hash.Sum(nil))

	if actualChecksum != expectedChecksum {
		return fmt.Errorf("checksum mismatch: expected %s, got %s", expectedChecksum, actualChecksum)
	}

	utils.Info("✅ Checksum verified: %s", actualChecksum)
	return nil
}

// getBinaryName returns the binary filename based on platform and type
func (u *Updater) getBinaryName(binaryType string) string {
	platform := runtime.GOOS
	arch := runtime.GOARCH

	ext := ""
	if platform == "windows" {
		ext = ".exe"
	}

	return fmt.Sprintf("%s-%s-%s%s", binaryType, platform, arch, ext)
}

// getCurrentBinaryPath returns the full path to the current binary
func (u *Updater) getCurrentBinaryPath(binaryType string) (string, error) {
	switch binaryType {
	case "scanx":
		// Get scanx binary path
		if runtime.GOOS == "windows" {
			return "C:\\Program Files (x86)\\scanx\\scanx.exe", nil
		} else {
			return "/usr/local/bin/scanx", nil
		}
	case "osqueryi":
		// Get osqueryi binary path
		if runtime.GOOS == "windows" {
			return "C:\\Program Files (x86)\\scanx\\osqueryi.exe", nil
		} else {
			return "/usr/local/lib/scanx/osqueryi", nil
		}
	default:
		return "", fmt.Errorf("unknown binary type: %s", binaryType)
	}
}

// removeMacOSQuarantine removes quarantine attribute on macOS
func (u *Updater) removeMacOSQuarantine(filePath string) error {
	if runtime.GOOS != "darwin" {
		return nil // Not macOS, skip
	}

	utils.Info("Removing macOS quarantine attribute...")
	cmd := exec.Command("xattr", "-rd", "com.apple.quarantine", filePath)
	output, err := cmd.CombinedOutput()
	if err != nil {
		// Non-fatal error, just log
		utils.Warning("Failed to remove quarantine: %v\nOutput: %s", err, string(output))
		return nil
	}

	utils.Info("✅ Quarantine attribute removed")
	return nil
}

// updateBinary downloads and updates a single binary (scanx or osqueryi)
func (u *Updater) updateBinary(binaryType string, binaryUpdate BinaryUpdate, newVersion string) error {
	utils.Info("Updating %s binary...", binaryType)

	// Substitute URL template for download URL
	downloadURL := u.substituteURLTemplate(binaryUpdate.DownloadURL)
	// Checksum URL already has version embedded, only substitute platform/arch
	checksumURL := u.substituteURLTemplate(binaryUpdate.ChecksumURL)

	utils.Info("Download URL: %s", downloadURL)
	utils.Info("Checksum URL: %s", checksumURL)

	// Get current binary path
	currentPath, err := u.getCurrentBinaryPath(binaryType)
	if err != nil {
		return fmt.Errorf("failed to get current binary path: %w", err)
	}

	// Create temp directory for download
	tempDir := filepath.Join(os.TempDir(), "scanx-update")
	os.MkdirAll(tempDir, 0755)
	defer os.RemoveAll(tempDir) // Clean up temp dir on exit

	// Download binary
	binaryFilename := u.getBinaryName(binaryType)
	newBinaryPath := filepath.Join(tempDir, binaryFilename)

	if err := u.downloadFile(downloadURL, newBinaryPath); err != nil {
		return fmt.Errorf("failed to download binary: %w", err)
	}

	// Download and verify checksum
	checksumFile, err := u.downloadChecksumFile(checksumURL)
	if err != nil {
		return fmt.Errorf("failed to download checksum file: %w", err)
	}

	expectedChecksum, ok := checksumFile.Checksums[binaryFilename]
	if !ok {
		return fmt.Errorf("checksum not found for %s in checksum file", binaryFilename)
	}

	if err := u.verifyChecksum(newBinaryPath, expectedChecksum); err != nil {
		return fmt.Errorf("checksum verification failed: %w", err)
	}

	// Make binary executable (Unix)
	if runtime.GOOS != "windows" {
		os.Chmod(newBinaryPath, 0755)
	}

	// Remove macOS quarantine
	if err := u.removeMacOSQuarantine(newBinaryPath); err != nil {
		// Non-fatal, continue
		utils.Warning("Could not remove quarantine: %v", err)
	}

	// Perform atomic replacement
	if err := u.replaceBinary(currentPath, newBinaryPath); err != nil {
		return fmt.Errorf("failed to replace binary: %w", err)
	}

	// For osqueryi only: delete old backup after successful checksum verification
	if binaryType == "osqueryi" {
		backupPath := currentPath + ".old"
		if _, err := os.Stat(backupPath); err == nil {
			utils.Info("Removing old osqueryi backup: %s", backupPath)
			if err := os.Remove(backupPath); err != nil {
				utils.Warning("Failed to remove old osqueryi backup: %v", err)
				// Non-fatal, continue
			} else {
				utils.Info("✅ Old osqueryi backup removed")
			}
		}
	}

	utils.Info("✅ %s updated successfully", binaryType)
	return nil
}

// replaceBinary performs atomic binary replacement
func (u *Updater) replaceBinary(currentPath string, newBinaryPath string) error {
	utils.Info("Replacing binary at: %s", currentPath)

	// Paths for backup and new binary
	backupPath := currentPath + ".old"
	tempNewPath := currentPath + ".new"

	// Remove old backup if it exists (from previous update)
	if _, err := os.Stat(backupPath); err == nil {
		utils.Info("Removing old backup: %s", backupPath)
		if err := os.Remove(backupPath); err != nil {
			utils.Warning("Failed to remove old backup: %v", err)
			// Non-fatal, continue
		}
	}

	// Copy new binary to temp location near target
	utils.Info("Copying new binary to: %s", tempNewPath)
	if err := copyFile(newBinaryPath, tempNewPath); err != nil {
		return fmt.Errorf("failed to copy new binary: %w", err)
	}

	// Make it executable (Unix)
	if runtime.GOOS != "windows" {
		os.Chmod(tempNewPath, 0755)
	}

	// Backup existing binary
	utils.Info("Backing up current binary to: %s", backupPath)
	if _, err := os.Stat(currentPath); err == nil {
		if err := os.Rename(currentPath, backupPath); err != nil {
			os.Remove(tempNewPath)
			return fmt.Errorf("failed to backup current binary: %w", err)
		}
	}

	// Move new binary to current location
	utils.Info("Moving new binary to: %s", currentPath)
	if err := os.Rename(tempNewPath, currentPath); err != nil {
		// Try to restore backup
		os.Rename(backupPath, currentPath)
		return fmt.Errorf("failed to install new binary: %w", err)
	}

	// Verify the new binary is in place
	if _, err := os.Stat(currentPath); os.IsNotExist(err) {
		// Try to restore backup
		os.Rename(backupPath, currentPath)
		return fmt.Errorf("new binary not found after installation")
	}

	// Keep the backup for safety - will be removed on next update
	utils.Info("✅ Binary replaced successfully (backup kept at: %s)", backupPath)
	return nil
}

// copyFile copies a file from src to dst
func copyFile(src string, dst string) error {
	source, err := os.Open(src)
	if err != nil {
		return err
	}
	defer source.Close()

	destination, err := os.Create(dst)
	if err != nil {
		return err
	}
	defer destination.Close()

	if _, err := io.Copy(destination, source); err != nil {
		return err
	}

	return destination.Sync()
}

// updateConfigVersion updates the versions in agent.conf
func (u *Updater) updateConfigVersion(newScanxVersion, newOsqueryiVersion string) error {
	configPath := ""
	if runtime.GOOS == "windows" {
		configPath = "C:\\Program Files (x86)\\scanx\\config\\agent.conf"
	} else {
		configPath = "/etc/scanx/config/agent.conf"
	}

	utils.Info("Updating versions in config: %s", configPath)

	// Read config file
	data, err := os.ReadFile(configPath)
	if err != nil {
		return fmt.Errorf("failed to read config: %w", err)
	}

	// Parse JSON
	var configData map[string]interface{}
	if err := json.Unmarshal(data, &configData); err != nil {
		return fmt.Errorf("failed to parse config: %w", err)
	}

	// Update versions (only update fields that have new values)
	versionsUpdated := []string{}
	if newScanxVersion != "" {
		configData["scanx_version"] = newScanxVersion
		versionsUpdated = append(versionsUpdated, fmt.Sprintf("Scanx: %s", newScanxVersion))
	}
	if newOsqueryiVersion != "" {
		configData["osqueryi_version"] = newOsqueryiVersion
		versionsUpdated = append(versionsUpdated, fmt.Sprintf("Osqueryi: %s", newOsqueryiVersion))
	}

	// Write back
	updatedData, err := json.MarshalIndent(configData, "", "    ")
	if err != nil {
		return fmt.Errorf("failed to marshal config: %w", err)
	}

	if err := os.WriteFile(configPath, updatedData, 0644); err != nil {
		return fmt.Errorf("failed to write config: %w", err)
	}

	if len(versionsUpdated) > 0 {
		utils.Info("✅ Config versions updated: %s", strings.Join(versionsUpdated, ", "))
	}
	return nil
}

// PerformUpdate checks, downloads, and installs update
func (u *Updater) PerformUpdate() error {
	// Check for updates
	updateInfo, err := u.CheckForUpdates()
	if err != nil {
		utils.Warning("Update check failed: %v", err)
		return nil // Don't propagate error - daemon should continue
	}

	// Track if any update was performed
	osqueryiUpdated := false
	scanxUpdated := false
	newScanxVersion := ""
	newOsqueryiVersion := ""

	// Check osqueryi update FIRST (as it doesn't require restart)
	osqueryiUpdateAvailable := updateInfo.Details.Osqueryi.Version != "" && updateInfo.Details.Osqueryi.Version != u.currentOsqueryiVersion
	if osqueryiUpdateAvailable {
		utils.Info("🔄 Osqueryi update available: %s -> %s", u.currentOsqueryiVersion, updateInfo.Details.Osqueryi.Version)
		if updateInfo.Details.Osqueryi.Mandatory {
			utils.Info("⚠️  Osqueryi update is mandatory - updating...")
			if err := u.updateBinary("osqueryi", updateInfo.Details.Osqueryi, updateInfo.Details.Osqueryi.Version); err != nil {
				utils.Error("Failed to update osqueryi binary: %v", err)
				return fmt.Errorf("mandatory osqueryi update failed: %w", err)
			}
			osqueryiUpdated = true
			newOsqueryiVersion = updateInfo.Details.Osqueryi.Version
			utils.Info("✅ Osqueryi updated successfully: %s -> %s", u.currentOsqueryiVersion, newOsqueryiVersion)
		} else {
			utils.Info("ℹ️  Osqueryi update is optional - skipping")
		}
	} else {
		utils.Info("✅ Osqueryi is already up to date (version: %s)", u.currentOsqueryiVersion)
	}

	// Check scanx update SECOND (requires restart)
	scanxUpdateAvailable := updateInfo.Details.Scanx.Version != "" && updateInfo.Details.Scanx.Version != u.currentScanxVersion
	if scanxUpdateAvailable {
		utils.Info("🔄 Scanx update available: %s -> %s", u.currentScanxVersion, updateInfo.Details.Scanx.Version)
		if updateInfo.Details.Scanx.Mandatory {
			utils.Info("⚠️  Scanx update is mandatory - updating...")
			if err := u.updateBinary("scanx", updateInfo.Details.Scanx, updateInfo.Details.Scanx.Version); err != nil {
				utils.Error("Failed to update scanx binary: %v", err)
				return fmt.Errorf("mandatory scanx update failed: %w", err)
			}
			scanxUpdated = true
			newScanxVersion = updateInfo.Details.Scanx.Version
			utils.Info("✅ Scanx updated successfully: %s -> %s", u.currentScanxVersion, newScanxVersion)
		} else {
			utils.Info("ℹ️  Scanx update is optional - skipping")
		}
	} else {
		utils.Info("✅ Scanx is already up to date (version: %s)", u.currentScanxVersion)
	}

	// Update config if any updates were performed
	if osqueryiUpdated || scanxUpdated {
		if err := u.updateConfigVersion(newScanxVersion, newOsqueryiVersion); err != nil {
			utils.Error("Failed to update config versions: %v", err)
			// Non-fatal - the binaries are already updated
		}

		// Update in-memory versions to prevent repeated updates
		// Update both updater's versions and the config object used by collector
		if osqueryiUpdated && newOsqueryiVersion != "" {
			u.currentOsqueryiVersion = newOsqueryiVersion
			u.config.Agent.OsqueryiVersion = newOsqueryiVersion
		}
		if scanxUpdated && newScanxVersion != "" {
			u.currentScanxVersion = newScanxVersion
			u.config.Agent.ScanxVersion = newScanxVersion
		}

		utils.Info("✅ Update completed successfully!")

		// If scanx was updated, restart is required
		if scanxUpdated {
			utils.Info("🔄 Restarting agent for scanx changes to take effect...")
		if err := u.restartService(); err != nil {
			utils.Error("Failed to restart service: %v", err)
			utils.Info("Attempting graceful exit for service manager restart...")
			time.Sleep(2 * time.Second)
			os.Exit(3) // Exit with non-zero code to trigger KeepAlive restart
			}
		} else if osqueryiUpdated {
			utils.Info("✅ Osqueryi updated - no restart required, changes will take effect on next scan")
		}
	}

	return nil
}

// restartService restarts the agent service using platform-specific methods
func (u *Updater) restartService() error {
	switch runtime.GOOS {
	case "darwin":
		return u.restartServiceMacOS()
	case "linux":
		return u.restartServiceLinux()
	case "windows":
		return u.restartServiceWindows()
	default:
		return fmt.Errorf("unsupported platform: %s", runtime.GOOS)
	}
}

// restartServiceMacOS restarts the LaunchDaemon on macOS
func (u *Updater) restartServiceMacOS() error {
	serviceName := "com.company.scanx"

	utils.Info("Restarting LaunchDaemon: %s", serviceName)

	// Stop the service
	stopCmd := exec.Command("launchctl", "stop", serviceName)
	if output, err := stopCmd.CombinedOutput(); err != nil {
		utils.Error("Failed to stop service: %v, output: %s", err, string(output))
		// Continue anyway - it might not be running
	}

	time.Sleep(1 * time.Second)

	// Unload the service
	unloadCmd := exec.Command("launchctl", "unload", "/Library/LaunchDaemons/"+serviceName+".plist")
	if output, err := unloadCmd.CombinedOutput(); err != nil {
		utils.Error("Failed to unload service: %v, output: %s", err, string(output))
		// Continue anyway
	}

	time.Sleep(1 * time.Second)

	// Load the service
	loadCmd := exec.Command("launchctl", "load", "/Library/LaunchDaemons/"+serviceName+".plist")
	if output, err := loadCmd.CombinedOutput(); err != nil {
		return fmt.Errorf("failed to load service: %v, output: %s", err, string(output))
	}

	time.Sleep(1 * time.Second)

	// Start the service
	startCmd := exec.Command("launchctl", "start", serviceName)
	if output, err := startCmd.CombinedOutput(); err != nil {
		return fmt.Errorf("failed to start service: %v, output: %s", err, string(output))
	}

	utils.Info("✅ LaunchDaemon restarted successfully")

	// Exit this process after successful restart
	time.Sleep(2 * time.Second)
	os.Exit(0)

	return nil
}

// restartServiceLinux restarts the systemd service on Linux
func (u *Updater) restartServiceLinux() error {
	serviceName := "scanx.service"

	utils.Info("Restarting systemd service: %s", serviceName)

	cmd := exec.Command("systemctl", "restart", serviceName)
	if output, err := cmd.CombinedOutput(); err != nil {
		return fmt.Errorf("failed to restart service: %v, output: %s", err, string(output))
	}

	utils.Info("✅ systemd service restarted successfully")

	// Exit this process after successful restart
	time.Sleep(2 * time.Second)
	os.Exit(0)

	return nil
}

// restartServiceWindows restarts the Windows scheduled task
func (u *Updater) restartServiceWindows() error {
	taskName := "ScanX Agent"

	utils.Info("Restarting Windows scheduled task: %s", taskName)

	// Stop the task
	stopCmd := exec.Command("schtasks", "/End", "/TN", taskName)
	if output, err := stopCmd.CombinedOutput(); err != nil {
		utils.Error("Failed to stop task: %v, output: %s", err, string(output))
		// Continue anyway
	}

	time.Sleep(2 * time.Second)

	// Start the task
	startCmd := exec.Command("schtasks", "/Run", "/TN", taskName)
	if output, err := startCmd.CombinedOutput(); err != nil {
		return fmt.Errorf("failed to start task: %v, output: %s", err, string(output))
	}

	utils.Info("✅ Windows scheduled task restarted successfully")

	// Exit this process after successful restart
	time.Sleep(2 * time.Second)
	os.Exit(0)

	return nil
}
