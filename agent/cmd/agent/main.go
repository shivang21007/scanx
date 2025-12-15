package main

import (
	"flag"
	"fmt"
	"log"
	"os"
	"os/signal"
	"syscall"
	"time"

	"scanx/internal/collector"
	"scanx/internal/config"
	"scanx/internal/scheduler"
	"scanx/internal/sender"
	"scanx/internal/utils"
)

// Version is set at build time via ldflags
var Version = "dev"

// STARTUP_DELAY defines how long to wait after system boot before first data collection
// This ensures all system services are fully initialized before collecting data
const STARTUP_DELAY = 5 * time.Minute
const BOOT_DETECTION_WINDOW = 10 * time.Minute

func main() {
	// Parse command line flags
	var (
		daemon     = flag.Bool("daemon", false, "Run as daemon with periodic data collection")
		test       = flag.Bool("test", false, "Test mode: run single data collection and exit")
		configPath = flag.String("config", "", "Custom configuration directory path")
		version    = flag.Bool("version", false, "Print version and exit")
		versionV   = flag.Bool("v", false, "Print version and exit (shorthand)")
	)
	flag.Parse()

	// Handle version flag
	if *version || *versionV {
		fmt.Printf("scanx version %s\n", Version)
		os.Exit(0)
	}

	// Load configuration first (needed for log level)
	var cfg *config.Config
	var err error

	if *configPath != "" {
		cfg, err = config.LoadConfigFromPath(*configPath)
	} else {
		cfg, err = config.LoadConfig()
	}

	if err != nil {
		log.Fatalf("Failed to load configuration: %v", err)
	}

	// Initialize logging with configured level
	if err := utils.InitLogger(cfg.GetLogLevel()); err != nil {
		log.Printf("Warning: Failed to initialize system logger: %v", err)
		log.Println("Continuing with standard logging...")
	}
	defer utils.CloseLogger()

	utils.Info("Agent Configuration Loaded")
	utils.Info("  User Email: %s", cfg.Agent.UserEmail)
	utils.Info("  Scanx Version: %s", cfg.Agent.ScanxVersion)
	utils.Info("  Osqueryi Version: %s", cfg.Agent.OsqueryiVersion)
	utils.Info("  Interval: %s", cfg.Agent.Interval)
	utils.Info("  Log Level: %s", cfg.Agent.LogLevel)

	// Initialize collector
	collector, err := collector.NewCollector(cfg)
	if err != nil {
		utils.Error("Failed to initialize collector: %v", err)
		log.Fatalf("Failed to initialize collector: %v", err)
	}

	// Validate configuration
	if err := collector.ValidateConfiguration(); err != nil {
		utils.Error("Configuration validation failed: %v", err)
		log.Fatalf("Configuration validation failed: %v", err)
	}

	utils.Info("OSQuery Path: %s", collector.GetOSQueryPath())
	utils.Info("System Info: %+v", collector.GetSystemInfo())

	// Test mode: run single collection and backend transmission test
	if *test {
		utils.Info("Running single data collection and transmission test...")
		data, err := collector.CollectData()
		if err != nil {
			utils.Error("Failed to collect data: %v", err)
			log.Fatalf("Failed to collect data: %v", err)
		}

		// Display collected data summary
		collector.LogCollectionSummary(data)

		// Test backend transmission
		utils.Info("📡 Testing backend transmission...")
		backendURL := cfg.GetBackendURL()
		backendSender := sender.NewBackendSender(backendURL)

		// Test connection first
		if err := backendSender.TestConnection(); err != nil {
			utils.Error("❌ Backend connection test failed: %v", err)
		} else {
			utils.Info("✅ Backend connection test successful")
		}

		// Send data
		if err := backendSender.SendAgentData(data); err != nil {
			utils.Error("❌ Failed to send data to backend: %v", err)
		} else {
			utils.Info("✅ Successfully sent data to backend!")
		}

		utils.Info("🎯 Test completed successfully!")
		return
	}

	// Daemon mode: periodic data collection
	if *daemon {
		runDaemon(cfg, collector)
	} else {
		// Default: single run for backward compatibility
		utils.Info("Collecting system data...")
		data, err := collector.CollectData()
		if err != nil {
			utils.Error("Failed to collect data: %v", err)
			log.Fatalf("Failed to collect data: %v", err)
		}

		// Display collected data summary
		collector.LogCollectionSummary(data)

		utils.Info("Agent run completed successfully!")
	}
}

// runDaemon runs the agent in daemon mode with periodic data collection
func runDaemon(cfg *config.Config, collector *collector.Collector) {
	// Create scheduler with configured interval and startup delay
	interval := cfg.GetInterval()
	sch := scheduler.NewScheduler(cfg, collector, interval)

	// Setup signal handling for graceful shutdown
	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)

	var startupDelay time.Duration
	if utils.IsRecentBoot(BOOT_DETECTION_WINDOW) {
		startupDelay = STARTUP_DELAY // System just booted
		utils.Info("🔄 System recently booted - will apply %v startup delay", STARTUP_DELAY)
	} else {
		startupDelay = 0 // Manual restart
		utils.Info("🚀 Manual restart detected - starting immediately without delay")
	}
	go sch.StartWithDelay(startupDelay)

	utils.Info("Agent running in daemon mode with %v interval", interval)
	utils.Info("Press Ctrl+C to stop...")

	// Wait for shutdown signal
	<-sigChan

	utils.Info("Shutdown signal received...")
	sch.Stop()
	utils.Info("Agent stopped gracefully")
}
