import { getConnection } from '../db';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

export interface Device {
    id?: number;
    user_email: string;
    serial_no: string;
    os_type: string;
    os_version?: string;
    last_seen?: Date;
    status?: 'online' | 'offline' | 'unknown';
    agent_version?: string;
    created_at?: Date;
    updated_at?: Date;
}

export interface DeviceData {
    id?: number;
    device_id: number;
    timestamp: Date;
    data_type: string;
    data: any;
    created_at?: Date;
}

export interface DeviceSummary {
    device_id: number;
    system_info?: any;
    security_info?: any;
    apps_count?: number;
    last_report?: Date;
    created_at?: Date;
    updated_at?: Date;
}

export interface AgentPayload {
    user: string;
    version: string;
    os_type: string;
    os_version: string;
    serial_no: string;
    timestamp: string;
    data: {
        [key: string]: any[];
    };
}

export class DeviceModel {
    // Create or update device
    static async createOrUpdate(deviceData: Omit<Device, 'id' | 'created_at' | 'updated_at'>): Promise<number> {
        const connection = getConnection();
        
        // First try to find existing device by serial number
        const [existing] = await connection.execute<RowDataPacket[]>(
            'SELECT id FROM devices WHERE serial_no = ?',
            [deviceData.serial_no]
        );

        if (existing.length > 0) {
            // Update existing device
            const deviceId = existing[0].id;
            await connection.execute<ResultSetHeader>(
                `UPDATE devices SET 
                 user_email = ?, os_type = ?, os_version = ?, last_seen = ?, 
                 status = ?, agent_version = ?, updated_at = CURRENT_TIMESTAMP 
                 WHERE id = ?`,
                [
                    deviceData.user_email,
                    deviceData.os_type,
                    deviceData.os_version,
                    deviceData.last_seen,
                    deviceData.status || 'online',
                    deviceData.agent_version,
                    deviceId
                ]
            );
            return deviceId;
        } else {
            // Create new device
            const [result] = await connection.execute<ResultSetHeader>(
                `INSERT INTO devices (user_email, serial_no, os_type, os_version, last_seen, status, agent_version) 
                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [
                    deviceData.user_email,
                    deviceData.serial_no,
                    deviceData.os_type,
                    deviceData.os_version,
                    deviceData.last_seen,
                    deviceData.status || 'online',
                    deviceData.agent_version
                ]
            );
            return result.insertId;
        }
    }

    // Get all devices with pagination
    static async findAll(page: number = 1, limit: number = 20): Promise<{ devices: Device[], total: number }> {
        const connection = getConnection();
        const offset = (page - 1) * limit;
        
        // Get total count
        const [countRows] = await connection.execute<RowDataPacket[]>('SELECT COUNT(*) as total FROM devices');
        const total = countRows[0].total;
        
        // Get devices with pagination
        const [rows] = await connection.execute<RowDataPacket[]>(
            `SELECT * FROM devices ORDER BY last_seen DESC, created_at DESC LIMIT ? OFFSET ?`,
            [limit, offset]
        );
        
        return { devices: rows as Device[], total };
    }

    // Find device by serial number
    static async findBySerial(serial_no: string): Promise<Device | null> {
        const connection = getConnection();
        const [rows] = await connection.execute<RowDataPacket[]>(
            'SELECT * FROM devices WHERE serial_no = ?',
            [serial_no]
        );
        return rows.length > 0 ? rows[0] as Device : null;
    }

    // Find device by ID
    static async findById(id: number): Promise<Device | null> {
        const connection = getConnection();
        const [rows] = await connection.execute<RowDataPacket[]>(
            'SELECT * FROM devices WHERE id = ?',
            [id]
        );
        return rows.length > 0 ? rows[0] as Device : null;
    }

    // Search devices by user email
    static async findByUser(user_email: string): Promise<Device[]> {
        const connection = getConnection();
        const [rows] = await connection.execute<RowDataPacket[]>(
            'SELECT * FROM devices WHERE user_email LIKE ? ORDER BY last_seen DESC',
            [`%${user_email}%`]
        );
        return rows as Device[];
    }

    // Get device statistics
    static async getStats(): Promise<any> {
        const connection = getConnection();
        
        const [totalDevices] = await connection.execute<RowDataPacket[]>(
            'SELECT COUNT(*) as total FROM devices'
        );
        
        const [onlineDevices] = await connection.execute<RowDataPacket[]>(
            'SELECT COUNT(*) as online FROM devices WHERE status = "online"'
        );
        
        const [recentActivity] = await connection.execute<RowDataPacket[]>(
            'SELECT COUNT(*) as recent FROM devices WHERE last_seen >= DATE_SUB(NOW(), INTERVAL 24 HOUR)'
        );
        
        const [osByType] = await connection.execute<RowDataPacket[]>(
            'SELECT os_type, COUNT(*) as count FROM devices GROUP BY os_type'
        );
        
        return {
            total: totalDevices[0].total,
            online: onlineDevices[0].online,
            recent_activity: recentActivity[0].recent,
            by_os: osByType
        };
    }
}

export class DeviceDataModel {
    // Store agent data
    static async create(deviceData: Omit<DeviceData, 'id' | 'created_at'>): Promise<number> {
        const connection = getConnection();
        const [result] = await connection.execute<ResultSetHeader>(
            'INSERT INTO device_data (device_id, timestamp, data_type, data) VALUES (?, ?, ?, ?)',
            [deviceData.device_id, deviceData.timestamp, deviceData.data_type, JSON.stringify(deviceData.data)]
        );
        return result.insertId;
    }

    // Get device data by device ID
    static async findByDevice(device_id: number, data_type?: string): Promise<DeviceData[]> {
        const connection = getConnection();
        
        let query = 'SELECT * FROM device_data WHERE device_id = ?';
        let params: any[] = [device_id];
        
        if (data_type) {
            query += ' AND data_type = ?';
            params.push(data_type);
        }
        
        query += ' ORDER BY timestamp DESC LIMIT 100';
        
        const [rows] = await connection.execute<RowDataPacket[]>(query, params);
        return rows.map((row: any) => ({
            ...row,
            data: JSON.parse(row.data)
        })) as DeviceData[];
    }
}

export class DeviceSummaryModel {
    // Create or update device summary
    static async createOrUpdate(summary: Omit<DeviceSummary, 'created_at' | 'updated_at'>): Promise<void> {
        const connection = getConnection();
        
        await connection.execute<ResultSetHeader>(
            `INSERT INTO device_summary (device_id, system_info, security_info, apps_count, last_report) 
             VALUES (?, ?, ?, ?, ?) 
             ON DUPLICATE KEY UPDATE 
             system_info = VALUES(system_info),
             security_info = VALUES(security_info),
             apps_count = VALUES(apps_count),
             last_report = VALUES(last_report),
             updated_at = CURRENT_TIMESTAMP`,
            [
                summary.device_id,
                JSON.stringify(summary.system_info),
                JSON.stringify(summary.security_info),
                summary.apps_count,
                summary.last_report
            ]
        );
    }

    // Get device summary
    static async findByDevice(device_id: number): Promise<DeviceSummary | null> {
        const connection = getConnection();
        const [rows] = await connection.execute<RowDataPacket[]>(
            'SELECT * FROM device_summary WHERE device_id = ?',
            [device_id]
        );
        
        if (rows.length === 0) return null;
        
        const row = rows[0];
        return {
            ...row,
            system_info: JSON.parse(row.system_info || '{}'),
            security_info: JSON.parse(row.security_info || '{}')
        } as DeviceSummary;
    }
}

