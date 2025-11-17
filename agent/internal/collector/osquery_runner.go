package collector

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"os/exec"
	"os/user"
	"path/filepath"
	"runtime"
	"scanx/internal/config"
	"scanx/internal/utils"
	"strings"
	"time"
)

// OSQueryRunner handles osquery detection and execution
type OSQueryRunner struct {
	osqueryPath string
}

// NewOSQueryRunner creates a new OSQueryRunner with auto-detection
func NewOSQueryRunner() (*OSQueryRunner, error) {
	runner := &OSQueryRunner{}

	path, err := runner.detectOSQuery()
	if err != nil {
		return nil, fmt.Errorf("osquery not found: %w", err)
	}

	runner.osqueryPath = path
	return runner, nil
}

// detectOSQuery detects osquery binary location with priority order:
// 1. Bundled with ScanX installation (self-contained)
// 2. Standard system installation path
// 3. Available in system PATH
func (r *OSQueryRunner) detectOSQuery() (string, error) {
	// Priority 1: Check bundled osquery in ScanX installation directory
	bundledPath := r.getBundledOSQueryPath()
	if bundledPath != "" && r.isExecutable(bundledPath) {
		utils.Info("Using bundled osquery from: %s", bundledPath)
		return bundledPath, nil
	}

	// Priority 2: Check standard system installation path
	systemPath := GetSystemOSQueryPath()
	if r.isExecutable(systemPath) {
		utils.Info("Using system osquery from: %s", systemPath)
		return systemPath, nil
	}

	// Priority 3: Try to find in system PATH
	pathOSQuery, err := exec.LookPath("osqueryi")
	if err == nil && r.isExecutable(pathOSQuery) {
		utils.Info("Using osquery from PATH: %s", pathOSQuery)
		return pathOSQuery, nil
	}

	// Nothing found - return error with helpful message
	return "", fmt.Errorf("osquery not found. Checked: bundled path '%s', system path '%s', and PATH. Please ensure osquery is installed or bundled", bundledPath, systemPath)
}

// getBundledOSQueryPath returns the path to bundled osquery in ScanX installation directory
func (r *OSQueryRunner) getBundledOSQueryPath() string {
	switch runtime.GOOS {
	case "windows":
		// Windows: Check in same directory as scanx.exe
		exePath, err := os.Executable()
		if err != nil {
			return ""
		}
		exeDir := filepath.Dir(exePath)
		bundledPath := filepath.Join(exeDir, "osqueryi.exe")
		return bundledPath
	case "darwin", "linux":
		// macOS/Linux: Check in standard installation location
		// Bundled osquery is installed at /usr/local/lib/scanx/osqueryi
		// This is an absolute path that works regardless of where scanx is executed from
		bundledPath := "/usr/local/lib/scanx/osqueryi"
		return bundledPath
	default:
		return ""
	}
}

// GetSystemOSQueryPath returns the platform-specific system osquery path
func GetSystemOSQueryPath() string {
	switch runtime.GOOS {
	case "windows":
		return `C:\Program Files\osquery\osqueryi.exe`
	case "darwin", "linux":
		return "/usr/local/bin/osqueryi"
	default:
		// Fallback for other Unix-like systems
		// get osquery from PATH by command -v osqueryi
		cmd := exec.Command("command", "-v", "osqueryi")
		output, err := cmd.Output()
		if err != nil {
			return ""
		}
		return strings.TrimSpace(string(output))
	}
}

// isExecutable checks if file exists and is executable
func (r *OSQueryRunner) isExecutable(path string) bool {
	info, err := os.Stat(path)
	if err != nil {
		return false
	}

	// Check if file is executable (Unix systems)
	if runtime.GOOS != "windows" {
		mode := info.Mode()
		return mode&0111 != 0 // Check execute bits
	}

	// For Windows, just check if file exists
	return true
}

// IsExecutable is a public wrapper for checking if osquery is executable at a path
func (r *OSQueryRunner) IsExecutable(path string) bool {
	return r.isExecutable(path)
}

// getCurrentUser returns the current logged-in user for macOS
func (r *OSQueryRunner) getCurrentUser() (string, error) {
	// For macOS, try to get the current console user
	if runtime.GOOS == "darwin" {
		// Try to get the current console user
		cmd := exec.Command("stat", "-f", "%Su", "/dev/console")
		output, err := cmd.Output()
		if err == nil {
			username := strings.TrimSpace(string(output))
			if username != "" && username != "root" {
				return username, nil
			}
		}

		// Fallback: try to get from who command
		cmd = exec.Command("who")
		output, err = cmd.Output()
		if err == nil {
			lines := strings.Split(strings.TrimSpace(string(output)), "\n")
			for _, line := range lines {
				parts := strings.Fields(line)
				if len(parts) > 0 {
					username := parts[0]
					if username != "root" {
						return username, nil
					}
				}
			}
		}
	}

	// Fallback: get current user
	currentUser, err := user.Current()
	if err != nil {
		return "", fmt.Errorf("failed to get current user: %w", err)
	}

	return currentUser.Username, nil
}

