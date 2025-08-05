package utils

import (
	"time"
)

// IST represents India Standard Time timezone
var IST *time.Location

func init() {
	// Load IST timezone (UTC+5:30)
	var err error
	IST, err = time.LoadLocation("Asia/Kolkata")
	if err != nil {
		// Fallback: create fixed offset timezone if Asia/Kolkata not available
		IST = time.FixedZone("IST", 5*3600+30*60) // +05:30
	}
}

// GetCurrentIST returns current time in IST
func GetCurrentIST() time.Time {
	return time.Now().In(IST)
}

// UTCToIST converts UTC time to IST
func UTCToIST(utcTime time.Time) time.Time {
	return utcTime.In(IST)
}

// ISTToUTC converts IST time to UTC
func ISTToUTC(istTime time.Time) time.Time {
	return istTime.UTC()
}

// GetCurrentISTString returns current IST time in RFC3339 format
func GetCurrentISTString() string {
	return GetCurrentIST().Format(time.RFC3339)
}

// FormatISTForDisplay returns IST time in human readable format
// Format: DD/MM/YYYY HH:mm:ss IST
func FormatISTForDisplay(istTime time.Time) string {
	return istTime.Format("02/01/2006 15:04:05 IST")
}

// FormatISTForLog returns IST time for logging
// Format: YYYY-MM-DD HH:mm:ss IST
func FormatISTForLog(istTime time.Time) string {
	return istTime.Format("2006-01-02 15:04:05 IST")
}

// ParseToIST parses time string and converts to IST
func ParseToIST(timeStr string) (time.Time, error) {
	t, err := time.Parse(time.RFC3339, timeStr)
	if err != nil {
		return time.Time{}, err
	}
	return t.In(IST), nil
}
