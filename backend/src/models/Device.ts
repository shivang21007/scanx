import { getConnection } from '../db/connection';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import { getDeviceStatus } from '../utils/timezone';
import { systemLog } from '../logger/logger';

export interface Device {
    id?: number;
    user_email: string;
    serial_no: string;
    computer_name?: string;
    os_type: string;
    os_version?: string;
    last_seen?: Date;
    status?: 'online' | 'offline' | 'unknown';
    scanx_version?: string;
    osqueryi_version?: string;
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
    interval_info?: number;  // Interval in seconds
    created_at?: Date;
    updated_at?: Date;
}

export interface AgentPayload {
    user: string;
    scanx_version: string;
    osqueryi_version: string;
    interval_seconds?: number;  // Interval in seconds (optional for backward compatibility)
    os_type: string;
    os_version: string;
    serial_no: string;
    computer_name: string;
    timestamp: string;
    data: {
        [key: string]: any[];
    };
}

// List of generic serial numbers that Windows desktops commonly return
const GENERIC_SERIAL_NUMBERS = [
    'default string',
    'system serial number',
    'none',
    'n/a',
    'not available',
    'not specified',
    'chassis serial number',
    'empty',
    'invalid',
    'undefined'
];

// Helper function to check if a serial number is generic
function isGenericSerialNumber(serialNo: string): boolean {
    if (!serialNo) return true;
    const normalized = serialNo.toLowerCase().trim();
    // Only check for exact matches, not substrings
    return GENERIC_SERIAL_NUMBERS.some(generic => normalized === generic);
}

