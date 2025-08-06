// Device-related TypeScript interfaces

export interface Device {
  id: number;
  user_email: string;
  serial_no: string;
  computer_name?: string;
  os_type: string;
  os_version: string;
  last_seen: string;
  status: 'online' | 'offline';
  agent_version?: string;
  created_at: string;
  updated_at: string;
}

export interface DeviceSummary {
  id: number;
  device_id: number;
  last_report: string;
  system_info: boolean;
  disk_encryption_info: boolean;
  password_manager_info: boolean;
  antivirus_info: boolean;
  screen_lock_info: boolean;
  apps_info: boolean;
  created_at: string;
  updated_at: string;
}

export interface DashboardStats {
  total: number;
  online: number;
  recent_activity: number;
  by_os: Array<{
    os_type: string;
    count: number;
  }>;
}

export interface DeviceDetails {
  device: Device;
  summary: DeviceSummary | null;
  data: any; // This would be more specific based on the actual data structure
}

export interface DeviceData {
  id: number;
  device_id: number;
  data_type: string;
  data: any;
  timestamp: string;
}

// Security status for device table
export interface SecurityStatus {
  password_manager: boolean;
  screen_lock: boolean;
  antivirus: boolean;
  disk_encryption: boolean;
}

// Enriched device data for devices table
export interface DeviceTableRow {
  // Basic device info
  id: number;
  user_email: string;
  serial_no: string;
  os_type: string;
  os_version: string;
  last_seen: string;
  status: 'online' | 'offline' | 'unknown';
  agent_version: string;
  created_at: string;
  updated_at: string;
  
  // Enriched data
  computer_name: string;
  owner_name: string;
  security_status: SecurityStatus;
  
  // System info data
  system_info_data?: any;
  system_info_timestamp?: string;
  
  // Device summary flags
  has_system_info: boolean;
  has_password_manager: boolean;
  has_screen_lock: boolean;
  has_antivirus: boolean;
  has_disk_encryption: boolean;
  has_apps_info: boolean;
  last_report?: string;
}

// API response for devices table
export interface DevicesTableResponse {
  devices: DeviceTableRow[];
  total: number;
  filters: {
    search: string;
    os_type: string;
  };
}

// Filter parameters for devices table
export interface DevicesTableFilters {
  search?: string;
  os_type?: string;
}

// Device details for individual device page
export interface DeviceDetails extends Device {
  // Additional fields can be added here if needed
}

// Device data response for specific data types
export interface DeviceData {
  data: any;
  timestamp: string;
  device_id: number;
}