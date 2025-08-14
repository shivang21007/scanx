import { DeviceModel, DeviceSummaryModel, IndividualDataModel, AgentPayload } from '../models/Device';
import { UsersModel } from '../models/Users';
import { Request, Response } from 'express';
import { parseToIST, getCurrentISTString } from '../utils/timezone';

// Agent data ingestion endpoint
export const receiveAgentData = async (req: Request, res: Response) => {
  try {
    const agentData: AgentPayload = req.body;
    console.log( "screen_lock_info of", agentData.serial_no, "is", agentData.data.screen_lock_info);
    
    // Validate required fields
    if (!agentData.user || !agentData.serial_no || !agentData.os_type) {
      return res.status(400).json({ 
        message: 'Missing required fields: user, serial_no, os_type' 
      });
    }

    console.log(`Received agent data from device: ${agentData.serial_no} (${agentData.user} ${agentData.timestamp})`);

    // Parse agent timestamp to IST
    const istTimestamp = parseToIST(agentData.timestamp);
    
    // Validate user ownership:
    // 1) If a device with this serial exists, proceed (update path below)
    // 2) If not, ensure no other device uses this email (unique owner per email)
    // 3) Verify user exists in users table and is a 'user', not 'service'

    const existingDevice = await DeviceModel.findBySerial(agentData.serial_no);
    if (!existingDevice) {
      // Check if email is already bound to another device
      const existingByEmail = await DeviceModel.findByUser(agentData.user);
      if (existingByEmail.length > 0) {
        return res.status(409).json({ message: 'email already associated with another device' });
      }

      // Verify user in users table
      const userRec = await UsersModel.findByEmail(agentData.user);
      if (!userRec) {
        return res.status(404).json({ message: 'user_email not found' });
      }
      if (userRec.account_type !== 'user') {
        return res.status(401).json({ message: 'service account cannot send data' });
      }
    }

    // Create or update device record
    const deviceId = await DeviceModel.createOrUpdate({
      user_email: agentData.user,
      serial_no: agentData.serial_no,
      computer_name: agentData.computer_name || 'unknown',
      os_type: agentData.os_type,
      os_version: agentData.os_version || 'unknown',
      last_seen: istTimestamp,
      status: 'online',
      agent_version: agentData.version
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
    const { getConnection } = require('../db');
    const connection = getConnection();
    
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
        
        try {
          // Insert new historical record (no update - keep all historical data)
          await connection.execute(
            `INSERT INTO ${tableName} (device_id, timestamp, data) 
             VALUES (?, ?, ?)`,
            [deviceId, timestamp, JSON.stringify(data)]
          );
          
          // Only mark as true if no error status found
          if (!hasErrorStatus) {
            receivedDataTypes[dataType as keyof typeof receivedDataTypes] = true;
            console.log(`✅ Stored ${dataType} data for device ${deviceId}`);
          } else {
            console.log(`⚠️  ${dataType} has error status - marking as false in summary`);
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

    // Update device summary with received data types
    await DeviceSummaryModel.createOrUpdate({
      device_id: deviceId,
      last_report: lastReportTimestamp,
      ...receivedDataTypes
    });

    console.log(`✅ Processed agent data: ${Object.keys(agentData.data).length} data types stored`);

    res.status(200).json({ 
      message: 'Agent data received successfully',
      device_id: deviceId,
      timestamp: getCurrentISTString()
    });

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
    const { search, os_type } = req.query;
    
    console.log('Fetching enriched devices data with filters:', { search, os_type });
    
    const devices = await DeviceModel.findAllEnriched(
      search as string,
      os_type as string
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

// Get device details by ID
export const getDeviceById = async (req: Request, res: Response) => {
  try {
    const deviceId = parseInt(req.params.id);
    
    const device = await DeviceModel.findById(deviceId);
    if (!device) {
      return res.status(404).json({ message: 'Device not found' });
    }

    const summary = await DeviceSummaryModel.findByDevice(deviceId);
    const allData = await IndividualDataModel.getAllDeviceData(deviceId);

    res.json({
      device,
      summary,
      data: allData
    });
  } catch (err: any) {
    console.error('Error getting device by ID:', err);
    res.status(500).json({ error: err.message });
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

