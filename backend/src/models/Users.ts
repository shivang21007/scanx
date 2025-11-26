import { getConnection } from '../db/connection';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

export type AccountType = 'user' | 'service';

export interface UserRecord {
  gid: number; 
  email: string;
  name: string;
  created_at?: Date | string | null;
  account_type: AccountType;
  device_id?: number[] | null;
  updated_at?: Date;
}

export class UsersModel {
  private static toMySQLDateTime(value?: Date | string | null): string | null {
    if (!value) return null;
    const d = value instanceof Date ? value : new Date(value);
    if (isNaN(d.getTime())) return null;
    const iso = d.toISOString(); // 2024-06-07T08:44:33.000Z
    const trimmed = iso.replace('T', ' ').replace('Z', '');
    return trimmed.substring(0, 19); // 2024-06-07 08:44:33
  }
  static async findByEmail(email: string): Promise<UserRecord | null> {
    const conn = await getConnection();
    const [rows] = await conn.execute<RowDataPacket[]>(
      'SELECT * FROM users WHERE email = ? LIMIT 1',
      [email]
    );
    if (rows.length === 0) return null;
    
    const row = rows[0] as any;
    // Parse device_id JSON if it exists
    let device_id: number[] | null = null;
    if (row.device_id) {
      try {
        device_id = typeof row.device_id === 'string' ? JSON.parse(row.device_id) : row.device_id;
      } catch {
        device_id = null;
      }
    }
    
    return { ...row, device_id } as UserRecord;
  }

  static async emailExists(email: string): Promise<boolean> {
    const rec = await this.findByEmail(email);
    return !!rec;
  }

  // No custom id generation; gid is AUTO_INCREMENT

  static normalizeAccountType(v?: string | null): AccountType {
    return v === 'service' ? 'service' : 'user';
  }

  static async upsertMany(records: Array<{ email: string; name: string; createdAt?: Date | string | null; account_type: AccountType }>): Promise<number> {
    if (!records.length) return 0;
    const conn = await getConnection();
    let upserted = 0;

    for (const rec of records) {
      const createdAt = this.toMySQLDateTime(rec.createdAt || null);
      const existing = await this.findByEmail(rec.email);
      const accountType = this.normalizeAccountType(rec.account_type);
      if (existing) {
        // Update only if changed (diff-only update)
        const needsUpdate =
          existing.name !== rec.name ||
          ((existing as any).created_at || null) !== createdAt ||
          existing.account_type !== accountType;
        if (needsUpdate) {
          await conn.execute<ResultSetHeader>(
            'UPDATE users SET name = ?, created_at = ?, account_type = ? WHERE email = ?',
            [rec.name, createdAt, accountType, rec.email]
          );
          upserted++;
        }
      } else {
        // Insert new (gid auto-increment)
        await conn.execute<ResultSetHeader>(
          'INSERT INTO users (email, name, created_at, account_type, device_id) VALUES (?, ?, ?, ?, ?)',
          [rec.email, rec.name, createdAt, accountType, JSON.stringify([])]
        );
        upserted++;
      }
    }

    return upserted;
  }

  static async list(params: { search?: string; limit?: number; offset?: number; enrollment?: 'enrolled' | 'un-enrolled' } = {}): Promise<UserRecord[]> {
    const conn = await getConnection();
    const limit = Math.max(0, Math.min(params.limit ?? 50, 200));
    const offset = Math.max(0, params.offset ?? 0);
    const search = (params.search || '').trim();
    const enrollment = params.enrollment;

    let whereConditions: string[] = [];
    let queryParams: any[] = [];

    // Search filter
    if (search) {
      whereConditions.push('(email LIKE ? OR name LIKE ?)');
      queryParams.push(`%${search}%`, `%${search}%`);
    }

    // Enrollment filter
    if (enrollment === 'enrolled') {
      // Users with devices (device_id is not null and has values)
      whereConditions.push('(device_id IS NOT NULL AND JSON_LENGTH(COALESCE(device_id, JSON_ARRAY())) > 0)');
    } else if (enrollment === 'un-enrolled') {
      // Users without devices (device_id is null or empty array)
      whereConditions.push('(device_id IS NULL OR JSON_LENGTH(COALESCE(device_id, JSON_ARRAY())) = 0)');
    }

    const whereClause = whereConditions.length > 0 
      ? `WHERE ${whereConditions.join(' AND ')}` 
      : '';

    const sql = `SELECT * FROM users ${whereClause} ORDER BY email ASC LIMIT ${limit} OFFSET ${offset}`;
    const [rows] = await conn.execute<RowDataPacket[]>(sql, queryParams);
    
    // Parse device_id JSON for each row
    return rows.map((row: any) => {
      let device_id: number[] | null = null;
      if (row.device_id) {
        try {
          device_id = typeof row.device_id === 'string' ? JSON.parse(row.device_id) : row.device_id;
        } catch {
          device_id = null;
        }
      }
      return { ...row, device_id } as UserRecord;
    });
  }

