import { DeviceModel, DeviceSummaryModel, IndividualDataModel, AgentPayload } from '../models/Device';
import { Request, Response } from 'express';

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

    console.log(`Received agent data from device: ${agentData.serial_no} (${agentData.user})`);

    // Create or update device record
    const deviceId = await DeviceModel.createOrUpdate({
      user_email: agentData.user,
      serial_no: agentData.serial_no,
      os_type: agentData.os_type,
      os_version: agentData.os_version || 'unknown',
      last_seen: new Date(agentData.timestamp),
      status: 'online',
      agent_version: agentData.version
    });

    // Store data in individual tables
    const timestamp = new Date(agentData.timestamp);
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
        
        try {
          // Insert/update data in respective table
          await connection.execute(
            `INSERT INTO ${tableName} (device_id, timestamp, data) 
             VALUES (?, ?, ?) 
             ON DUPLICATE KEY UPDATE 
             timestamp = VALUES(timestamp), 
             data = VALUES(data), 
             updated_at = CURRENT_TIMESTAMP`,
            [deviceId, timestamp, JSON.stringify(data)]
          );
          
          receivedDataTypes[dataType as keyof typeof receivedDataTypes] = true;
          console.log(`✅ Stored ${dataType} data for device ${deviceId}`);
          
        } catch (error: any) {
          console.error(`❌ Failed to store ${dataType}:`, error.message);
        }
      }
    }

    // Update device summary with received data types
    await DeviceSummaryModel.createOrUpdate({
      device_id: deviceId,
      last_report: timestamp,
      ...receivedDataTypes
    });

    console.log(`✅ Processed agent data: ${Object.keys(agentData.data).length} data types stored`);

    res.status(200).json({ 
      message: 'Agent data received successfully',
      device_id: deviceId,
      timestamp: timestamp.toISOString()
    });

  } catch (err: any) {
    console.error('❌ Error processing agent data:', err);
    res.status(500).json({ error: err.message });
  }
};

// Get all devices (admin dashboard)
export const getDevices = async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const search = req.query.search as string;

    let devices;
    if (search) {
      devices = { 
        devices: await DeviceModel.findByUser(search), 
        total: (await DeviceModel.findByUser(search)).length 
      };
    } else {
      devices = await DeviceModel.findAll(page, limit);
    }

    res.json(devices);
  } catch (err: any) {
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
    res.status(500).json({ error: err.message });
  }
};

// Get device data by type
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

// Get dashboard statistics
export const getDashboardStats = async (req: Request, res: Response) => {
  try {
    const stats = await DeviceModel.getStats();
    res.json(stats);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

