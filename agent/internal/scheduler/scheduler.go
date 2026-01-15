package scheduler

import (
	"context"
	"fmt"
	"time"

	"scanx/internal/collector"
	"scanx/internal/config"
	"scanx/internal/sender"
	"scanx/internal/updater"
	"scanx/internal/utils"
)

// Scheduler handles periodic data collection and transmission
type Scheduler struct {
	config          *config.Config
	collector       *collector.Collector
	sender          *sender.BackendSender
	updater         *updater.Updater
	intervalUpdater *updater.IntervalUpdater
	interval        time.Duration
	ticker          *time.Ticker
	ctx             context.Context
	cancel          context.CancelFunc
	deviceID        int
}

// NewScheduler creates a new scheduler with specified interval
func NewScheduler(cfg *config.Config, collectorInstance *collector.Collector, interval time.Duration) *Scheduler {
	ctx, cancel := context.WithCancel(context.Background())

	// Initialize backend sender
	backendURL := cfg.GetBackendURL()
	backendSender := sender.NewBackendSender(backendURL)

	// Initialize updater
	updateChecker, err := updater.NewUpdater(cfg)
	if err != nil {
		utils.Warning("Failed to initialize updater: %v", err)
		updateChecker = nil
	}

	// Initialize interval updater (deviceID will be set after first data send)
	intervalUpdater := updater.NewIntervalUpdater(cfg, 0)

	return &Scheduler{
		config:          cfg,
		collector:       collectorInstance,
		sender:          backendSender,
		updater:         updateChecker,
		intervalUpdater: intervalUpdater,
		interval:        interval,
		ctx:             ctx,
		cancel:          cancel,
		deviceID:        0, // Will be set after first successful data send
	}
}

// Start begins periodic data collection and transmission (immediately, no startup delay)
func (s *Scheduler) Start() {
	s.start(0)
}

// StartWithDelay begins periodic data collection and transmission after a startup delay
func (s *Scheduler) StartWithDelay(startupDelay time.Duration) {
	s.start(startupDelay)
}

// start is the internal implementation that supports both immediate and delayed starts
func (s *Scheduler) start(startupDelay time.Duration) {
	utils.Info("Starting data collection scheduler with %v interval", s.interval)

	// Apply startup delay if specified (only when system recently booted)
	if startupDelay > 0 {
		utils.Info("⏰ Applying startup delay: waiting %v before first data collection", startupDelay)
		utils.Info("   This allows system services to fully initialize after boot")

		// Wait for startup delay with cancellation support
		select {
		case <-time.After(startupDelay):
			utils.Info("✅ Startup delay completed - proceeding with data collection")
		case <-s.ctx.Done():
			utils.Info("Scheduler stopped during startup delay")
			return
		}
	}

	// Test backend connection first
	if err := s.sender.TestConnection(); err != nil {
		utils.Warning("Backend connection test failed: %v", err)
		utils.Warning("Will continue and retry with each data collection...")
	}

	// Run initial collection after startup delay
	s.runCollection()

	// Start periodic timer for subsequent collections
	s.ticker = time.NewTicker(s.interval)

	for {
		select {
		case <-s.ticker.C:
			s.runCollection()
		case <-s.ctx.Done():
			utils.Info("Scheduler stopped")
			if s.ticker != nil {
				s.ticker.Stop()
			}
			return
		}
	}
}

// Stop stops the scheduler
func (s *Scheduler) Stop() {
	utils.Info("Stopping scheduler...")
	if s.ticker != nil {
		s.ticker.Stop()
	}
	s.cancel()
}

// runCollection performs a single data collection cycle
func (s *Scheduler) runCollection() {
	// Check for updates FIRST (before collecting data)
	// This ensures we collect data with the latest version
	if s.updater != nil {
		utils.Info("🔍 Checking for updates...")
		if err := s.updater.PerformUpdate(); err != nil {
			utils.Warning("Update check/install failed: %v", err)
			// Continue with data collection even if update fails
		}
	}

	utils.Info("Starting data collection at %v", utils.GetCurrentISTString())

	// Collect data
	data, err := s.collector.CollectData()
	if err != nil {
		utils.Error("Error collecting data: %v", err)
		return
	}

	// Display collection summary
	s.collector.LogCollectionSummary(data)

	// Send data to backend server
	utils.Info("📡 Sending data to backend...")
	response, err := s.sender.SendAgentData(data)
	if err != nil {
		utils.Error("❌ Failed to send data to backend: %v", err)
		utils.Error("   Data will be lost. Check backend connectivity.")
		return
	}

	// Update deviceID if we got a response (needed for interval updater)
	if response != nil && response.DeviceID > 0 {
		s.deviceID = response.DeviceID
		// Update interval updater with deviceID
		if s.intervalUpdater != nil {
			s.intervalUpdater = updater.NewIntervalUpdater(s.config, response.DeviceID)
		}
	}

	// Check for interval update in response
	if response != nil && response.IntervalUpdate != nil {
		utils.Info("🔄 Interval update received: %s", response.IntervalUpdate.NewInterval)

		// Parse new interval
		newInterval, err := time.ParseDuration(response.IntervalUpdate.NewInterval)
		if err != nil {
			utils.Error("❌ Invalid interval format: %v", err)
			// Send failure confirmation
			if s.intervalUpdater != nil {
				s.intervalUpdater.SendConfirmation(
					response.IntervalUpdate.RequestID,
					false,
					s.config.Agent.Interval,
					fmt.Sprintf("Invalid interval format: %v", err),
				)
			}
		} else {
			// Update config file
			if s.intervalUpdater != nil {
				if err := s.intervalUpdater.UpdateInterval(
					response.IntervalUpdate.NewInterval,
					response.IntervalUpdate.RequestID,
				); err != nil {
					utils.Error("❌ Failed to update interval: %v", err)
					// Send failure confirmation
					s.intervalUpdater.SendConfirmation(
						response.IntervalUpdate.RequestID,
						false,
						s.config.Agent.Interval,
						err.Error(),
					)
				} else {
					// Update scheduler interval
					if err := s.UpdateInterval(newInterval); err != nil {
						utils.Error("❌ Failed to update scheduler interval: %v", err)
					} else {
						// Update config in memory
						s.config.Agent.Interval = response.IntervalUpdate.NewInterval
						utils.Info("✅ Interval updated successfully: %s", response.IntervalUpdate.NewInterval)
					}
				}
			}
		}
	}

	utils.Info("🎯 Data collection and transmission cycle completed successfully")
}

// UpdateInterval updates the scheduler interval and restarts the ticker
func (s *Scheduler) UpdateInterval(newInterval time.Duration) error {
	utils.Info("🔄 Updating scheduler interval: %v -> %v", s.interval, newInterval)

	// Stop current ticker
	if s.ticker != nil {
		s.ticker.Stop()
	}

	// Update interval
	s.interval = newInterval

	// Create new ticker with updated interval
	s.ticker = time.NewTicker(s.interval)

	utils.Info("✅ Scheduler interval updated to: %v", newInterval)
	return nil
}
