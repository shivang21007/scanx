package utils

import (
	"fmt"
	"io"
	"log"
	"os"
	"path/filepath"
	"runtime"
)

// LogLevel represents the logging level
type LogLevel int

const (
	LogLevelError LogLevel = iota
	LogLevelWarning
	LogLevelInfo
	LogLevelDebug
)

// Logger handles system logging for the MDM agent
type Logger struct {
	debugLogger   *log.Logger
	infoLogger    *log.Logger
	warningLogger *log.Logger
	errorLogger   *log.Logger
	logFile       *os.File
	level         LogLevel
}

var GlobalLogger *Logger

// InitLogger initializes the global logger with system paths
func InitLogger() error {
	logger, err := NewLogger("info")
	if err != nil {
		return fmt.Errorf("failed to initialize logger: %w", err)
	}

	GlobalLogger = logger
	return nil
}

// InitLoggerWithLevel initializes the global logger with specified level
func InitLoggerWithLevel(levelStr string) error {
	logger, err := NewLogger(levelStr)
	if err != nil {
		return fmt.Errorf("failed to initialize logger: %w", err)
	}

	GlobalLogger = logger
	return nil
}

// parseLogLevel converts string to LogLevel
func parseLogLevel(levelStr string) LogLevel {
	switch levelStr {
	case "debug":
		return LogLevelDebug
	case "info":
		return LogLevelInfo
	case "warning":
		return LogLevelWarning
	case "error":
		return LogLevelError
	default:
		return LogLevelInfo
	}
}

// NewLogger creates a new logger instance
func NewLogger(levelStr string) (*Logger, error) {
	// Try to create log file at system location
	logPath := getSystemLogPath()

	// Ensure log directory exists
	if err := ensureLogDir(logPath); err != nil {
		// Fallback to current directory if system path fails
		logPath = "./mdmagent.log"
		fmt.Printf("Warning: Could not create system log directory, using fallback: %s\n", logPath)
	}

	// Open log file
	logFile, err := os.OpenFile(logPath, os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0644)
	if err != nil {
		// Final fallback: log to current directory
		logPath = "./mdmagent.log"
		logFile, err = os.OpenFile(logPath, os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0644)
		if err != nil {
			return nil, fmt.Errorf("failed to open log file: %w", err)
		}
		fmt.Printf("Warning: Using fallback log file: %s\n", logPath)
	}

	// Create multi-writer for both file and console
	multiWriter := io.MultiWriter(os.Stdout, logFile)

	logger := &Logger{
		debugLogger:   log.New(multiWriter, "DEBUG: ", 0), // We'll add timestamp manually
		infoLogger:    log.New(multiWriter, "INFO: ", 0),
		warningLogger: log.New(multiWriter, "WARNING: ", 0),
		errorLogger:   log.New(multiWriter, "ERROR: ", 0),
		logFile:       logFile,
		level:         parseLogLevel(levelStr),
	}

	logger.Info("Logger initialized successfully at: %s", logPath)
	return logger, nil
}

// getSystemLogPath returns the appropriate system log path for each platform
func getSystemLogPath() string {
	switch runtime.GOOS {
	case "windows":
		return `C:\ProgramData\MDMAgent\logs\mdmagent.log`
	case "darwin", "linux":
		return "/var/log/mdmagent/mdmagent.log"
	default:
		return "/var/log/mdmagent/mdmagent.log"
	}
}

// ensureLogDir creates the log directory if it doesn't exist
func ensureLogDir(logPath string) error {
	logDir := filepath.Dir(logPath)

	// Check if directory exists
	if _, err := os.Stat(logDir); os.IsNotExist(err) {
		// Try to create directory with appropriate permissions
		if err := os.MkdirAll(logDir, 0755); err != nil {
			return fmt.Errorf("failed to create log directory %s: %w", logDir, err)
		}
	}

	return nil
}

// Debug logs a debug message with IST timestamp
func (l *Logger) Debug(format string, v ...interface{}) {
	if l.level >= LogLevelDebug {
		timestampedFormat := FormatISTForLog(GetCurrentIST()) + " " + format
		l.debugLogger.Printf(timestampedFormat, v...)
	}
}

// Info logs an informational message with IST timestamp
func (l *Logger) Info(format string, v ...interface{}) {
	if l.level >= LogLevelInfo {
		timestampedFormat := FormatISTForLog(GetCurrentIST()) + " " + format
		l.infoLogger.Printf(timestampedFormat, v...)
	}
}

// Warning logs a warning message with IST timestamp
func (l *Logger) Warning(format string, v ...interface{}) {
	if l.level >= LogLevelWarning {
		timestampedFormat := FormatISTForLog(GetCurrentIST()) + " " + format
		l.warningLogger.Printf(timestampedFormat, v...)
	}
}

// Error logs an error message with IST timestamp
func (l *Logger) Error(format string, v ...interface{}) {
	if l.level >= LogLevelError {
		timestampedFormat := FormatISTForLog(GetCurrentIST()) + " " + format
		l.errorLogger.Printf(timestampedFormat, v...)
	}
}

// Close closes the log file
func (l *Logger) Close() error {
	if l.logFile != nil {
		return l.logFile.Close()
	}
	return nil
}

// Global convenience functions that use the global logger
func Debug(format string, v ...interface{}) {
	if GlobalLogger != nil {
		GlobalLogger.Debug(format, v...)
	} else {
		log.Printf("DEBUG: "+format, v...)
	}
}

func Info(format string, v ...interface{}) {
	if GlobalLogger != nil {
		GlobalLogger.Info(format, v...)
	} else {
		log.Printf("INFO: "+format, v...)
	}
}

func Warning(format string, v ...interface{}) {
	if GlobalLogger != nil {
		GlobalLogger.Warning(format, v...)
	} else {
		log.Printf("WARNING: "+format, v...)
	}
}

func Error(format string, v ...interface{}) {
	if GlobalLogger != nil {
		GlobalLogger.Error(format, v...)
	} else {
		log.Printf("ERROR: "+format, v...)
	}
}

// CloseLogger closes the global logger
func CloseLogger() {
	if GlobalLogger != nil {
		GlobalLogger.Close()
	}
}
