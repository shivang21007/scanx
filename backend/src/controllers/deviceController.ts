import { DeviceModel, DeviceSummaryModel, IndividualDataModel, AgentPayload } from '../models/Device';
import { UsersModel } from '../models/Users';
import { DeviceIntervalRequestModel, parseIntervalToSeconds } from '../models/IntervalRequest';
import { AdminModel } from '../models/Admin';
import { Request, Response } from 'express';
import { parseToIST, getCurrentISTString } from '../utils/timezone';
import { getConnection } from '../db/connection';

// Function to check if data indicates compliance based on data type
function checkDataCompliance(dataType: string, data: any[]): boolean {
  if (!data || data.length === 0) return false;
  
  const item = data[0]; // Check first item
  
  switch (dataType) {
    case 'disk_encryption_info':
      // Check if disk_encryption is "true" (enabled)
      return item.disk_encryption === 'true' || item.disk_encryption === true;
      
    case 'password_manager_info':
      // Check if password_manager is "true" (enabled)
      return item.password_manager === 'true' || item.password_manager === true;
      
    case 'antivirus_info':
      // Check if antivirus is "true" (enabled)
      // Windows returns 'antivirus_status', macOS returns 'antivirus_info'
      return (item.antivirus_info === 'true' || item.antivirus_info === true) ||
             (item.antivirus_status === 'true' || item.antivirus_status === true);
      
    case 'screen_lock_info':
      // Check if screen_lock is "true" (enabled)
      return item.screen_lock === 'true' || item.screen_lock === true;
      
    case 'apps_info':
      // For apps_info, we consider it compliant if data exists (no specific true/false check)
      return true;
      
    case 'system_info':
      // For system_info, we consider it compliant if data exists (no specific true/false check)
      return true;
      
    default:
      // For unknown data types, consider compliant if data exists
      return true;
  }
}