  static async count(params: { search?: string; enrollment?: 'enrolled' | 'un-enrolled' } = {}): Promise<number> {
    const conn = await getConnection();
    const search = (params.search || '').trim();
    const enrollment = params.enrollment;

    let whereConditions: string[] = [];
    let queryParams: any[] = [];

    // Search filter
    if (search) {
      whereConditions.push('(email LIKE ? OR name LIKE ?)');
      queryParams.push(`%${search}%`, `%${search}%`);
    }

    // Enrollment filter
    if (enrollment === 'enrolled') {
      // Users with devices (device_id is not null and has values)
      whereConditions.push('(device_id IS NOT NULL AND JSON_LENGTH(COALESCE(device_id, JSON_ARRAY())) > 0)');
    } else if (enrollment === 'un-enrolled') {
      // Users without devices (device_id is null or empty array)
      whereConditions.push('(device_id IS NULL OR JSON_LENGTH(COALESCE(device_id, JSON_ARRAY())) = 0)');
    }

    const whereClause = whereConditions.length > 0 
      ? `WHERE ${whereConditions.join(' AND ')}` 
      : '';

    const [rows] = await conn.execute<RowDataPacket[]>(
      `SELECT COUNT(1) as c FROM users ${whereClause}`,
      queryParams
    );
    return Number((rows[0] as any).c || 0);
  }

  static async updateAccountType(gid: number, accountType: AccountType): Promise<boolean> {
    const conn = await getConnection();
    const normalizedType = this.normalizeAccountType(accountType);
    
    const [result] = await conn.execute<ResultSetHeader>(
      'UPDATE users SET account_type = ?, updated_at = CURRENT_TIMESTAMP WHERE gid = ?',
      [normalizedType, gid]
    );
    
    return result.affectedRows > 0;
  }

  static async delete(gid: number): Promise<boolean> {
    const conn = await getConnection();
    
    const [result] = await conn.execute<ResultSetHeader>(
      'DELETE FROM users WHERE gid = ?',
      [gid]
    );
    
    return result.affectedRows > 0;
  }

  static async create(name: string, email: string, account_type: AccountType): Promise<UserRecord> {
    const conn = await getConnection();
    const createdAt = this.toMySQLDateTime(new Date());
    const normalizedType = this.normalizeAccountType(account_type);
    const [result] = await conn.execute<ResultSetHeader>(
      'INSERT INTO users (name, email, account_type, created_at, device_id) VALUES (?, ?, ?, ?, ?)',
      [name, email, normalizedType, createdAt, JSON.stringify([])]
    );
    return { gid: result.insertId, name, email, account_type, created_at: createdAt, device_id: [] };
  }

  // Add device_id to user's device_id array
  static async addDevice(email: string, deviceId: number): Promise<boolean> {
    const conn = await getConnection();
    const user = await this.findByEmail(email);
    
    if (!user) {
      return false;
    }
    
    // Parse existing device_id array or initialize empty array
    let device_ids: number[] = [];
    if (user.device_id && Array.isArray(user.device_id)) {
      device_ids = [...user.device_id];
    } else if (user.device_id) {
      // Handle case where device_id might be a JSON string
      try {
        device_ids = typeof user.device_id === 'string' ? JSON.parse(user.device_id) : user.device_id;
      } catch {
        device_ids = [];
      }
    }
    
    // Add device_id if not already present
    if (!device_ids.includes(deviceId)) {
      device_ids.push(deviceId);
      
      await conn.execute<ResultSetHeader>(
        'UPDATE users SET device_id = ?, updated_at = CURRENT_TIMESTAMP WHERE email = ?',
        [JSON.stringify(device_ids), email]
      );
      
      return true;
    }
    
    return false;
  }

  // Remove device_id from user's device_id array
  static async removeDevice(email: string, deviceId: number): Promise<boolean> {
    const conn = await getConnection();
    const user = await this.findByEmail(email);
    
    if (!user) {
      return false;
    }
    
    // Parse existing device_id array
    let device_ids: number[] = [];
    if (user.device_id && Array.isArray(user.device_id)) {
      device_ids = [...user.device_id];
    } else if (user.device_id) {
      try {
        device_ids = typeof user.device_id === 'string' ? JSON.parse(user.device_id) : user.device_id;
      } catch {
        device_ids = [];
      }
    }
    
    // Remove device_id if present
    const index = device_ids.indexOf(deviceId);
    if (index > -1) {
      device_ids.splice(index, 1);
      
      await conn.execute<ResultSetHeader>(
        'UPDATE users SET device_id = ?, updated_at = CURRENT_TIMESTAMP WHERE email = ?',
        [JSON.stringify(device_ids), email]
      );
      
      return true;
    }
    
    return false;
  }

  // Get device count for a user
  static async getDeviceCount(email: string): Promise<number> {
    const user = await this.findByEmail(email);
    if (!user || !user.device_id) {
      return 0;
    }
    
    let device_ids: number[] = [];
    if (Array.isArray(user.device_id)) {
      device_ids = user.device_id;
    } else if (typeof user.device_id === 'string') {
      try {
        device_ids = JSON.parse(user.device_id);
      } catch {
        return 0;
      }
    }
    
    return device_ids.length;
  }
}


