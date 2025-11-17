package scheduler

import (
	"context"
	"time"

	"scanx/internal/collector"
	"scanx/internal/config"
	"scanx/internal/sender"
	"scanx/internal/utils"
)

// Scheduler handles periodic data collection and transmission
type Scheduler struct {
	config    *config.Config
	collector *collector.Collector
	sender    *sender.BackendSender
	interval  time.Duration
	ctx       context.Context
	cancel    context.CancelFunc
}

// NewScheduler creates a new scheduler with specified interval
func NewScheduler(cfg *config.Config, collectorInstance *collector.Collector, interval time.Duration) *Scheduler {
	ctx, cancel := context.WithCancel(context.Background())

	// Initialize backend sender
	backendURL := cfg.GetBackendURL()
	backendSender := sender.NewBackendSender(backendURL)

	return &Scheduler{
		config:    cfg,
		collector: collectorInstance,
		sender:    backendSender,
		interval:  interval,
		ctx:       ctx,
		cancel:    cancel,
	}
}

// Start begins periodic data collection and transmission
func (s *Scheduler) Start() {
	utils.Info("Starting data collection scheduler with %v interval", s.interval)

	// Test backend connection first
	if err := s.sender.TestConnection(); err != nil {
		utils.Warning("Backend connection test failed: %v", err)
		utils.Warning("Will continue and retry with each data collection...")
	}

	// Run initial collection immediately
	s.runCollection()

	// Start periodic timer
	ticker := time.NewTicker(s.interval)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			s.runCollection()
		case <-s.ctx.Done():
			utils.Info("Scheduler stopped")
			return
		}
	}
}

// Stop stops the scheduler
func (s *Scheduler) Stop() {
	utils.Info("Stopping scheduler...")
	s.cancel()
}

// runCollection performs a single data collection cycle
func (s *Scheduler) runCollection() {
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
	if err := s.sender.SendAgentData(data); err != nil {
		utils.Error("❌ Failed to send data to backend: %v", err)
		utils.Error("   Data will be lost. Check backend connectivity.")
	} else {
		utils.Info("🎯 Data collection and transmission cycle completed successfully")
	}
}
