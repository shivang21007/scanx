package collector

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"os/user"
	"runtime"
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

// ExecuteQueryAsUser executes an osquery query as a specific user using su command
func (r *OSQueryRunner) ExecuteQueryAsUser(queryName string, query string, username string) ([]map[string]interface{}, error) {
	utils.Info("Executing query '%s' as user '%s'", queryName, username)

	// Create temporary query file
	queryFile := "/var/lib/scanx/query.sql"
	err := os.WriteFile(queryFile, []byte(query), 0644)
	if err != nil {
		return nil, fmt.Errorf("failed to write query file: %w", err)
	}
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

	// Check for execution errors
	if err != nil {
		stderrOutput := stderr.String()
		if stderrOutput != "" {
			return nil, fmt.Errorf("failed to execute osquery query '%s' as user '%s': %w\nStderr: %s", queryName, username, err, stderrOutput)
		}
		return nil, fmt.Errorf("failed to execute osquery query '%s' as user '%s': %w", queryName, username, err)
	}

	// Get output
	output := stdout.String()
	if output == "" {
		// Return empty results instead of error for empty output
		return []map[string]interface{}{}, nil
	}

	// Parse JSON output
	var results []map[string]interface{}
	if err := json.Unmarshal([]byte(output), &results); err != nil {
		// Include the raw output in error for debugging
		outputStr := output
		if len(outputStr) > 200 {
			outputStr = outputStr[:200] + "..."
		}
		return nil, fmt.Errorf("failed to parse osquery JSON output for query '%s': %w\nRaw output: %s", queryName, err, outputStr)
	}

	return results, nil
}

// ExecuteQuery executes an osquery SQL query and returns JSON results with improved process handling
func (r *OSQueryRunner) ExecuteQuery(queryName string, query string) ([]map[string]interface{}, error) {
	utils.Info("Executing queryName: %s with osquery path: %s", queryName, r.osqueryPath)

	// For user-specific queries on macOS, execute as current user
	if runtime.GOOS == "darwin" && (queryName == "screen_lock_info" || strings.Contains(strings.ToLower(query), "screenlock")) {
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

	// Check for execution errors
	if err != nil {
		stderrOutput := stderr.String()
		if stderrOutput != "" {
			return nil, fmt.Errorf("failed to execute osquery query '%s': %w\nStderr: %s", queryName, err, stderrOutput)
		}
		return nil, fmt.Errorf("failed to execute osquery query '%s': %w", queryName, err)
	}

	// Get output
	output := stdout.String()
	if output == "" {
		// Return empty results instead of error for empty output
		return []map[string]interface{}{}, nil
	}

	// Parse JSON output
	var results []map[string]interface{}
	if err := json.Unmarshal([]byte(output), &results); err != nil {
		// Include the raw output in error for debugging
		outputStr := output
		if len(outputStr) > 200 {
			outputStr = outputStr[:200] + "..."
		}
		return nil, fmt.Errorf("failed to parse osquery JSON output for query '%s': %w\nRaw output: %s", queryName, err, outputStr)
	}

	return results, nil
}

// GetOSQueryPath returns the detected osquery path
func (r *OSQueryRunner) GetOSQueryPath() string {
	return r.osqueryPath
}
