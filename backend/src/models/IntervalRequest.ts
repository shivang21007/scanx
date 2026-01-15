import { getConnection } from '../db/connection';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

export interface DeviceIntervalRequest {
    id?: number;
    device_id: number;
    requested_interval: string;  // e.g., "2h", "30m"
    requested_interval_seconds: number;
    status: 'pending' | 'applied' | 'failed' | 'cancelled';
    requested_by?: string;
    requested_at?: Date;
    applied_at?: Date | null;
    agent_confirmation?: any;
    updated_at?: Date;
}

export class DeviceIntervalRequestModel {
    // Create a new interval request
    static async create(request: Omit<DeviceIntervalRequest, 'id' | 'updated_at' | 'applied_at'>): Promise<number> {
        const connection = await getConnection();
        
        // Cancel any existing pending requests for this device
        await connection.execute(
            `UPDATE device_interval_requests 
             SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP 
             WHERE device_id = ? AND status = 'pending'`,
            [request.device_id]
        );
        
        const [result] = await connection.execute<ResultSetHeader>(
            `INSERT INTO device_interval_requests 
             (device_id, requested_interval, requested_interval_seconds, status, requested_by) 
             VALUES (?, ?, ?, ?, ?)`,
            [
                request.device_id,
                request.requested_interval,
                request.requested_interval_seconds,
                request.status || 'pending',
                request.requested_by || null
            ]
        );
        
        return result.insertId;
    }
    
    // Get pending request for a device
    static async getPendingByDeviceId(device_id: number): Promise<DeviceIntervalRequest | null> {
        const connection = await getConnection();
        const [rows] = await connection.execute<RowDataPacket[]>(
            `SELECT * FROM device_interval_requests 
             WHERE device_id = ? AND status = 'pending' 
             ORDER BY requested_at DESC LIMIT 1`,
            [device_id]
        );
        
        return rows.length > 0 ? rows[0] as DeviceIntervalRequest : null;
    }
    
    // Mark request as applied
    static async markAsApplied(id: number, agentConfirmation: any): Promise<void> {
        const connection = await getConnection();
        await connection.execute(
            `UPDATE device_interval_requests 
             SET status = 'applied', applied_at = CURRENT_TIMESTAMP, 
                 agent_confirmation = ?, updated_at = CURRENT_TIMESTAMP 
             WHERE id = ?`,
            [JSON.stringify(agentConfirmation), id]
        );
    }
    
    // Mark request as failed
    static async markAsFailed(id: number, reason?: string): Promise<void> {
        const connection = await getConnection();
        await connection.execute(
            `UPDATE device_interval_requests 
             SET status = 'failed', updated_at = CURRENT_TIMESTAMP 
             WHERE id = ?`,
            [id]
        );
    }
    
    // Get all requests for a device (for history) - paginated
    static async getByDeviceId(device_id: number, page: number = 1, limit: number = 10): Promise<{
        data: DeviceIntervalRequest[];
        total: number;
        page: number;
        limit: number;
        totalPages: number;
    }> {
        const connection = await getConnection();
        
        // Get total count
        const [countRows] = await connection.execute<RowDataPacket[]>(
            `SELECT COUNT(*) as total FROM device_interval_requests WHERE device_id = ?`,
            [device_id]
        );
        const total = countRows[0].total;
        
        // Calculate offset
        const limitInt = Math.floor(Number(limit));
        const offsetInt = Math.floor((Number(page) - 1) * limitInt);
        
        // Get paginated data
        const [rows] = await connection.execute<RowDataPacket[]>(
            `SELECT * FROM device_interval_requests 
             WHERE device_id = ? 
             ORDER BY requested_at DESC 
             LIMIT ${limitInt} OFFSET ${offsetInt}`,
            [device_id]
        );
        
        const totalPages = Math.ceil(total / limitInt);
        
        return {
            data: rows as DeviceIntervalRequest[],
            total,
            page,
            limit: limitInt,
            totalPages
        };
    }
    
    // Delete interval request by ID
    static async deleteById(id: number): Promise<boolean> {
        const connection = await getConnection();
        const [result] = await connection.execute<ResultSetHeader>(
            `DELETE FROM device_interval_requests WHERE id = ?`,
            [id]
        );
        
        return result.affectedRows > 0;
    }
}

// Helper function to convert interval string to seconds
export function parseIntervalToSeconds(intervalStr: string): number {
    // Parse formats like "2h", "30m", "1h30m", "90m"
    const regex = /(?:(\d+)h)?(?:(\d+)m)?/;
    const match = intervalStr.match(regex);
    
    if (!match) {
        throw new Error(`Invalid interval format: ${intervalStr}`);
    }
    
    const hours = parseInt(match[1] || '0', 10);
    const minutes = parseInt(match[2] || '0', 10);
    
    return (hours * 3600) + (minutes * 60);
}
