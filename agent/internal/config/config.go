package config

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"runtime"
	"scanx/internal/utils"
	"time"

	"gopkg.in/yaml.v3"
)

// AgentConfig represents the agent configuration from agent.conf
type AgentConfig struct {
	UserEmail  string `json:"user_email"`
	Version    string `json:"version"`
	Interval   string `json:"interval"`
	LogLevel   string `json:"log_level"`
	BackendURL string `json:"backend_url"`
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

// LoadConfig loads both agent.conf and queries.yml
func LoadConfig() (*Config, error) {
	// Try a series of candidate config directories so the binary works without -config
	// this is a fallback for the case where the binary is not run with -config
	candidateDirs := []string{
		"config",                           // running from source tree / unpacked package
		"/etc/scanx/config",                // standardized Unix install path
		"C:\\Program Files\\scanx\\config", // Windows install path
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

// LoadConfigFromPath loads configuration from a custom path
func LoadConfigFromPath(configDir string) (*Config, error) {
	config := &Config{}

	// Load agent configuration
	agentConfig, err := loadAgentConfigFromPath(configDir)
	if err != nil {
		utils.Error("failed to load agent config: %w", err)
		return nil, fmt.Errorf("failed to load agent config: %w", err)
	}
	config.Agent = *agentConfig
	utils.Info("Agent config loaded successfully")

	// Load queries configuration
	queriesConfig, err := loadQueriesConfigFromPath(configDir)
	if err != nil {
		utils.Error("failed to load queries config: %w", err)
		return nil, fmt.Errorf("failed to load queries config: %w", err)
	}
	config.Queries = *queriesConfig
	utils.Info("Queries config loaded successfully")

	return config, nil
}

// loadAgentConfigFromPath loads the agent.conf file from a custom path
func loadAgentConfigFromPath(configDir string) (*AgentConfig, error) {
	configPath := filepath.Join(configDir, "agent.conf")

	data, err := os.ReadFile(configPath)
	if err != nil {
		return nil, fmt.Errorf("failed to read agent config file: %w", err)
	}

	var config AgentConfig
	if err := json.Unmarshal(data, &config); err != nil {
		return nil, fmt.Errorf("failed to parse agent config: %w", err)
	}

	return &config, nil
}

// loadQueriesConfigFromPath loads the queries.yml file from a custom path
func loadQueriesConfigFromPath(configDir string) (*QueriesConfig, error) {
	configPath := filepath.Join(configDir, "queries.yml")

	data, err := os.ReadFile(configPath)
	if err != nil {
		return nil, fmt.Errorf("failed to read queries config file: %w", err)
	}

	var config QueriesConfig
	if err := yaml.Unmarshal(data, &config); err != nil {
		return nil, fmt.Errorf("failed to parse queries config: %w", err)
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

// UpdateUserEmail updates the user email in agent.conf
func UpdateUserEmail(email string) error {
	configPath := filepath.Join("config", "agent.conf")

	// Read current config
	data, err := os.ReadFile(configPath)
	if err != nil {
		return fmt.Errorf("failed to read agent config file: %w", err)
	}

	var config AgentConfig
	if err := json.Unmarshal(data, &config); err != nil {
		return fmt.Errorf("failed to parse agent config: %w", err)
	}

	// Update email
	config.UserEmail = email

	// Write back to file
	updatedData, err := json.MarshalIndent(config, "", "    ")
	if err != nil {
		return fmt.Errorf("failed to marshal updated config: %w", err)
	}

	if err := os.WriteFile(configPath, updatedData, 0644); err != nil {
		return fmt.Errorf("failed to write updated config: %w", err)
	}

	return nil
}

// GetInterval returns the parsed interval duration with fallback to 1 hour
func (c *Config) GetInterval() time.Duration {
	if c.Agent.Interval == "" {
		return time.Hour // Default fallback
	}

	duration, err := time.ParseDuration(c.Agent.Interval)
	if err != nil {
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
		fmt.Printf("Warning: Invalid log level '%s', using default 'info'\n", c.Agent.LogLevel)
		return "info"
	}
}
