import { getConnection } from '../db/connection';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import { getDeviceStatus } from '../utils/timezone';

export interface Device {
    id?: number;
    user_email: string;
    serial_no: string;
    computer_name?: string;
    os_type: string;
    os_version?: string;
    last_seen?: Date;
    status?: 'online' | 'offline' | 'unknown';
    agent_version?: string;
    created_at?: Date;
    updated_at?: Date;
}

export interface DeviceSummary {
    device_id: number;
    last_report?: Date;
    system_info?: boolean;
    password_manager_info?: boolean;
    screen_lock_info?: boolean;
    antivirus_info?: boolean;
    disk_encryption_info?: boolean;
    apps_info?: boolean;
    created_at?: Date;
    updated_at?: Date;
}

export interface AgentPayload {
    user: string;
    version: string;
    os_type: string;
    os_version: string;
    serial_no: string;
    computer_name: string;
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
                 user_email = ?, computer_name = ?, os_type = ?, os_version = ?, last_seen = ?, 
                 status = ?, agent_version = ?, updated_at = CURRENT_TIMESTAMP 
                 WHERE id = ?`,
                [
                    deviceData.user_email,
                    deviceData.computer_name,
                    deviceData.os_type,
                    deviceData.os_version,
                    deviceData.last_seen,
                    getDeviceStatus(deviceData.last_seen || null),
                    deviceData.agent_version,
                    deviceId
                ]
            );
            return deviceId;
        } else {
            // Create new device
            const [result] = await connection.execute<ResultSetHeader>(
                `INSERT INTO devices (user_email, serial_no, computer_name, os_type, os_version, last_seen, status, agent_version) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    deviceData.user_email,
                    deviceData.serial_no,
                    deviceData.computer_name,
                    deviceData.os_type,
                    deviceData.os_version,
                    deviceData.last_seen,
                    getDeviceStatus(deviceData.last_seen || null),
                    deviceData.agent_version
                ]
            );
            return result.insertId;
        }
    }

    // Get all devices (simplified for dashboard)
    static async findAll(): Promise<Device[]> {
        const connection = getConnection();
        
        const [rows] = await connection.execute<RowDataPacket[]>(
            'SELECT * FROM devices ORDER BY last_seen DESC, created_at DESC'
        );
        
        return rows as Device[];
    }

    // Get all devices with enriched data for devices table
    static async findAllEnriched(searchTerm?: string, osTypeFilter?: string): Promise<any[]> {
        const connection = getConnection();
        
        let query = `
            SELECT 
                d.*,
                ds.system_info as has_system_info,
                ds.password_manager_info as has_password_manager,
                ds.screen_lock_info as has_screen_lock,
                ds.antivirus_info as has_antivirus,
                ds.disk_encryption_info as has_disk_encryption,
                ds.apps_info as has_apps_info,
                ds.last_report
            FROM devices d
            LEFT JOIN device_summary ds ON d.id = ds.device_id
            WHERE 1=1
        `;
        
        const params: any[] = [];
        
        // Add search functionality - now using direct fields from devices table
        if (searchTerm && searchTerm.trim() !== '') {
            query += ` AND (
                d.serial_no LIKE ? OR
                d.user_email LIKE ? OR
                d.computer_name LIKE ?
            )`;
            const searchPattern = `%${searchTerm.trim()}%`;
            params.push(searchPattern, searchPattern, searchPattern);
        }
        
        // Add OS type filter
        if (osTypeFilter && osTypeFilter.trim() !== '') {
            query += ` AND d.os_type = ?`;
            params.push(osTypeFilter.trim());
        }
        
        query += ` ORDER BY d.last_seen DESC, d.created_at DESC`;
        
        const [rows] = await connection.execute<RowDataPacket[]>(query, params);
        
        // Process the results - much simpler now
        return rows.map((row: any) => {
            // Format owner name from email
            const email = row.user_email || '';
            let ownerName = 'Unknown';
            if (email) {
                // Try to extract name by splitting on . first, then fallback to @ split
                const beforeAt = email.split('@')[0];
                if (beforeAt.includes('.')) {
                    ownerName = beforeAt.split('.').map((part: string) => 
                        part.charAt(0).toUpperCase() + part.slice(1)
                    ).join(' ');
                } else {
                    ownerName = beforeAt.charAt(0).toUpperCase() + beforeAt.slice(1);
                }
            }
            
            return {
                ...row,
                owner_name: ownerName,
                // Calculate status dynamically based on last_seen
                status: getDeviceStatus(row.last_seen),
                // Convert boolean flags from device_summary to proper boolean values
                security_status: {
                    password_manager: Boolean(row.has_password_manager),
                    screen_lock: Boolean(row.has_screen_lock),
                    antivirus: Boolean(row.has_antivirus),
                    disk_encryption: Boolean(row.has_disk_encryption)
                }
            };
        });
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
        
        // Calculate online devices based on last_seen within 24 hours (dynamic status)
        const [onlineDevices] = await connection.execute<RowDataPacket[]>(
            'SELECT COUNT(*) as online FROM devices WHERE last_seen >= DATE_SUB(NOW(), INTERVAL 24 HOUR)'
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

export class IndividualDataModel {
    // Get LATEST data from specific table
    static async getDeviceDataByType(device_id: number, dataType: string): Promise<any> {
        const connection = getConnection();
        console.log('Getting LATEST data for device:', device_id, 'and type:', dataType);
        
        try {
            const [rows] = await connection.execute<RowDataPacket[]>(
                `SELECT * FROM ${dataType} WHERE device_id = ? ORDER BY timestamp DESC LIMIT 1`,
                [device_id]
            );
            
            if (rows.length > 0) {
                const row = rows[0];
                
                // Handle data field - it might already be parsed or be a JSON string
                let parsedData = null;
                if (row.data) {
                    if (typeof row.data === 'string') {
                        try {
                            parsedData = JSON.parse(row.data);
                        } catch (error) {
                            console.warn(`Failed to parse data as JSON for ${dataType}:`, row.data);
                            parsedData = row.data; // Use as-is if can't parse
                        }
                    } else {
                        parsedData = row.data; // Already an object
                    }
                }
                
                // Check for error status in the data
                let hasErrorStatus = false;
                let errorMessage = null;
                
                if (parsedData && Array.isArray(parsedData)) {
                    const errorItem = parsedData.find((item: any) => 
                        item.status && (
                            item.status === 'failed to execute query' || 
                            item.status.startsWith('no_data_found for')
                        )
                    );
                    
                    if (errorItem) {
                        hasErrorStatus = true;
                        errorMessage = errorItem.status;
                    }
                }
                
                return {
                    ...row,
                    data: parsedData,
                    hasErrorStatus,
                    errorMessage
                };
            }
            return null;
        } catch (error) {
            console.error(`Error fetching latest ${dataType} for device ${device_id}:`, error);
            return null;
        }
    }

    // Get HISTORICAL data from specific table with pagination
    static async getDeviceDataHistory(device_id: number, dataType: string, page: number = 1, limit: number = 10): Promise<{data: any[], total: number, page: number, limit: number, totalPages: number}> {
        const connection = getConnection();
        console.log('Getting HISTORICAL data for device:', device_id, 'type:', dataType, 'page:', page, 'limit:', limit);
        
        try {
            // Get total count
            const [countRows] = await connection.execute<RowDataPacket[]>(
                `SELECT COUNT(*) as total FROM ${dataType} WHERE device_id = ?`,
                [device_id]
            );
            const total = countRows[0].total;
            
            // Calculate offset
            const offset = (page - 1) * limit;
            
            // Get paginated data
            const [rows] = await connection.execute<RowDataPacket[]>(
                `SELECT * FROM ${dataType} WHERE device_id = ? ORDER BY timestamp DESC LIMIT ? OFFSET ?`,
                [device_id, limit, offset]
            );
            
            // Process each row
            const processedData = rows.map(row => {
                let parsedData = null;
                if (row.data) {
                    if (typeof row.data === 'string') {
                        try {
                            parsedData = JSON.parse(row.data);
                        } catch (error) {
                            console.warn(`Failed to parse data as JSON for ${dataType}:`, row.data);
                            parsedData = row.data; // Use as-is if can't parse
                        }
                    } else {
                        parsedData = row.data; // Already an object
                    }
                }
                
                return {
                    ...row,
                    data: parsedData
                };
            });
            
            const totalPages = Math.ceil(total / limit);
            
            return {
                data: processedData,
                total,
                page,
                limit,
                totalPages
            };
        } catch (error) {
            console.error(`Error fetching historical ${dataType} for device ${device_id}:`, error);
            return {
                data: [],
                total: 0,
                page,
                limit,
                totalPages: 0
            };
        }
    }

    // Get all data types for a device
    static async getAllDeviceData(device_id: number): Promise<any> {
        const dataTypes = [
            'system_info',
            'disk_encryption_info', 
            'password_manager_info',
            'antivirus_info',
            'screen_lock_info',
            'apps_info'
        ];
        
        const result: any = {};
        
        for (const dataType of dataTypes) {
            result[dataType] = await this.getDeviceDataByType(device_id, dataType);
        }
        
        return result;
    }
}

// DeviceDataModel removed - we now use individual tables for each data type

export class DeviceSummaryModel {
    // Create or update device summary
    static async createOrUpdate(summary: Omit<DeviceSummary, 'created_at' | 'updated_at'>): Promise<void> {
        const connection = getConnection();
        
        await connection.execute<ResultSetHeader>(
            `INSERT INTO device_summary (
                device_id, last_report, system_info, password_manager_info, 
                screen_lock_info, antivirus_info, disk_encryption_info, apps_info
             ) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?) 
             ON DUPLICATE KEY UPDATE 
             last_report = VALUES(last_report),
             system_info = VALUES(system_info),
             password_manager_info = VALUES(password_manager_info),
             screen_lock_info = VALUES(screen_lock_info),
             antivirus_info = VALUES(antivirus_info),
             disk_encryption_info = VALUES(disk_encryption_info),
             apps_info = VALUES(apps_info),
             updated_at = CONVERT_TZ(NOW(), 'UTC', '+05:30')`,
            [
                summary.device_id,
                summary.last_report,
                summary.system_info || false,
                summary.password_manager_info || false,
                summary.screen_lock_info || false,
                summary.antivirus_info || false,
                summary.disk_encryption_info || false,
                summary.apps_info || false
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
        
        return rows[0] as DeviceSummary;
    }
}

