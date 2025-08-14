package collector

import (
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"runtime"
	"strings"
	"scanx/internal/utils"
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

// detectOSQuery detects osquery binary location at standard system paths
func (r *OSQueryRunner) detectOSQuery() (string, error) {
	// Get standard system path based on platform
	systemPath := r.getSystemOSQueryPath()

	// Check if osquery exists at standard system path
	if r.isExecutable(systemPath) {
		return systemPath, nil
	}

	// Fallback: try to find in PATH
	pathOSQuery, err := exec.LookPath("osqueryi")
	if err == nil && r.isExecutable(pathOSQuery) {
		return pathOSQuery, nil
	}

	// Neither found - return error with helpful message
	return "", fmt.Errorf("osquery not found at expected system path '%s' or in PATH. Please install osquery first", systemPath)
}

// getSystemOSQueryPath returns the platform-specific system osquery path
func (r *OSQueryRunner) getSystemOSQueryPath() string {
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

// ExecuteQuery executes an osquery SQL query and returns JSON results
func (r *OSQueryRunner) ExecuteQuery(queryName string, query string) ([]map[string]interface{}, error) {
	// Execute osquery with JSON output
	utils.Info("Executing queryName: %s with osquery path: %s", queryName, r.osqueryPath)
	fmt.Printf("Executing queryName: %s with osquery path: %s\n", queryName, r.osqueryPath)

	cmd := exec.Command(r.osqueryPath, "--json", query)

	// Suppress stderr output (equivalent to 2>/dev/null or 2>NUL)
	// cmd.Stderr = nil

	// Capture output
	output, err := cmd.Output()
	if err != nil {
		return nil, fmt.Errorf("failed to execute osquery: %w", err)
	}

	// Parse JSON output
	var results []map[string]interface{}
	if err := json.Unmarshal(output, &results); err != nil {
		// Include the raw output in error for debugging
		outputStr := string(output)
		if len(outputStr) > 200 {
			outputStr = outputStr[:200] + "..."
		}
		return nil, fmt.Errorf("failed to parse osquery JSON output: %w\nRaw output: %s", err, outputStr)
	}

	return results, nil
}

// GetOSQueryPath returns the detected osquery path
func (r *OSQueryRunner) GetOSQueryPath() string {
	return r.osqueryPath
}
