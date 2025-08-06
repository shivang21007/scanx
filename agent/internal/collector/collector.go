package collector

import (
	"fmt"
	"runtime"
	"strings"

	"mdm-agent/internal/config"
	"mdm-agent/internal/utils"
)

// SystemInfo represents system metadata
type SystemInfo struct {
	OSType       string `json:"os_type"`
	OSVersion    string `json:"os_version"`
	SerialNo     string `json:"serial_no"`
	ComputerName string `json:"computer_name"`
}

// CollectedData represents the complete data collection result
type CollectedData struct {
	User         string                              `json:"user"`
	Version      string                              `json:"version"`
	OSType       string                              `json:"os_type"`
	OSVersion    string                              `json:"os_version"`
	SerialNo     string                              `json:"serial_no"`
	ComputerName string                              `json:"computer_name"`
	Timestamp    string                              `json:"timestamp"`
	Data         map[string][]map[string]interface{} `json:"data"`
}

// Collector handles data collection from osquery
type Collector struct {
	config  *config.Config
	runner  *OSQueryRunner
	sysInfo SystemInfo
}

// NewCollector creates a new data collector
func NewCollector(cfg *config.Config) (*Collector, error) {
	// Initialize OSQuery runner
	runner, err := NewOSQueryRunner()
	if err != nil {
		return nil, fmt.Errorf("failed to initialize osquery runner: %w", err)
	}

	collector := &Collector{
		config: cfg,
		runner: runner,
		sysInfo: SystemInfo{
			OSType: runtime.GOOS,
		},
	}

	// Extract system information
	if err := collector.extractSystemInfo(); err != nil {
		return nil, fmt.Errorf("failed to extract system info: %w", err)
	}

	return collector, nil
}

// extractSystemInfo extracts OS version and serial number from system_info query
func (c *Collector) extractSystemInfo() error {
	// Get platform-specific queries
	queries, err := c.config.GetPlatformQueries()
	if err != nil {
		return fmt.Errorf("failed to get platform queries: %w", err)
	}

	// Get system_info query
	systemInfoQuery, exists := queries["system_info"]
	if !exists {
		return fmt.Errorf("system_info query not found for platform: %s", runtime.GOOS)
	}

	// Execute system_info query
	results, err := c.runner.ExecuteQuery(systemInfoQuery.Query)
	if err != nil {
		return fmt.Errorf("failed to execute system_info query: %w", err)
	}

	if len(results) == 0 {
		return fmt.Errorf("no system info results returned")
	}

	// Extract OS version and serial number from first result
	result := results[0]

	// Debug: log available fields for OS version extraction
	fmt.Printf("DEBUG: Available system_info fields for OS version: ")
	for key := range result {
		if strings.Contains(strings.ToLower(key), "version") || strings.Contains(strings.ToLower(key), "build") {
			fmt.Printf("%s=%v ", key, result[key])
		}
	}
	fmt.Println()

	// Extract OS version - try multiple field names
	if version, ok := result["version"].(string); ok && version != "" {
		c.sysInfo.OSVersion = version
	} else if version, ok := result["build"].(string); ok && version != "" {
		c.sysInfo.OSVersion = version
	} else if version, ok := result["platform_version"].(string); ok && version != "" {
		c.sysInfo.OSVersion = version
	} else if version, ok := result["os_version"].(string); ok && version != "" {
		c.sysInfo.OSVersion = version
	} else {
		c.sysInfo.OSVersion = "unknown"
		fmt.Printf("DEBUG: Could not extract OS version from available fields\n")
	}

	// Extract serial number - different field names per platform
	if serial, ok := result["hardware_serial"].(string); ok && serial != "" {
		c.sysInfo.SerialNo = serial
	} else if serial, ok := result["uuid"].(string); ok && serial != "" {
		c.sysInfo.SerialNo = serial
	} else {
		c.sysInfo.SerialNo = "unknown"
	}

	// Extract computer name
	if computerName, ok := result["computer_name"].(string); ok && computerName != "" {
		c.sysInfo.ComputerName = computerName
	} else if hostname, ok := result["hostname"].(string); ok && hostname != "" {
		c.sysInfo.ComputerName = hostname
	} else {
		c.sysInfo.ComputerName = "unknown"
	}

	return nil
}

// CollectData executes all platform-specific queries and returns formatted data
func (c *Collector) CollectData() (*CollectedData, error) {
	// Get platform-specific queries
	queries, err := c.config.GetPlatformQueries()
	if err != nil {
		return nil, fmt.Errorf("failed to get platform queries: %w", err)
	}

	// Initialize data map
	data := make(map[string][]map[string]interface{})

	// Execute each query
	for queryName, queryConfig := range queries {
		results, err := c.runner.ExecuteQuery(queryConfig.Query)
		if err != nil {
			// Log error but continue with other queries
			fmt.Printf("Warning: Failed to execute query '%s': %v\n", queryName, err)
			// Set empty result for failed queries
			data[queryName] = []map[string]interface{}{}
			continue
		}

		data[queryName] = results
	}

	// Build final payload
	collectedData := &CollectedData{
		User:         c.config.Agent.UserEmail,
		Version:      c.config.Agent.Version,
		OSType:       c.sysInfo.OSType,
		OSVersion:    c.sysInfo.OSVersion,
		SerialNo:     c.sysInfo.SerialNo,
		ComputerName: c.sysInfo.ComputerName,
		Timestamp:    utils.GetCurrentISTString(),
		Data:         data,
	}

	return collectedData, nil
}

// GetSystemInfo returns the extracted system information
func (c *Collector) GetSystemInfo() SystemInfo {
	return c.sysInfo
}

// GetOSQueryPath returns the osquery binary path being used
func (c *Collector) GetOSQueryPath() string {
	return c.runner.GetOSQueryPath()
}

// ValidateConfiguration checks if the collector is properly configured
func (c *Collector) ValidateConfiguration() error {
	// Check if user email is set
	if strings.TrimSpace(c.config.Agent.UserEmail) == "" {
		return fmt.Errorf("user email not configured")
	}

	// Check if queries exist for current platform
	_, err := c.config.GetPlatformQueries()
	if err != nil {
		return fmt.Errorf("platform queries not available: %w", err)
	}

	return nil
}