// Agent data ingestion endpoint
export const receiveAgentData = async (req: Request, res: Response) => {
  try {
    const agentData: AgentPayload = req.body;
    // Validate required fields
    if (!agentData.user || !agentData.serial_no || !agentData.os_type) {
      return res.status(400).json({ 
        message: 'Missing required fields: user, serial_no, os_type' 
      });
    }

    console.log(`Received agent data from device: ${agentData.serial_no} (${agentData.user} ${agentData.timestamp})`);
    console.log( "screen_lock_info of", agentData.serial_no, "is", agentData.data.screen_lock_info);
    console.log( "antivirus_info of", agentData.serial_no, "is", agentData.data.antivirus_info);
    console.log( "disk_encryption_info of", agentData.serial_no, "is", agentData.data.disk_encryption_info);
    console.log( "password_manager_info of", agentData.serial_no, "is", agentData.data.password_manager_info);
    

    // Parse agent timestamp to IST
    const istTimestamp = parseToIST(agentData.timestamp);
    
    // Validate user exists and is a 'user' account (not 'service')
    const userRec = await UsersModel.findByEmail(agentData.user);
    if (!userRec) {
      return res.status(404).json({ message: 'user_email not found' });
    }
    if (userRec.account_type !== 'user') {
      return res.status(401).json({ message: 'service account cannot send data' });
    }

    // Check if device exists BEFORE creating/updating (to know if it's new)
    // Pass computer_name for proper identification of Windows devices with generic serial numbers
    const existingDevice = await DeviceModel.findBySerial(agentData.serial_no, agentData.computer_name);
    const isNewDevice = !existingDevice;

    // Create or update device record
    const deviceId = await DeviceModel.createOrUpdate({
      user_email: agentData.user,
      serial_no: agentData.serial_no,
      computer_name: agentData.computer_name || 'unknown',
      os_type: agentData.os_type,
      os_version: agentData.os_version || 'unknown',
      last_seen: istTimestamp,
      status: 'online',
      scanx_version: agentData.scanx_version,
      osqueryi_version: agentData.osqueryi_version
    });

    // Store data in individual tables
    // Convert agent timestamp to MySQL format if provided, otherwise use server timestamp
    let timestamp: string;
    if (agentData.timestamp) {
      const date = new Date(agentData.timestamp);
      timestamp = date.toISOString().slice(0, 19).replace('T', ' '); // Convert to MySQL format: YYYY-MM-DD HH:mm:ss
    } else {
      timestamp = istTimestamp.toISOString().slice(0, 19).replace('T', ' ');
    }
    const lastReportTimestamp = agentData.timestamp ? new Date(agentData.timestamp) : istTimestamp;
    const connection = await getConnection();
    
    // Track which data types were received
    const receivedDataTypes = {
      system_info: false,
      disk_encryption_info: false,
      password_manager_info: false,
      antivirus_info: false,
      screen_lock_info: false,
      apps_info: false
    };

    for (const [dataType, data] of Object.entries(agentData.data)) {
      if (data && data.length > 0) {
        const tableName = dataType; // matches our table names
        
        // Check if data contains error status
        const hasErrorStatus = data.some((item: any) => 
          item.status && (
            item.status === 'failed to execute query' || 
            item.status.startsWith('no_data_found for')
          )
        );
        
        // Check if data indicates non-compliance (feature disabled/false)
        const isCompliant = checkDataCompliance(dataType, data);
        
        try {
          // Insert new historical record (no update - keep all historical data)
          await connection.execute(
            `INSERT INTO ${tableName} (device_id, timestamp, data) 
             VALUES (?, ?, ?)`,
            [deviceId, timestamp, JSON.stringify(data)]
          );
          
          // Mark as true only if no error status AND data is compliant
          if (!hasErrorStatus && isCompliant) {
            receivedDataTypes[dataType as keyof typeof receivedDataTypes] = true;
            console.log(`✅ Stored ${dataType} data for device ${deviceId} - COMPLIANT`);
          } else if (hasErrorStatus) {
            console.log(`⚠️  ${dataType} has error status - marking as false in summary`);
          } else {
            console.log(`⚠️  ${dataType} is non-compliant - marking as false in summary`);
          }
          
        } catch (error: any) {
          console.error(`❌ Failed to store ${dataType}:`, error.message);
        }
      }
    }

    // Special validation for screen_lock_info: check grace_period
    if (agentData.data.screen_lock_info && agentData.data.screen_lock_info.length > 0) {
      try {
        const screenLockData = agentData.data.screen_lock_info[0];
        const gracePeriod = parseInt(screenLockData.grace_period || '0', 10);
        
        // If grace period is more than 1 hour (3600 seconds), mark as false
        if (gracePeriod > 3600) {
          receivedDataTypes.screen_lock_info = false;
          console.log(`⚠️  Screen lock grace period (${gracePeriod}s) exceeds 1 hour - marking as non-compliant`);
        }
      } catch (error: any) {
        console.error(`❌ Failed to validate screen_lock grace_period:`, error.message);
        // Keep the original receivedDataTypes value on error
      }
    }

    // Update device summary with received data types and interval
    await DeviceSummaryModel.createOrUpdate({
      device_id: deviceId,
      last_report: lastReportTimestamp,
      ...receivedDataTypes,
      interval_info: agentData.interval_seconds || undefined
    });
    
    // Add device_id to user's device_id array
    // Always try to add it - addDevice will check if it already exists
    const added = await UsersModel.addDevice(agentData.user, deviceId);
    if (added) {
      console.log(`✅ Added device ${deviceId} to user ${agentData.user}'s device_id array`);
    } else if (isNewDevice) {
      // If it's a new device but addDevice returned false, log a warning
      console.log(`⚠️  Device ${deviceId} already exists in user ${agentData.user}'s device_id array (unexpected for new device)`);
    }

    console.log(`✅ Processed agent data: ${Object.keys(agentData.data).length} data types stored`);

    // Check for pending interval request
    const pendingIntervalRequest = await DeviceIntervalRequestModel.getPendingByDeviceId(deviceId);

    // Build response
    const response: any = {
      message: 'Agent data received successfully',
      device_id: deviceId,
      timestamp: getCurrentISTString()
    };

    // Include interval update if pending
    if (pendingIntervalRequest) {
      response.interval_update = {
        request_id: pendingIntervalRequest.id,
        new_interval: pendingIntervalRequest.requested_interval,
        new_interval_seconds: pendingIntervalRequest.requested_interval_seconds
      };
      console.log(`📤 Sending interval update to device ${deviceId}: ${pendingIntervalRequest.requested_interval}`);
    }

    res.status(200).json(response);

  } catch (err: any) {
    console.error('❌ Error processing agent data:', err);
    res.status(500).json({ error: err.message });
  }
};

