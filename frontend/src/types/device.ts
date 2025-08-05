// Device-related TypeScript interfaces

export interface Device {
  id: number;
  user_email: string;
  serial_no: string;
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