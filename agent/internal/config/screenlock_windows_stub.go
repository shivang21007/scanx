//go:build !windows
// +build !windows

package config

import (
	"fmt"
)

// CollectWindowsScreenLock is a stub for non-Windows platforms
// This function should never be called on non-Windows systems
func CollectWindowsScreenLock(osqueryPath, installDir string) ([]map[string]interface{}, error) {
	return nil, fmt.Errorf("CollectWindowsScreenLock is only available on Windows")
}
