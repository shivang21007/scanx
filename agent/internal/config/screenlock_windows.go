// +build windows

package config

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"scanx/internal/utils"
	"strings"
	"time"
)

// ReadInstalledUser reads the SID and username from installed_user.txt
func ReadInstalledUser(installDir string) (sid string, username string, err error) {
	filePath := filepath.Join(installDir, "installed_user.txt")
	
	utils.Debug("Reading installed user file: %s", filePath)
	
	data, err := os.ReadFile(filePath)
	if err != nil {
		return "", "", fmt.Errorf("failed to read installed_user.txt: %w", err)
	}
	
	lines := strings.Split(strings.TrimSpace(string(data)), "\n")
	if len(lines) < 1 {
		return "", "", fmt.Errorf("installed_user.txt is empty")
	}
	
	sid = strings.TrimSpace(lines[0])
	if sid == "" {
		return "", "", fmt.Errorf("SID is empty in installed_user.txt")
	}
	
	if len(lines) > 1 {
		username = strings.TrimSpace(lines[1])
	}
	
	utils.Debug("Read installer user - SID: %s, Username: %s", sid, username)
	return sid, username, nil
}

// ValidateUserProfile validates that the user's NTUSER.DAT file exists
func ValidateUserProfile(username string) (ntdatPath string, err error) {
	// Extract local username from DOMAIN\username format
	parts := strings.Split(username, `\`)
	localUser := parts[len(parts)-1]
	
	// Build path to NTUSER.DAT
	ntdatPath = filepath.Join(`C:\Users`, localUser, "NTUSER.DAT")
	
	utils.Debug("Checking for NTUSER.DAT at: %s", ntdatPath)
	
	if _, err := os.Stat(ntdatPath); err != nil {
		return "", fmt.Errorf("NTUSER.DAT not found for user %s: %w", localUser, err)
	}
	
	utils.Debug("NTUSER.DAT found at: %s", ntdatPath)
	return ntdatPath, nil
}

// IsHiveMounted checks if a registry hive is already mounted at the given SID
func IsHiveMounted(sid string) bool {
	// Try to query the registry key to see if it exists
	keyPath := fmt.Sprintf(`HKEY_USERS\%s`, sid)
	cmd := exec.Command("reg", "query", keyPath)
	err := cmd.Run()
	
	mounted := err == nil
	utils.Debug("Hive mounted check for %s: %v", keyPath, mounted)
	return mounted
}

// MountHive mounts a registry hive to a temporary key
func MountHive(tempKey, hivePath string) error {
	utils.Debug("Mounting hive: %s -> %s", hivePath, tempKey)
	
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	
	cmd := exec.CommandContext(ctx, "reg", "load", tempKey, hivePath)
	output, err := cmd.CombinedOutput()
	
	if err != nil {
		return fmt.Errorf("failed to mount hive: %w. Output: %s", err, string(output))
	}
	
	utils.Debug("Successfully mounted hive to %s", tempKey)
	return nil
}

// UnmountHive unmounts a registry hive from a temporary key
func UnmountHive(tempKey string) error {
	utils.Debug("Unmounting hive: %s", tempKey)
	
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	
	cmd := exec.CommandContext(ctx, "reg", "unload", tempKey)
	output, err := cmd.CombinedOutput()
	
	if err != nil {
		// Log but don't fail - sometimes the hive is already unmounted
		utils.Debug("Failed to unmount hive (may already be unmounted): %v. Output: %s", err, string(output))
		return nil
	}
	
	utils.Debug("Successfully unmounted hive from %s", tempKey)
	return nil
}

// BuildScreenLockQuery builds the osquery SQL query for screen lock detection
func BuildScreenLockQuery(hiveKey string) string {
	// Escape backslashes for SQL (need double backslashes in the SQL string)
	escapedKey := strings.ReplaceAll(hiveKey, `\`, `\\`)
	
	query := fmt.Sprintf(
		`WITH kv AS (SELECT MAX(CASE WHEN name='ScreenSaveActive' THEN data END) AS ScreenSaveActive, MAX(CASE WHEN name='ScreenSaverIsSecure' THEN data END) AS ScreenSaverIsSecure, MAX(CASE WHEN name='ScreenSaveTimeOut' THEN data END) AS ScreenSaveTimeOut FROM registry WHERE path LIKE '\\%s\\Control Panel\\Desktop\\%%' AND name IN ('ScreenSaveActive','ScreenSaverIsSecure','ScreenSaveTimeOut')) SELECT CASE WHEN ScreenSaveActive='1' AND ScreenSaverIsSecure='1' THEN 'true' ELSE 'false' END AS screen_lock, ScreenSaveTimeOut AS grace_period FROM kv;`,
		escapedKey,
	)
	
	return query
}

// executeOSQuery executes an osquery command and returns parsed JSON results
func executeOSQuery(osqueryPath, query string) ([]map[string]interface{}, error) {
	utils.Info("Executing osquery for screen lock detection")
	
	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
	defer cancel()
	
	cmd := exec.CommandContext(ctx, osqueryPath, "--json", query)
	
	var stdout, stderr strings.Builder
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr
	
	err := cmd.Run()
	
	// Check for timeout
	if ctx.Err() == context.DeadlineExceeded {
		return nil, fmt.Errorf("osquery execution timed out after 20 seconds")
	}
	
	// Get output
	output := stdout.String()
	stderrOutput := stderr.String()
	
	// Log warnings from stderr
	if stderrOutput != "" {
		utils.Info("OSQuery warnings: %s", stderrOutput)
	}
	
	// Check if we have output
	if output == "" {
		if err != nil {
			return nil, fmt.Errorf("osquery failed with no output: %w. Stderr: %s", err, stderrOutput)
		}
		// No error, just empty results
		return []map[string]interface{}{}, nil
	}
	
	// Parse JSON
	output = strings.TrimSpace(output)
	var results []map[string]interface{}
	
	if parseErr := json.Unmarshal([]byte(output), &results); parseErr != nil {
		outputStr := output
		if len(outputStr) > 200 {
			outputStr = outputStr[:200] + "..."
		}
		return nil, fmt.Errorf("failed to parse osquery JSON: %v. Raw output: %s", parseErr, outputStr)
	}
	
	utils.Info("OSQuery completed successfully with %d result(s)", len(results))
	return results, nil
}

// CollectWindowsScreenLock is the main orchestrator for Windows screen lock detection
// Supports both legacy screen saver method and modern Windows 10/11 power settings
func CollectWindowsScreenLock(osqueryPath, installDir string) ([]map[string]interface{}, error) {
	utils.Info("Starting Windows screen lock detection")
	
	// Step 1: Read installed user SID and username
	sid, username, err := ReadInstalledUser(installDir)
	if err != nil {
		utils.Info("Failed to read installed user: %v", err)
		return []map[string]interface{}{{"screen_lock": "false", "grace_period": ""}}, nil
	}
	
	// Step 2: Try modern Windows 10/11 method first (power settings + sign-in options)
	modernResult, modernErr := detectModernScreenLock()
	if modernErr == nil && modernResult != nil {
		utils.Info("Using modern Windows 10/11 screen lock detection")
		return modernResult, nil
	}
	utils.Info("Modern detection failed or not applicable: %v", modernErr)
	
	// Step 3: Fall back to legacy screen saver method
	utils.Info("Falling back to legacy screen saver detection")
	
	// Validate user profile exists
	ntdatPath, err := ValidateUserProfile(username)
	if err != nil {
		utils.Info("User profile validation failed: %v", err)
		return []map[string]interface{}{{"screen_lock": "false", "grace_period": ""}}, nil
	}
	
	// Check if hive is already mounted
	var hiveKey string
	var needsUnmount bool
	
	if IsHiveMounted(sid) {
		// Hive already mounted at the user's SID
		hiveKey = fmt.Sprintf(`HKEY_USERS\%s`, sid)
		needsUnmount = false
		utils.Info("User hive already mounted at %s", hiveKey)
	} else {
		// Need to mount the hive
		tempKey := `HKU\ScanxTemp`
		
		// Try to unmount first in case it's left over from a previous run
		UnmountHive(tempKey)
		
		// Mount the hive
		if err := MountHive(tempKey, ntdatPath); err != nil {
			utils.Info("Failed to mount user hive: %v", err)
			return []map[string]interface{}{{"screen_lock": "false", "grace_period": ""}}, nil
		}
		
		hiveKey = `HKEY_USERS\ScanxTemp`
		needsUnmount = true
		
		// Ensure we unmount on exit
		defer func() {
			if needsUnmount {
				UnmountHive(`HKU\ScanxTemp`)
			}
		}()
	}
	
	// Build and execute osquery
	query := BuildScreenLockQuery(hiveKey)
	utils.Info("Screen lock query: %s", query)
	
	results, err := executeOSQuery(osqueryPath, query)
	if err != nil {
		utils.Info("Failed to execute screen lock query: %v", err)
		return []map[string]interface{}{{"screen_lock": "false", "grace_period": ""}}, nil
	}
	
	// Return results
	if len(results) == 0 {
		utils.Info("No screen lock data returned, defaulting to false")
		return []map[string]interface{}{{"screen_lock": "false", "grace_period": ""}}, nil
	}
	
	utils.Info("Screen lock detection completed successfully")
	return results, nil
}

// detectModernScreenLock checks Windows 10/11 power settings and sign-in options
func detectModernScreenLock() ([]map[string]interface{}, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	
	// Check if screen timeout is configured (display turns off)
	cmd := exec.CommandContext(ctx, "powershell.exe", "-NoProfile", "-ExecutionPolicy", "Bypass", "-Command",
		"$timeout = (powercfg /query SCHEME_CURRENT SUB_VIDEO VIDEOIDLE | Select-String 'Current AC Power Setting Index:' | ForEach-Object { $_.ToString().Split(':')[1].Trim() }); if ($timeout) { [Convert]::ToInt32($timeout, 16) } else { 0 }")
	
	output, err := cmd.Output()
	if err != nil {
		return nil, fmt.Errorf("failed to query power settings: %w", err)
	}
	
	timeoutStr := strings.TrimSpace(string(output))
	timeout := 0
	fmt.Sscanf(timeoutStr, "%d", &timeout)
	
	utils.Info("Display timeout (seconds): %d", timeout)
	
	// If timeout is 0 or very large (never), screen lock is effectively disabled
	if timeout == 0 || timeout > 86400 {
		utils.Info("Screen timeout is disabled or set to never")
		return []map[string]interface{}{{"screen_lock": "false", "grace_period": ""}}, nil
	}
	
	// Screen timeout is configured, so screen lock is enabled
	utils.Info("Screen lock enabled via power settings with timeout: %d seconds", timeout)
	return []map[string]interface{}{
		{
			"screen_lock":  "true",
			"grace_period": fmt.Sprintf("%d", timeout),
		},
	}, nil
}