export class DeviceModel {
    // Create or update device
    static async createOrUpdate(deviceData: Omit<Device, 'id' | 'created_at' | 'updated_at'>): Promise<number> {
        const connection = await getConnection();
        
        let existing: RowDataPacket[];
        
        // Check if this is a generic serial number (common on Windows desktops)
        if (isGenericSerialNumber(deviceData.serial_no)) {
            // For generic serial numbers, use BOTH serial_no AND computer_name to identify device
            // Use TRIM() and LOWER() for safe comparison (handles whitespace and case differences)
            const normalizedComputerName = (deviceData.computer_name || '').trim();
            systemLog.info(`⚠️ Generic serial number detected: "${deviceData.serial_no}" - using computer_name "${normalizedComputerName}" for identification`);
            const [rows] = await connection.execute<RowDataPacket[]>(
                'SELECT id FROM devices WHERE LOWER(TRIM(serial_no)) = LOWER(TRIM(?)) AND LOWER(TRIM(computer_name)) = LOWER(TRIM(?))',
                [deviceData.serial_no, normalizedComputerName]
            );
            existing = rows;
        } else {
            // For proper serial numbers, use just serial_no
            const [rows] = await connection.execute<RowDataPacket[]>(
                'SELECT id FROM devices WHERE serial_no = ?',
                [deviceData.serial_no]
            );
            existing = rows;
        }

        if (existing.length > 0) {
            // Update existing device
            const deviceId = existing[0].id;
            await connection.execute<ResultSetHeader>(
                `UPDATE devices SET 
                 user_email = ?, computer_name = ?, os_type = ?, os_version = ?, last_seen = ?, 
                 status = ?, scanx_version = ?, osqueryi_version = ?, updated_at = CURRENT_TIMESTAMP 
                 WHERE id = ?`,
                [
                    deviceData.user_email,
                    deviceData.computer_name,
                    deviceData.os_type,
                    deviceData.os_version,
                    deviceData.last_seen,
                    getDeviceStatus(deviceData.last_seen || null),
                    deviceData.scanx_version,
                    deviceData.osqueryi_version,
                    deviceId
                ]
            );
            return deviceId;
        } else {
            // Create new device
            const [result] = await connection.execute<ResultSetHeader>(
                `INSERT INTO devices (user_email, serial_no, computer_name, os_type, os_version, last_seen, status, scanx_version, osqueryi_version) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    deviceData.user_email,
                    deviceData.serial_no,
                    deviceData.computer_name,
                    deviceData.os_type,
                    deviceData.os_version,
                    deviceData.last_seen,
                    getDeviceStatus(deviceData.last_seen || null),
                    deviceData.scanx_version,
                    deviceData.osqueryi_version
                ]
            );
            return result.insertId;
        }
    }

    // Get all devices (simplified for dashboard)
    static async findAll(): Promise<Device[]> {
        const connection = await getConnection();
        
        const [rows] = await connection.execute<RowDataPacket[]>(
            'SELECT * FROM devices ORDER BY last_seen DESC, created_at DESC'
        );
        
        return rows as Device[];
    }

    // Get all devices with enriched data for devices table
    static async findAllEnriched(
        searchTerm?: string, 
        osTypeFilter?: string,
        sortBy?: string,
        sortOrder?: 'asc' | 'desc',
        passwordManagerFilter?: 'true' | 'false',
        diskEncryptionFilter?: 'true' | 'false',
        antivirusFilter?: 'true' | 'false',
        screenLockFilter?: 'true' | 'false'
    ): Promise<any[]> {
        const connection = await getConnection();
        
        let query = `
            SELECT 
                d.*,
                ds.system_info as has_system_info,
                ds.password_manager_info as has_password_manager,
                ds.screen_lock_info as has_screen_lock,
                ds.antivirus_info as has_antivirus,
                ds.disk_encryption_info as has_disk_encryption,
                ds.apps_info as has_apps_info,
                ds.interval_info,
                ds.last_report
            FROM devices d
            LEFT JOIN device_summary ds ON d.id = ds.device_id
            WHERE 1=1
        `;
        
        const params: any[] = [];
        
        // Add search functionality - now includes OS version
        if (searchTerm && searchTerm.trim() !== '') {
            query += ` AND (
                d.serial_no LIKE ? OR
                d.user_email LIKE ? OR
                d.computer_name LIKE ? OR
                d.os_version LIKE ?
            )`;
            const searchPattern = `%${searchTerm.trim()}%`;
            params.push(searchPattern, searchPattern, searchPattern, searchPattern);
        }
        
        // Add OS type filter
        if (osTypeFilter && osTypeFilter.trim() !== '') {
            query += ` AND d.os_type = ?`;
            params.push(osTypeFilter.trim());
        }
        
        // Add security status filters (treat NULL as false)
        if (passwordManagerFilter !== undefined) {
            const value = passwordManagerFilter === 'true' ? 1 : 0;
            query += ` AND COALESCE(ds.password_manager_info, 0) = ?`;
            params.push(value);
        }
        
        if (diskEncryptionFilter !== undefined) {
            const value = diskEncryptionFilter === 'true' ? 1 : 0;
            query += ` AND COALESCE(ds.disk_encryption_info, 0) = ?`;
            params.push(value);
        }
        
        if (antivirusFilter !== undefined) {
            const value = antivirusFilter === 'true' ? 1 : 0;
            query += ` AND COALESCE(ds.antivirus_info, 0) = ?`;
            params.push(value);
        }
        
        if (screenLockFilter !== undefined) {
            const value = screenLockFilter === 'true' ? 1 : 0;
            query += ` AND COALESCE(ds.screen_lock_info, 0) = ?`;
            params.push(value);
        }
        
        // Add sorting
        const validSortFields = ['os_version', 'last_seen', 'created_at', 'computer_name', 'serial_no'];
        
        if (sortBy && validSortFields.includes(sortBy)) {
            const order = sortOrder && (sortOrder === 'asc' || sortOrder === 'desc') ? sortOrder.toUpperCase() : 'ASC';
            query += ` ORDER BY d.${sortBy} ${order}`;
            // Add secondary sort for consistency
            if (sortBy !== 'last_seen') {
                query += `, d.last_seen DESC`;
            }
        } else {
            // Default sorting if no sort specified
            query += ` ORDER BY d.last_seen DESC, d.created_at DESC`;
        }
        
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

    // Find device by serial number (and optionally computer_name for generic serial numbers)
    static async findBySerial(serial_no: string, computer_name?: string): Promise<Device | null> {
        const connection = await getConnection();
        
        // Check if this is a generic serial number
        if (isGenericSerialNumber(serial_no) && computer_name) {
            // For generic serial numbers, use BOTH serial_no AND computer_name
            // Use TRIM() and LOWER() for safe comparison (handles whitespace and case differences)
            const normalizedComputerName = computer_name.trim();
            const [rows] = await connection.execute<RowDataPacket[]>(
                'SELECT * FROM devices WHERE LOWER(TRIM(serial_no)) = LOWER(TRIM(?)) AND LOWER(TRIM(computer_name)) = LOWER(TRIM(?))',
                [serial_no, normalizedComputerName]
            );
            return rows.length > 0 ? rows[0] as Device : null;
        } else {
            // For proper serial numbers, use just serial_no
            const [rows] = await connection.execute<RowDataPacket[]>(
                'SELECT * FROM devices WHERE serial_no = ?',
                [serial_no]
            );
            return rows.length > 0 ? rows[0] as Device : null;
        }
    }

    // Find device by ID
    static async findById(id: number): Promise<Device | null> {
        const connection = await getConnection();
        const [rows] = await connection.execute<RowDataPacket[]>(
            'SELECT * FROM devices WHERE id = ?',
            [id]
        );
        return rows.length > 0 ? rows[0] as Device : null;
    }

    // Delete device by ID
    static async deleteById(id: number): Promise<void> {
        const connection = await getConnection();
        await connection.execute<ResultSetHeader>(
            'DELETE FROM devices WHERE id = ?',
            [id]
        );
        await connection.execute<ResultSetHeader>(
            'DELETE FROM device_summary WHERE device_id = ?',
            [id]
        );
        await connection.execute<ResultSetHeader>(
            'DELETE FROM system_info WHERE device_id = ?',
            [id]
        );
        await connection.execute<ResultSetHeader>(
            'DELETE FROM password_manager_info WHERE device_id = ?',
            [id]
        );
        await connection.execute<ResultSetHeader>(
            'DELETE FROM screen_lock_info WHERE device_id = ?',
            [id]
        );
        await connection.execute<ResultSetHeader>(
            'DELETE FROM antivirus_info WHERE device_id = ?',
            [id]
        );
        await connection.execute<ResultSetHeader>(
            'DELETE FROM disk_encryption_info WHERE device_id = ?',
            [id]
        );
        await connection.execute<ResultSetHeader>(
            'DELETE FROM apps_info WHERE device_id = ?',
            [id]
        );
        await connection.execute<ResultSetHeader>(
            'DELETE FROM device_interval_requests WHERE device_id = ?',
            [id]
        );
    }
    
    // Search devices by user email
    static async findByUser(user_email: string): Promise<Device[]> {
        const connection = await getConnection();
        const [rows] = await connection.execute<RowDataPacket[]>(
            'SELECT * FROM devices WHERE user_email LIKE ? ORDER BY last_seen DESC',
            [`%${user_email}%`]
        );
        return rows as Device[];
    }

    // Get device statistics
    static async getStats(): Promise<any> {
        const connection = await getConnection();
        
        const [totalDevices] = await connection.execute<RowDataPacket[]>(
            'SELECT COUNT(*) as total FROM devices'
        );
        
        // Online / recent activity: last_seen within 48 hours (2 days)
        const [onlineDevices] = await connection.execute<RowDataPacket[]>(
            'SELECT COUNT(*) as online FROM devices WHERE last_seen >= DATE_SUB(NOW(), INTERVAL 48 HOUR)'
        );

        const [recentActivity] = await connection.execute<RowDataPacket[]>(
            'SELECT COUNT(*) as recent FROM devices WHERE last_seen >= DATE_SUB(NOW(), INTERVAL 48 HOUR)'
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
        const connection = await getConnection();
        systemLog.info('device_latest_query', { device_id, dataType });
        
        try {
            const [rows] = await connection.execute<RowDataPacket[]>(
                // lastest data from the table
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
                            systemLog.warn('device_data_json_parse_failed', { dataType });
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
            systemLog.error('device_latest_fetch_failed', { dataType, device_id, error: String(error) });
            return null;
        }
    }

    // Get HISTORICAL data from specific table with pagination
    static async getDeviceDataHistory(device_id: number, dataType: string, page: number = 1, limit: number = 10): Promise<{data: any[], total: number, page: number, limit: number, totalPages: number}> {
        const connection = await getConnection();
        systemLog.info('device_history_query', { device_id, dataType, page, limit });
        
        // Validate dataType to prevent SQL injection (whitelist approach)
        const validDataTypes = ['disk_encryption_info', 'password_manager_info', 'antivirus_info', 'screen_lock_info', 'apps_info', 'system_info'];
        if (!validDataTypes.includes(dataType)) {
            systemLog.error('device_history_invalid_type', { dataType });
            return { data: [], total: 0, page, limit, totalPages: 0 };
        }
        
        try {
            // Get total count
            const [countRows] = await connection.execute<RowDataPacket[]>(
                `SELECT COUNT(*) as total FROM ${dataType} WHERE device_id = ?`,
                [device_id]
            );
            const total = countRows[0].total;
            
            // Calculate offset - ensure integers
            const limitInt = Math.floor(Number(limit));
            const offsetInt = Math.floor((Number(page) - 1) * limitInt);
            
            // Get paginated data
            // Note: LIMIT and OFFSET don't work well as prepared statement params in MySQL
            // Using string interpolation is safe here since we validate/convert to integers
            const [rows] = await connection.execute<RowDataPacket[]>(
                `SELECT * FROM ${dataType} WHERE device_id = ? ORDER BY timestamp DESC LIMIT ${limitInt} OFFSET ${offsetInt}`,
                [device_id]
            );
            
            systemLog.info(`Found ${rows.length} rows for ${dataType}, total: ${total}`);
            
            // Process each row
            const processedData = rows.map(row => {
                let parsedData = null;
                if (row.data) {
                    if (typeof row.data === 'string') {
                        try {
                            parsedData = JSON.parse(row.data);
                        } catch (error) {
                            systemLog.warn('device_data_json_parse_failed', { dataType });
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
            
            const totalPages = Math.ceil(total / limitInt);
            
            return {
                data: processedData,
                total,
                page,
                limit: limitInt,
                totalPages
            };
        } catch (error) {
            systemLog.error('device_history_fetch_failed', { dataType, device_id, error: String(error) });
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
        const connection = await getConnection();

        // First try to find existing summary by device_id
        const [existing] = await connection.execute<RowDataPacket[]>(
            'SELECT device_id FROM device_summary WHERE device_id = ?',
            [summary.device_id]
        );

        if (existing.length > 0) {
            // Update existing summary
            await connection.execute<ResultSetHeader>(
                `UPDATE device_summary SET 
                 last_report = ?, system_info = ?, password_manager_info = ?, 
                 screen_lock_info = ?, antivirus_info = ?, disk_encryption_info = ?, 
                 apps_info = ?, interval_info = ?, updated_at = CURRENT_TIMESTAMP 
                 WHERE device_id = ?`,
                [
                    summary.last_report,
                    summary.system_info || false,
                    summary.password_manager_info || false,
                    summary.screen_lock_info || false,
                    summary.antivirus_info || false,
                    summary.disk_encryption_info || false,
                    summary.apps_info || false,
                    summary.interval_info || null,
                    summary.device_id
                ]
            );
        } else {
            // Create new summary
            await connection.execute<ResultSetHeader>(
                `INSERT INTO device_summary (
                    device_id, last_report, system_info, password_manager_info, 
                    screen_lock_info, antivirus_info, disk_encryption_info, apps_info, interval_info
                 ) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    summary.device_id,
                    summary.last_report,
                    summary.system_info || false,
                    summary.password_manager_info || false,
                    summary.screen_lock_info || false,
                    summary.antivirus_info || false,
                    summary.disk_encryption_info || false,
                    summary.apps_info || false,
                    summary.interval_info || null
                ]
            );
        }
    }

    // Get device summary
    static async findByDevice(device_id: number): Promise<DeviceSummary | null> {
        const connection = await getConnection();
        const [rows] = await connection.execute<RowDataPacket[]>(
            'SELECT * FROM device_summary WHERE device_id = ?',
            [device_id]
        );
        
        if (rows.length === 0) return null;
        
        return rows[0] as DeviceSummary;
    }
}

