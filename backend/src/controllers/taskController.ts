import { DeviceModel, DeviceSummaryModel, IndividualDataModel, AgentPayload } from '../models/Device';
import { Request, Response } from 'express';
import { parseToIST, getCurrentISTString } from '../utils/timezone';

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

    // Parse agent timestamp to IST
    const istTimestamp = parseToIST(agentData.timestamp);
    
    // Create or update device record
    const deviceId = await DeviceModel.createOrUpdate({
      user_email: agentData.user,
      serial_no: agentData.serial_no,
      os_type: agentData.os_type,
      os_version: agentData.os_version || 'unknown',
      last_seen: istTimestamp,
      status: 'online',
      agent_version: agentData.version
    });

    // Store detailed data for each query type
    const timestamp = istTimestamp;
    
    for (const [dataType, data] of Object.entries(agentData.data)) {
      if (data && data.length > 0) {
        // Data is already stored in individual table above
        console.log(`✅ Data stored in ${dataType} table`);
      }
    }

    // Track which data types were received for summary
    const receivedDataTypes = {
      system_info: !!(agentData.data.system_info && agentData.data.system_info.length > 0),
      disk_encryption_info: !!(agentData.data.disk_encryption_info && agentData.data.disk_encryption_info.length > 0),
      password_manager_info: !!(agentData.data.password_manager_info && agentData.data.password_manager_info.length > 0),
      antivirus_info: !!(agentData.data.antivirus_info && agentData.data.antivirus_info.length > 0),
      screen_lock_info: !!(agentData.data.screen_lock_info && agentData.data.screen_lock_info.length > 0),
      apps_info: !!(agentData.data.apps_info && agentData.data.apps_info.length > 0)
    };

    await DeviceSummaryModel.createOrUpdate({
      device_id: deviceId,
      last_report: timestamp,
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
      devices = await DeviceModel.findAll();
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

