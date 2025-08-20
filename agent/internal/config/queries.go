package config

// GetQueriesConfig returns the hardcoded queries configuration
func GetQueriesConfig() *QueriesConfig {
	return &QueriesConfig{
		Platform: map[string]PlatformQueries{
			"darwin": {
				"system_info": {
					Query:       "SELECT s.*, o.version as os_version FROM system_info s, os_version o;",
					Description: "System information with OS version",
				},
				"screen_lock_info": {
					Query:       "SELECT CASE WHEN enabled = '1' THEN 'true' ELSE 'false' END AS screen_lock, grace_period FROM screenlock WHERE enabled IS NOT NULL;",
					Description: "Screen lock information for macOS",
				},
				"disk_encryption_info": {
					Query:       "SELECT CASE WHEN COUNT(*) > 0 THEN 'true' ELSE 'false' END AS disk_encryption FROM disk_encryption WHERE uid != '' AND encrypted = '1';",
					Description: "Disk encryption information for macOS",
				},
				"password_manager_info": {
					Query:       "SELECT CASE WHEN COUNT(*) > 0 THEN 'true' ELSE 'false' END AS password_manager FROM apps WHERE bundle_name IN ('MacPass','KeyPassXC','KeyPass');",
					Description: "Password manager information for macOS",
				},
				"antivirus_info": {
					Query:       "SELECT CASE WHEN (SELECT assessments_enabled FROM gatekeeper LIMIT 1) = 1 THEN 'true' WHEN (SELECT global_state FROM alf LIMIT 1) = 1 THEN 'true' ELSE 'false' END AS antivirus_info;",
					Description: "Gatekeeper information for macOS",
				},
				"apps_info": {
					Query:       "SELECT bundle_identifier, bundle_name, bundle_short_version, bundle_version, category, display_name, last_opened_time, minimum_system_version FROM apps;",
					Description: "Installed apps information",
				},
			},
			"windows": {
				"system_info": {
					Query:       "SELECT s.*, o.version as os_version FROM system_info s, os_version o;",
					Description: "System information with OS version",
				},
				// "screen_lock_info": {
				// 	Query:       "select * from screen_lock;",
				// 	Description: "Screen lock information",
				// },
				"disk_encryption_info": {
					Query:       "SELECT CASE WHEN COUNT(*) > 0 THEN 'true' ELSE 'false' END AS disk_encryption FROM bitlocker_info WHERE protection_status = 1 OR percentage_encrypted > 0;",
					Description: "Disk encryption information",
				},
				"antivirus_info": {
					Query:       "SELECT CASE WHEN antivirus = 'Good' THEN 'true' ELSE 'false' END AS antivirus_info FROM windows_security_center;",
					Description: "Antivirus information for Windows",
				},
				"password_manager_info": {
					Query:       "SELECT CASE WHEN COUNT(*) > 0 THEN 'true' ELSE 'false' END AS password_manager FROM programs WHERE name IN ('KeePassXC','KeePass','Keepass','1Password','LastPass','1Password X','Password Wolf','Dashlane','Nordpass','1Password7','Bitwarden','Bitwarden Legacy','TeamPassword');",
					Description: "Password manager information for Windows",
				},
				"apps_info": {
					Query:       "SELECT name, version, language, publisher, install_date, identifying_number, package_family_name, upgrade_code FROM programs;",
					Description: "List all programs",
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
