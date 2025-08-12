package sender

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"mdm-agent/internal/collector"
	"mdm-agent/internal/config"
	"mdm-agent/internal/utils"
)

// BackendSender handles sending data to the MDM backend
type BackendSender struct {
	baseURL    string
	httpClient *http.Client
	userAgent  string
}

// SendResponse represents the backend response
type SendResponse struct {
	Message   string `json:"message"`
	DeviceID  int    `json:"device_id"`
	Timestamp string `json:"timestamp"`
}

// NewBackendSender creates a new backend sender
func NewBackendSender(baseURL string) *BackendSender {
	return &BackendSender{
		baseURL: baseURL,
		httpClient: &http.Client{
			Timeout: 30 * time.Second,
		},
		userAgent: "MDM-Agent/1.0",
	}
}

// SendAgentData sends collected data to the backend
func (s *BackendSender) SendAgentData(data *collector.CollectedData) error {
	// Prepare the payload
	jsonData, err := json.Marshal(data)
	if err != nil {
		return fmt.Errorf("failed to marshal agent data: %w", err)
	}

	// Create the request
	url := fmt.Sprintf("%s/api/devices/agent/report", s.baseURL)
	req, err := http.NewRequest("POST", url, bytes.NewBuffer(jsonData))
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}

	// Set headers
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("User-Agent", s.userAgent)

	utils.Debug("Sending agent data to backend: %s", url)
	utils.Debug("Payload size: %d bytes", len(jsonData))

	// Send the request
	resp, err := s.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("failed to send request: %w", err)
	}
	defer resp.Body.Close()

	// Check response status
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("backend returned error status: %d", resp.StatusCode)
	}

	// Parse response
	var sendResponse SendResponse
	if err := json.NewDecoder(resp.Body).Decode(&sendResponse); err != nil {
		utils.Warning("Failed to parse backend response: %v", err)
		// Don't fail on parse error, the data was still sent successfully
		return nil
	}

	utils.Info("✅ Successfully sent agent data to backend")
	utils.Info("   Device ID: %d", sendResponse.DeviceID)
	utils.Info("   Backend timestamp: %s", sendResponse.Timestamp)

	return nil
}

// TestConnection tests connectivity to the backend
func (s *BackendSender) TestConnection() error {
	url := fmt.Sprintf("%s/health", s.baseURL)

	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return fmt.Errorf("failed to create test request: %w", err)
	}

	req.Header.Set("User-Agent", s.userAgent)

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("failed to connect to backend: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("backend health check failed with status: %d", resp.StatusCode)
	}

	utils.Info("✅ Backend connection test successful")
	return nil
}

// GetBackendURLFromConfig returns the backend URL from configuration
func GetBackendURLFromConfig(cfg *config.Config) string {
	if cfg.Agent.BackendURL != "" {
		return cfg.Agent.BackendURL
	}
	// Fallback to default URL if not configured
	return "http://172.0.10.183:3000"
}