// Get all devices (admin dashboard)
export const getDevices = async (req: Request, res: Response) => {
  try {
    const devices = await DeviceModel.findAll();
    res.json(devices);
  } catch (err: any) {
    console.error('Error getting devices:', err);
    res.status(500).json({ error: err.message });
  }
};

// Get enriched devices data for devices table page
export const getDevicesTable = async (req: Request, res: Response) => {
  try {
    const { 
      search, 
      os_type, 
      sort_by, 
      sort_order,
      password_manager,
      disk_encryption,
      antivirus,
      screen_lock
    } = req.query;
    
    console.log('Fetching enriched devices data with filters:', { 
      search, 
      os_type, 
      sort_by, 
      sort_order,
      password_manager,
      disk_encryption,
      antivirus,
      screen_lock
    });
    
    const devices = await DeviceModel.findAllEnriched(
      search as string,
      os_type as string,
      sort_by as string,
      sort_order as 'asc' | 'desc',
      password_manager as 'true' | 'false' | undefined,
      disk_encryption as 'true' | 'false' | undefined,
      antivirus as 'true' | 'false' | undefined,
      screen_lock as 'true' | 'false' | undefined
    );
    
    console.log(`Found ${devices.length} devices with enriched data`);
    
    res.json({
      devices,
      total: devices.length,
      filters: {
        search: search || '',
        os_type: os_type || ''
      }
    });
  } catch (err: any) {
    console.error('Error getting enriched devices:', err);
    res.status(500).json({ error: err.message });
  }
};

// Get device details by ID (lightweight - only device, summary, and system_info)
export const getDeviceById = async (req: Request, res: Response) => {
  try {
    const deviceId = parseInt(req.params.id);
    
    const device = await DeviceModel.findById(deviceId);
    if (!device) {
      return res.status(404).json({ message: 'Device not found' });
    }

    const summary = await DeviceSummaryModel.findByDevice(deviceId);
    
    // Only fetch system_info for the initial load (used in System Info tab)
    const system_info = await IndividualDataModel.getDeviceDataByType(deviceId, 'system_info');

    res.json({
      device,
      summary,
      system_info // Only system_info, other data fetched on-demand
    });
  } catch (err: any) {
    console.error('Error getting device by ID:', err);
    res.status(500).json({ error: err.message });
  }
};

// Remove device by ID
export const removeDeviceById = async (req: Request, res: Response) => {
  try {
    const deviceId = parseInt(req.params.id);
    console.log('Removing device by ID:', deviceId);
    
    // Get device info before deletion to get user_email
    const device = await DeviceModel.findById(deviceId);
    if (!device) {
      return res.status(404).json({ message: 'Device not found' });
    }
    
    // Remove device_id from user's devices array
    if (device.user_email) {
      await UsersModel.removeDevice(device.user_email, deviceId);
      console.log(`✅ Removed device ${deviceId} from user ${device.user_email}'s devices array`);
    }
    
    // Delete device (CASCADE will handle related tables: device_summary, system_info, etc.)
    await DeviceModel.deleteById(deviceId);
    
    res.status(200).json({ message: 'DeviceID: ' + deviceId + ' removed successfully' });
  } catch (err: any) {
    console.error('Error removing device by ID:', err);
    res.status(500).json({ error: 'Error removing device by ID: ' + err.message });
  }
};

