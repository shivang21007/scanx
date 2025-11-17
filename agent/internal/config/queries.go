package config

// GetPasswordManagerApps returns the list of allowed password manager apps per platform
func GetPasswordManagerApps(platform string) []string {
	passwordManagers := map[string][]string{
		"darwin": {
			"MacPass", "KeePassXC", "KeePass", "1Password", "LastPass",
		},
		"windows": {
			"KeePassXC", "KeePass", "1Password",
		},
		"linux": {
			"KeePassXC", "KeePass", "keepassxc", "keepass", "1Password",
			"Bitwarden", "bitwarden", "LastPass", "lastpass",
		},
	}

	if apps, exists := passwordManagers[platform]; exists {
		return apps
	}
	return []string{}
}

// GetQueriesConfig returns the hardcoded queries configuration
func GetQueriesConfig() *QueriesConfig {
	return &QueriesConfig{
		Platform: map[string]PlatformQueries{
		"darwin": {
			"system_info": {
				Query:       "SELECT s.*, o.version as os_version FROM system_info s, os_version o;",
				Description: "System information with OS version",
			},
			"disk_encryption_info": {
				Query:       "SELECT CASE WHEN COUNT(*) > 0 THEN 'true' ELSE 'false' END AS disk_encryption FROM disk_encryption WHERE uid != '' AND encrypted = '1';",
				Description: "Disk encryption information for macOS",
			},
			"screen_lock_info": {
				Query:       "SELECT CASE WHEN enabled = '1' THEN 'true' ELSE 'false' END AS screen_lock, grace_period FROM screenlock;",
				Description: "Screen lock information for macOS",
			},
			"antivirus_info": {
				Query:       "SELECT CASE WHEN (SELECT assessments_enabled FROM gatekeeper LIMIT 1) = 1 THEN 'true' WHEN (SELECT global_state FROM alf LIMIT 1) = 1 THEN 'true' ELSE 'false' END AS antivirus_info;",
				Description: "Gatekeeper information for macOS",
			},
			"apps_info": {
				Query:       "SELECT bundle_identifier, bundle_name AS name, bundle_version, display_name FROM apps;",
				Description: "Installed apps information",
			},
		},
		"windows": {
			"system_info": {
				Query:       "SELECT s.*, o.version as os_version FROM system_info s, os_version o;",
				Description: "System information with OS version",
			},
			"screen_lock_info": {
				Query:       "WINDOWS_SPECIAL_HANDLER",
				Description: "Screen lock information (requires registry hive mounting)",
			},
			"disk_encryption_info": {
				Query:       "SELECT CASE WHEN COUNT(*) > 0 THEN 'true' ELSE 'false' END AS disk_encryption FROM bitlocker_info WHERE protection_status = 1 OR percentage_encrypted > 0;",
				Description: "Disk encryption information",
			},
			"antivirus_info": {
				Query:       "SELECT CASE WHEN antivirus = 'Good' THEN 'true' ELSE 'false' END AS antivirus_info FROM windows_security_center;",
				Description: "this is antivirus info .",
			},
			"apps_info": {
				Query:       "SELECT name, version, publisher, install_date FROM programs;",
				Description: "list all prgrams",
			},
		},
			"linux": {
				"system_info": {
					Query:       "SELECT s.*, o.version as os_version FROM system_info s, os_version o;",
					Description: "System information with OS version",
				},
				"disk_encryption_info": {
					Query:       "SELECT CASE WHEN COUNT(*) > 0 THEN 'true' ELSE 'false' END AS disk_encryption FROM disk_encryption WHERE uid != '' AND encrypted = '1';",
					Description: "Disk encryption information",
				},
			},
		},
	}
}