// ExecuteQueryAsUser executes an osquery query as a specific user using sudo command
func (r *OSQueryRunner) ExecuteQueryAsUser(queryName string, query string, username string) ([]map[string]interface{}, error) {
	utils.Info("Executing query '%s' as user '%s'", queryName, username)

	// Create temporary query file with world-readable permissions
	queryFile := "/tmp/scanx_query.sql"
	err := os.WriteFile(queryFile, []byte(query), 0644)
	if err != nil {
		return nil, fmt.Errorf("failed to write query file: %w", err)
	}
	// Ensure the file is readable by the target user
	os.Chmod(queryFile, 0644)
	defer os.Remove(queryFile) // Clean up after execution

	// Create context with timeout
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	// Execute osquery as the specified user using su
	suCmd := fmt.Sprintf("osqueryi --json < %s", queryFile)
	cmd := exec.CommandContext(ctx, "su", "-", username, "-c", suCmd)

	// Capture both stdout and stderr
	var stdout, stderr strings.Builder
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr

	// Execute command
	err = cmd.Run()

	// Check for context timeout
	if ctx.Err() == context.DeadlineExceeded {
		return nil, fmt.Errorf("osquery execution timed out after 30 seconds for query: %s", queryName)
	}

	// Get stdout and stderr
	output := stdout.String()
	stderrOutput := stderr.String()

	// Log raw output for debugging
	utils.Info("Raw output from user query '%s' (user: %s): %s", queryName, username, output)
	if stderrOutput != "" {
		utils.Info("Stderr from user query '%s' (user: %s): %s", queryName, username, stderrOutput)
	}

	// Check if we have valid JSON output even if there was an error
	// OSQuery often returns valid JSON with warnings in stderr
	if output == "" {
		// No output - check if this was an actual error
		if err != nil {
			utils.Error("Query execution failed for '%s' as user '%s': %v", queryName, username, err)
			if stderrOutput != "" {
				utils.Error("Stderr: %s", stderrOutput)
				return nil, fmt.Errorf("failed to execute osquery query '%s' as user '%s': %w\nStderr: %s", queryName, username, err, stderrOutput)
			}
			return nil, fmt.Errorf("failed to execute osquery query '%s' as user '%s': %w", queryName, username, err)
		}
		// No error, just empty results
		utils.Info("Query '%s' (user: %s) returned empty results", queryName, username)
		return []map[string]interface{}{}, nil
	}

	// Clean the output - extract only the JSON part
	output = strings.TrimSpace(output)

	// Parse JSON output
	var results []map[string]interface{}
	if parseErr := json.Unmarshal([]byte(output), &results); parseErr != nil {
		// JSON parsing failed - this is a real error
		outputStr := output
		if len(outputStr) > 500 {
			outputStr = outputStr[:500] + "..."
		}

		// Include stderr if available for debugging
		errMsg := fmt.Sprintf("failed to parse osquery JSON output for query '%s' (user: %s): %v\nRaw output: %s", queryName, username, parseErr, outputStr)
		if stderrOutput != "" {
			errMsg += fmt.Sprintf("\nStderr: %s", stderrOutput)
		}
		utils.Error("JSON parsing error: %s", errMsg)
		return nil, errors.New(errMsg)
	}

	// Success! We have valid JSON results
	utils.Info("Query '%s' (user: %s) completed successfully with %d result(s)", queryName, username, len(results))
	if len(results) > 0 {
		utils.Info("Results: %+v", results)
	}

	return results, nil
}

