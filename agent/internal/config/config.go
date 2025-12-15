package config

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"runtime"
	"time"
)

// AgentConfig represents the agent configuration from agent.conf
type AgentConfig struct {
	UserEmail       string `json:"user_email"`
	ScanxVersion    string `json:"scanx_version"`
	OsqueryiVersion string `json:"osqueryi_version"`
	Interval        string `json:"interval"`
	LogLevel        string `json:"log_level"`
	BackendURL      string `json:"backend_url"`
}

// QueryConfig represents a single query configuration
type QueryConfig struct {
	Query       string `yaml:"query"`
	Description string `yaml:"description"`
}

// PlatformQueries represents queries for a specific platform
type PlatformQueries map[string]QueryConfig

// QueriesConfig represents the complete queries configuration
type QueriesConfig struct {
	Platform map[string]PlatformQueries `yaml:"platform"`
}

// Config holds all configuration data
type Config struct {
	Agent   AgentConfig
	Queries QueriesConfig
}

// LoadConfig loads agent.conf from file and uses embedded queries.go
func LoadConfig() (*Config, error) {
	// Try a series of candidate config directories so the binary works without -config
	// this is a fallback for the case where the binary is not run with -config
	candidateDirs := []string{
		"config",                                 // running from source tree / unpacked package
		"/etc/scanx/config",                      // standardized Unix install path
		"C:\\Program Files (x86)\\scanx\\config", // Windows 32-bit install path (MSI default)
		"C:\\Program Files\\scanx\\config",       // Windows 64-bit install path
	}

	var lastErr error
	for _, dir := range candidateDirs {
		cfg, err := LoadConfigFromPath(dir)
		if err == nil {
			return cfg, nil
		}
		lastErr = err
	}

	if lastErr == nil {
		lastErr = fmt.Errorf("no configuration directories found")
	}
	return nil, lastErr
}

// LoadConfigFromPath loads agent configuration from file and uses embedded queries
func LoadConfigFromPath(configDir string) (*Config, error) {
	config := &Config{}

	// Load agent configuration from file
	agentConfig, err := loadAgentConfigFromPath(configDir)
	if err != nil {
		return nil, fmt.Errorf("failed to load agent config: %w", err)
	}
	config.Agent = *agentConfig

	// Use embedded queries instead of loading from file
	queriesConfig := GetQueriesConfig()
	config.Queries = *queriesConfig

	return config, nil
}

// loadAgentConfigFromPath loads the agent.conf file from a custom path
func loadAgentConfigFromPath(configDir string) (*AgentConfig, error) {
	configPath := filepath.Join(configDir, "agent.conf")

	// Check if file exists and is readable
	if _, err := os.Stat(configPath); os.IsNotExist(err) {
		return nil, fmt.Errorf("agent config file does not exist: %s", configPath)
	}

	data, err := os.ReadFile(configPath)
	if err != nil {
		return nil, fmt.Errorf("failed to read agent config file %s: %w", configPath, err)
	}

	var config AgentConfig
	if err := json.Unmarshal(data, &config); err != nil {
		return nil, fmt.Errorf("failed to parse agent config: %w", err)
	}

	return &config, nil
}

// GetPlatformQueries returns queries for the current platform
func (c *Config) GetPlatformQueries() (PlatformQueries, error) {
	platform := runtime.GOOS

	queries, exists := c.Queries.Platform[platform]
	if !exists {
		return nil, fmt.Errorf("no queries found for platform: %s", platform)
	}

	return queries, nil
}

// GetInterval returns the parsed interval duration with fallback to 1 hour
func (c *Config) GetInterval() time.Duration {
	if c.Agent.Interval == "" {
		return time.Hour // Default fallback
	}

	duration, err := time.ParseDuration(c.Agent.Interval)
	if err != nil {
		// Note: Using fmt.Printf here because logger may not be initialized yet
		fmt.Printf("Warning: Invalid interval '%s', using default 1h\n", c.Agent.Interval)
		return time.Hour
	}

	return duration
}

// GetLogLevel returns the log level with fallback to "info"
func (c *Config) GetLogLevel() string {
	if c.Agent.LogLevel == "" {
		return "info"
	}

	// Validate log level
	switch c.Agent.LogLevel {
	case "debug", "info", "warning", "error":
		return c.Agent.LogLevel
	default:
		// Note: Using fmt.Printf here because logger may not be initialized yet
		fmt.Printf("Warning: Invalid log level '%s', using default 'info'\n", c.Agent.LogLevel)
		return "info"
	}
}

// GetBackendURL returns the backend URL with fallback to default
func (c *Config) GetBackendURL() string {
	if c.Agent.BackendURL != "" {
		return c.Agent.BackendURL
	}
	// Fallback to default URL if not configured
	return "http://192.168.22.22:5173"
}