// Get device data by type (LATEST only)
export const getDeviceData = async (req: Request, res: Response) => {
  try {
    const deviceId = parseInt(req.params.id);
    const dataType = req.params.type;
    
    const deviceData = await IndividualDataModel.getDeviceDataByType(deviceId, dataType);
    res.json(deviceData);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

// Get device data history by type (PAGINATED)
export const getDeviceDataHistory = async (req: Request, res: Response) => {
  try {
    const deviceId = parseInt(req.params.id);
    const dataType = req.params.type;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    
    // Validate pagination parameters
    if (page < 1 || limit < 1 || limit > 100) {
      return res.status(400).json({ 
        error: 'Invalid pagination parameters. Page must be >= 1, limit must be 1-100' 
      });
    }
    
    const historyData = await IndividualDataModel.getDeviceDataHistory(deviceId, dataType, page, limit);
    res.json(historyData);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

// Get dashboard statistics
export const getDashboardStats = async (req: Request, res: Response) => {
  try {
    const stats = await DeviceModel.getStats();
    res.json(stats);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

// Request interval change for a device
export const requestIntervalChange = async (req: Request, res: Response) => {
  try {
    const deviceId = parseInt(req.params.id);
    const { interval, requested_by } = req.body;
    
    if (!interval) {
      return res.status(400).json({ error: 'Interval is required' });
    }
    
    // Validate interval format (e.g., "2h", "30m", "1h30m")
    let intervalSeconds: number;
    try {
      intervalSeconds = parseIntervalToSeconds(interval);
    } catch (error: any) {
      return res.status(400).json({ error: `Invalid interval format: ${error.message}` });
    }
    
    // Verify device exists
    const device = await DeviceModel.findById(deviceId);
    if (!device) {
      return res.status(404).json({ error: 'Device not found' });
    }
    
    // Get admin name from database
    let adminName = 'admin';
    const adminId = (req as any).admin?.id;
    if (adminId) {
      const admin = await AdminModel.findById(adminId);
      adminName = admin?.name || admin?.email || 'admin';
    } else {
      const adminEmail = (req as any).admin?.email || (req as any).user?.email;
      if (adminEmail) {
        const admin = await AdminModel.findByEmail(adminEmail);
        adminName = admin?.name || admin?.email || 'admin';
      }
    }
    
    // Create interval request
    const requestId = await DeviceIntervalRequestModel.create({
      device_id: deviceId,
      requested_interval: interval,
      requested_interval_seconds: intervalSeconds,
      status: 'pending',
      requested_by: requested_by || adminName
    });
    
    console.log(`✅ Interval change requested for device ${deviceId}: ${interval} (${intervalSeconds}s)`);
    
    res.status(200).json({
      message: 'Interval change request queued successfully',
      request_id: requestId,
      device_id: deviceId,
      requested_interval: interval,
      status: 'pending'
    });
  } catch (err: any) {
    console.error('Error requesting interval change:', err);
    res.status(500).json({ error: err.message });
  }
};

// Get interval request history for a device (paginated)
export const getIntervalRequestHistory = async (req: Request, res: Response) => {
  try {
    const deviceId = parseInt(req.params.id);
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    
    // Validate pagination parameters
    if (page < 1 || limit < 1 || limit > 100) {
      return res.status(400).json({ 
        error: 'Invalid pagination parameters. Page must be >= 1, limit must be 1-100' 
      });
    }
    
    const result = await DeviceIntervalRequestModel.getByDeviceId(deviceId, page, limit);
    res.json(result);
  } catch (err: any) {
    console.error('Error getting interval request history:', err);
    res.status(500).json({ error: err.message });
  }
};

// Delete interval request
export const deleteIntervalRequest = async (req: Request, res: Response) => {
  try {
    const requestId = parseInt(req.params.requestId);
    
    if (!requestId || isNaN(requestId)) {
      return res.status(400).json({ error: 'Invalid request ID' });
    }
    
    const deleted = await DeviceIntervalRequestModel.deleteById(requestId);
    
    if (!deleted) {
      return res.status(404).json({ error: 'Interval request not found' });
    }
    
    console.log(`✅ Interval request ${requestId} deleted`);
    res.status(200).json({ message: 'Interval request deleted successfully' });
  } catch (err: any) {
    console.error('Error deleting interval request:', err);
    res.status(500).json({ error: err.message });
  }
};

// Agent confirmation endpoint
export const confirmIntervalUpdate = async (req: Request, res: Response) => {
  try {
    const { device_id, request_id, success, error_message, current_interval } = req.body;
    
    if (!device_id || !request_id) {
      return res.status(400).json({ error: 'device_id and request_id are required' });
    }
    
    const confirmation = {
      success,
      error_message: error_message || null,
      current_interval: current_interval || null,
      confirmed_at: getCurrentISTString()
    };
    
    if (success) {
      await DeviceIntervalRequestModel.markAsApplied(request_id, confirmation);
      console.log(`✅ Interval update confirmed for device ${device_id}, request ${request_id}`);
    } else {
      await DeviceIntervalRequestModel.markAsFailed(request_id);
      console.log(`❌ Interval update failed for device ${device_id}, request ${request_id}: ${error_message}`);
    }
    
    res.status(200).json({
      message: 'Confirmation received',
      request_id: request_id
    });
  } catch (err: any) {
    console.error('Error confirming interval update:', err);
    res.status(500).json({ error: err.message });
  }
};
