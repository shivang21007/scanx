package scheduler

import (
	"time"
)

// Common time intervals for scheduling
const (
	// DefaultInterval is the hardcoded 1-hour interval as requested
	DefaultInterval = time.Hour

	// Other useful intervals for future use
	FiveMinutes    = 5 * time.Minute
	FifteenMinutes = 15 * time.Minute
	ThirtyMinutes  = 30 * time.Minute
	TwoHours       = 2 * time.Hour
	SixHours       = 6 * time.Hour
	TwelveHours    = 12 * time.Hour
	Daily          = 24 * time.Hour
)

// ParseInterval parses a duration string with fallback to default
func ParseInterval(intervalStr string) time.Duration {
	if intervalStr == "" {
		return DefaultInterval
	}

	duration, err := time.ParseDuration(intervalStr)
	if err != nil {
		return DefaultInterval
	}

	return duration
}
