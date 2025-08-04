package main

import (
	"flag"
	"fmt"
	"log"
	"os"
	"os/signal"
	"runtime"
	"syscall"

	"mdm-agent/internal/collector"
	"mdm-agent/internal/config"
	"mdm-agent/internal/scheduler"
	"mdm-agent/internal/sender"
	"mdm-agent/internal/utils"
)

func main() {
	// Parse command line flags
	var (
		email   = flag.String("email", "", "Employee email for device identification")
		install = flag.Bool("install", false, "Install mode: generate config files and setup")
		daemon  = flag.Bool("daemon", false, "Run as daemon with periodic data collection")
		test    = flag.Bool("test", false, "Test mode: run single data collection and exit")
	)
	flag.Parse()

	// Installation mode: generate config files
	if *install {
		if err := installAgent(*email); err != nil {
			log.Fatalf("Installation failed: %v", err)
		}
		fmt.Println("Agent installation completed successfully!")
		return
	}

	// If email provided, update configuration and exit
	if *email != "" {
		if err := config.UpdateUserEmail(*email); err != nil {
			log.Fatalf("Failed to update user email: %v", err)
		}
		fmt.Printf("Successfully updated user email to: %s\n", *email)
		return
	}

	// Load configuration first (needed for log level)
	cfg, err := config.LoadConfig()
	if err != nil {
		log.Fatalf("Failed to load configuration: %v", err)
	}

	// Initialize logging with configured level
	if err := utils.InitLoggerWithLevel(cfg.GetLogLevel()); err != nil {
		log.Printf("Warning: Failed to initialize system logger: %v", err)
		log.Println("Continuing with standard logging...")
	}
	defer utils.CloseLogger()

	utils.Info("Agent Configuration Loaded")
	utils.Info("  User Email: %s", cfg.Agent.UserEmail)
	utils.Info("  Version: %s", cfg.Agent.Version)
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
		utils.Info("Data Collection Summary:")
		utils.Info("  User: %s", data.User)
		utils.Info("  OS Type: %s", data.OSType)
		utils.Info("  OS Version: %s", data.OSVersion)
		utils.Info("  Serial No: %s", data.SerialNo)
		utils.Info("  Timestamp: %s", data.Timestamp)
		utils.Info("  Queries executed: %d", len(data.Data))

		for queryName, results := range data.Data {
			utils.Info("    %s: %d records", queryName, len(results))
		}

		// Test backend transmission
		utils.Info("📡 Testing backend transmission...")
		backendURL := "http://localhost:3000" // Default backend URL
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
		utils.Info("Data Collection Summary:")
		utils.Info("  User: %s", data.User)
		utils.Info("  OS Type: %s", data.OSType)
		utils.Info("  OS Version: %s", data.OSVersion)
		utils.Info("  Serial No: %s", data.SerialNo)
		utils.Info("  Timestamp: %s", data.Timestamp)
		utils.Info("  Queries executed: %d", len(data.Data))

		for queryName, results := range data.Data {
			utils.Info("    %s: %d records", queryName, len(results))
		}

		utils.Info("Agent run completed successfully!")
	}
}

// runDaemon runs the agent in daemon mode with periodic data collection
func runDaemon(cfg *config.Config, collector *collector.Collector) {
	// Create scheduler with configured interval
	interval := cfg.GetInterval()
	sch := scheduler.NewScheduler(cfg, collector, interval)

	// Setup signal handling for graceful shutdown
	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)

	// Start scheduler in goroutine
	go sch.Start()

	utils.Info("Agent running in daemon mode with %v interval", interval)
	utils.Info("Press Ctrl+C to stop...")

	// Wait for shutdown signal
	<-sigChan

	utils.Info("Shutdown signal received...")
	sch.Stop()
	utils.Info("Agent stopped gracefully")
}

// installAgent handles the installation process
func installAgent(email string) error {
	fmt.Println("Installing MDM Agent...")

	// Check if osquery is installed
	runner := &collector.OSQueryRunner{}
	expectedPath := getExpectedOSQueryPath()
	if !runner.IsExecutable(expectedPath) {
		fmt.Printf("WARNING: OSQuery not found at expected path: %s\n", expectedPath)
		fmt.Println("Please install osquery before running the agent:")
		switch runtime.GOOS {
		case "darwin":
			fmt.Println("  brew install osquery")
		case "linux":
			fmt.Println("  # Follow instructions at https://osquery.io/downloads/linux")
		case "windows":
			fmt.Println("  # Download and install from https://osquery.io/downloads/windows")
		}
	} else {
		fmt.Printf("OSQuery found at: %s ✓\n", expectedPath)
	}

	// Generate config files at system location
	if err := os.MkdirAll("config", 0755); err != nil {
		return fmt.Errorf("failed to create config directory: %w", err)
	}

	// Update email if provided
	if email != "" {
		if err := config.UpdateUserEmail(email); err != nil {
			return fmt.Errorf("failed to set user email: %w", err)
		}
		fmt.Printf("Set user email to: %s\n", email)
	}

	// TODO: Copy binary to system location (e.g., /usr/local/bin/, C:\Program Files\)
	// TODO: Create system service/daemon
	// TODO: Set appropriate permissions

	fmt.Println("Configuration files generated at current location")
	fmt.Println("Note: In production, these should be at system paths like /etc/mdm-agent/")

	return nil
}

// getExpectedOSQueryPath returns the expected osquery installation path
func getExpectedOSQueryPath() string {
	switch runtime.GOOS {
	case "windows":
		return `C:\Program Files\osquery\osqueryi.exe`
	case "darwin", "linux":
		return "/usr/local/bin/osqueryi"
	default:
		return "/usr/local/bin/osqueryi"
	}
}