// ExecuteQuery executes an osquery SQL query and returns JSON results with improved process handling
func (r *OSQueryRunner) ExecuteQuery(queryName string, query string) ([]map[string]interface{}, error) {
	utils.Info("Executing queryName: %s with osquery path: %s", queryName, r.osqueryPath)

	// For user-specific queries on macOS, execute as current user
	if (runtime.GOOS == "darwin" || runtime.GOOS == "linux") && (queryName == "screen_lock_info" || strings.Contains(strings.ToLower(query), "screenlock")) {
		username, err := r.getCurrentUser()
		if err != nil {
			utils.Info("Failed to get current user, falling back to root execution: %v", err)
		} else {
			utils.Info("Executing user-specific query '%s' as user '%s'", queryName, username)
			return r.ExecuteQueryAsUser(queryName, query, username)
		}
	}

	// Create context with timeout
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	// Create command with context
	cmd := exec.CommandContext(ctx, r.osqueryPath, "--json", query)

	// Set environment variables for better compatibility
	// Use current user context instead of root for user-specific queries
	cmd.Env = append(os.Environ(),
		"PATH=/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin",
		"OSQUERY_FLAGS=--disable_events=false --disable_audit=false --audit_allow_user_events=true",
	)

	// Capture both stdout and stderr
	var stdout, stderr strings.Builder
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr

	// Execute command
	err := cmd.Run()

	// Check for context timeout
	if ctx.Err() == context.DeadlineExceeded {
		return nil, fmt.Errorf("osquery execution timed out after 30 seconds for query: %s", queryName)
	}

	// Get stdout and stderr
	output := stdout.String()
	stderrOutput := stderr.String()

	// Log stderr warnings (osquery often writes warnings to stderr even on success)
	if stderrOutput != "" {
		// Only log warnings, don't treat as errors unless there's no valid output
		utils.Info("OSQuery warnings for query '%s': %s", queryName, stderrOutput)
	}

	// Check if we have valid JSON output even if there was an error
	// OSQuery often returns valid JSON with warnings in stderr
	if output == "" {
		// No output - check if this was an actual error
		if err != nil {
			if stderrOutput != "" {
				return nil, fmt.Errorf("failed to execute osquery query '%s': %w\nStderr: %s", queryName, err, stderrOutput)
			}
			return nil, fmt.Errorf("failed to execute osquery query '%s': %w", queryName, err)
		}
		// No error, just empty results
		return []map[string]interface{}{}, nil
	}

	// Clean the output - extract only the JSON part
	// OSQuery should output clean JSON, but let's be defensive
	output = strings.TrimSpace(output)

	// Parse JSON output
	var results []map[string]interface{}
	if parseErr := json.Unmarshal([]byte(output), &results); parseErr != nil {
		// JSON parsing failed - this is a real error
		outputStr := output
		if len(outputStr) > 200 {
			outputStr = outputStr[:200] + "..."
		}

		// Include stderr if available for debugging
		errMsg := fmt.Sprintf("failed to parse osquery JSON output for query '%s': %v\nRaw output: %s", queryName, parseErr, outputStr)
		if stderrOutput != "" {
			errMsg += fmt.Sprintf("\nStderr: %s", stderrOutput)
		}
		return nil, errors.New(errMsg)
	}

	// Success! We have valid JSON results
	// Log success with result count
	utils.Info("Query '%s' completed successfully with %d result(s)", queryName, len(results))

	return results, nil
}

// GetOSQueryPath returns the detected osquery path
func (r *OSQueryRunner) GetOSQueryPath() string {
	return r.osqueryPath
}

// ExecuteWindowsScreenLockQuery executes the Windows screen lock detection
// This requires special handling to mount the user's registry hive
func (r *OSQueryRunner) ExecuteWindowsScreenLockQuery() ([]map[string]interface{}, error) {
	if runtime.GOOS != "windows" {
		return nil, fmt.Errorf("screen lock detection via hive mounting is only supported on Windows")
	}

	// Detect installation directory (same logic as config loading)
	installDir := r.detectInstallDir()
	if installDir == "" {
		return nil, fmt.Errorf("failed to detect ScanX installation directory")
	}

	utils.Info("Executing Windows screen lock query with install dir: %s", installDir)

	// Import the config package function
	// Note: This is in the same module, so we can call it directly
	return config.CollectWindowsScreenLock(r.osqueryPath, installDir)
}

// detectInstallDir detects the ScanX installation directory
func (r *OSQueryRunner) detectInstallDir() string {
	// Try to get executable path first
	exePath, err := os.Executable()
	if err == nil {
		exeDir := filepath.Dir(exePath)
		// Check if this looks like an installation directory
		if _, err := os.Stat(filepath.Join(exeDir, "installed_user.txt")); err == nil {
			return exeDir
		}
	}

	// Try standard installation paths
	candidateDirs := []string{
		`C:\Program Files (x86)\scanx`,
		`C:\Program Files\scanx`,
	}

	for _, dir := range candidateDirs {
		if _, err := os.Stat(filepath.Join(dir, "installed_user.txt")); err == nil {
			return dir
		}
	}

	return ""
}
