package updater

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"scanx/internal/config"
	"scanx/internal/utils"
	"time"
)

// IntervalUpdater handles interval updates from backend
type IntervalUpdater struct {
	config     *config.Config
	httpClient *http.Client
	baseURL    string
	deviceID   int
}

// NewIntervalUpdater creates a new interval updater
func NewIntervalUpdater(cfg *config.Config, deviceID int) *IntervalUpdater {
	return &IntervalUpdater{
		config: cfg,
		httpClient: &http.Client{
			Timeout: 10 * time.Second,
		},
		baseURL:  cfg.GetBackendURL(),
		deviceID: deviceID,
	}
}

// UpdateInterval updates the agent.conf with new interval and returns success status
func (iu *IntervalUpdater) UpdateInterval(newInterval string, requestID int) error {
	utils.Info("🔄 Updating interval to: %s (request_id: %d)", newInterval, requestID)

	// Find config file path
	configPath := iu.findConfigPath()
	if configPath == "" {
		return fmt.Errorf("could not locate agent.conf file")
	}

	// Read current config
	data, err := os.ReadFile(configPath)
	if err != nil {
		return fmt.Errorf("failed to read config file: %w", err)
	}

	// Parse JSON
	var agentConfig config.AgentConfig
	if err := json.Unmarshal(data, &agentConfig); err != nil {
		return fmt.Errorf("failed to parse config: %w", err)
	}

	// Update interval
	oldInterval := agentConfig.Interval
	agentConfig.Interval = newInterval

	// Write back to file
	updatedData, err := json.MarshalIndent(agentConfig, "", "    ")
	if err != nil {
		return fmt.Errorf("failed to marshal config: %w", err)
	}

	if err := os.WriteFile(configPath, updatedData, 0644); err != nil {
		return fmt.Errorf("failed to write config file: %w", err)
	}

	utils.Info("✅ Updated interval in config: %s -> %s", oldInterval, newInterval)

	// Send confirmation to backend
	if err := iu.SendConfirmation(requestID, true, newInterval, ""); err != nil {
		utils.Warning("Failed to send interval update confirmation: %v", err)
		// Don't fail the update if confirmation fails
	}

	return nil
}

// SendConfirmation sends confirmation to backend
func (iu *IntervalUpdater) SendConfirmation(requestID int, success bool, currentInterval, errorMessage string) error {
	payload := map[string]interface{}{
		"device_id":        iu.deviceID,
		"request_id":       requestID,
		"success":          success,
		"current_interval": currentInterval,
	}

	if errorMessage != "" {
		payload["error_message"] = errorMessage
	}

	jsonData, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("failed to marshal confirmation: %w", err)
	}

	url := fmt.Sprintf("%s/api/devices/agent/interval-confirm", iu.baseURL)
	req, err := http.NewRequest("POST", url, bytes.NewBuffer(jsonData))
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")

	resp, err := iu.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("failed to send request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("backend returned error status: %d", resp.StatusCode)
	}

	utils.Info("✅ Interval update confirmation sent to backend")
	return nil
}

// findConfigPath finds the agent.conf file
func (iu *IntervalUpdater) findConfigPath() string {
	candidateDirs := []string{
		"config",
		"/etc/scanx/config",
		"C:\\Program Files (x86)\\scanx\\config",
		"C:\\Program Files\\scanx\\config",
	}

	for _, dir := range candidateDirs {
		configPath := filepath.Join(dir, "agent.conf")
		if _, err := os.Stat(configPath); err == nil {
			return configPath
		}
	}

	return ""
}
