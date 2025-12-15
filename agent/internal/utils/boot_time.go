package utils

import (
	"os/exec"
	"runtime"
	"strconv"
	"strings"
	"time"
)

// GetSystemBootTime returns the time when the system was last booted
func GetSystemBootTime() (time.Time, error) {
	switch runtime.GOOS {
	case "darwin":
		return getBootTimeMacOS()
	case "linux":
		return getBootTimeLinux()
	case "windows":
		return getBootTimeWindows()
	default:
		// Fallback: return zero time (will be treated as "unknown")
		return time.Time{}, nil
	}
}

// IsRecentBoot checks if the system booted within the specified duration
func IsRecentBoot(within time.Duration) bool {
	bootTime, err := GetSystemBootTime()
	if err != nil {
		// If we can't determine boot time, assume it's not a recent boot
		// This ensures we don't unnecessarily delay on manual restarts
		Debug("Failed to get boot time: %v (assuming not recent boot)", err)
		return false
	}

	timeSinceBoot := time.Since(bootTime)
	isRecent := timeSinceBoot <= within

	Debug("System boot time: %v (uptime: %v, recent boot: %v)",
		bootTime.Format("2006-01-02 15:04:05"),
		timeSinceBoot.Round(time.Second),
		isRecent)

	return isRecent
}

// getBootTimeMacOS gets boot time on macOS using sysctl
func getBootTimeMacOS() (time.Time, error) {
	cmd := exec.Command("sysctl", "-n", "kern.boottime")
	output, err := cmd.Output()
	if err != nil {
		return time.Time{}, err
	}

	// Parse output like: { sec = 1670000000, usec = 123456 } Sat Dec 03 00:00:00 2022
	outputStr := strings.TrimSpace(string(output))

	// Extract seconds from "{ sec = 1670000000, usec = 123456 }"
	if strings.Contains(outputStr, "sec =") {
		parts := strings.Split(outputStr, "sec =")
		if len(parts) > 1 {
			secPart := strings.TrimSpace(strings.Split(parts[1], ",")[0])
			sec, err := strconv.ParseInt(secPart, 10, 64)
			if err == nil {
				return time.Unix(sec, 0), nil
			}
		}
	}

	return time.Time{}, nil
}

// getBootTimeLinux gets boot time on Linux using /proc/uptime
func getBootTimeLinux() (time.Time, error) {
	cmd := exec.Command("cat", "/proc/uptime")
	output, err := cmd.Output()
	if err != nil {
		return time.Time{}, err
	}

	// /proc/uptime format: "12345.67 67890.12"
	// First number is uptime in seconds
	uptimeStr := strings.TrimSpace(strings.Split(string(output), " ")[0])
	uptimeFloat, err := strconv.ParseFloat(uptimeStr, 64)
	if err != nil {
		return time.Time{}, err
	}

	uptime := time.Duration(uptimeFloat * float64(time.Second))
	bootTime := time.Now().Add(-uptime)

	return bootTime, nil
}

// getBootTimeWindows gets boot time on Windows using systeminfo
func getBootTimeWindows() (time.Time, error) {
	// Try WMI first (faster and more reliable)
	cmd := exec.Command("wmic", "os", "get", "LastBootUpTime", "/value")
	output, err := cmd.Output()
	if err == nil {
		// Parse output like: LastBootUpTime=20231203120000.123456+000
		outputStr := strings.TrimSpace(string(output))
		if strings.Contains(outputStr, "LastBootUpTime=") {
			parts := strings.Split(outputStr, "=")
			if len(parts) > 1 {
				timeStr := strings.TrimSpace(parts[1])
				// Parse WMI datetime format: YYYYMMDDHHmmss.microseconds+timezone
				if len(timeStr) >= 14 {
					year, _ := strconv.Atoi(timeStr[0:4])
					month, _ := strconv.Atoi(timeStr[4:6])
					day, _ := strconv.Atoi(timeStr[6:8])
					hour, _ := strconv.Atoi(timeStr[8:10])
					min, _ := strconv.Atoi(timeStr[10:12])
					sec, _ := strconv.Atoi(timeStr[12:14])

					bootTime := time.Date(year, time.Month(month), day, hour, min, sec, 0, time.Local)
					return bootTime, nil
				}
			}
		}
	}

	// Fallback: try systeminfo (slower but widely available)
	cmd = exec.Command("systeminfo")
	output, err = cmd.Output()
	if err != nil {
		return time.Time{}, err
	}

	// Parse systeminfo output for "System Boot Time:"
	lines := strings.Split(string(output), "\n")
	for _, line := range lines {
		if strings.Contains(line, "System Boot Time:") {
			parts := strings.Split(line, ":")
			if len(parts) > 1 {
				timeStr := strings.TrimSpace(strings.Join(parts[1:], ":"))
				// Try common Windows date formats
				formats := []string{
					"1/2/2006, 3:04:05 PM",
					"2/1/2006, 15:04:05",
					"1/2/2006 3:04:05 PM",
				}
				for _, format := range formats {
					if bootTime, err := time.Parse(format, timeStr); err == nil {
						return bootTime, nil
					}
				}
			}
		}
	}

	return time.Time{}, nil
}
