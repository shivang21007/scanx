import { getConnection } from '../db/connection';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import { isEmailProtectedFromSync } from '../utils/userSyncProtected';

export type AccountType = 'user' | 'service';
export type UserStatus = 'active' | 'inactive';

export interface UserRecord {
  gid: number;
  email: string;
  name: string;
  created_at?: Date | string | null;
  account_type: AccountType;
  status?: UserStatus;
  device_id?: number[] | null;
  updated_at?: Date;
}

export class UsersModel {
  private static toMySQLDateTime(value?: Date | string | null): string | null {
    if (!value) return null;
    const d = value instanceof Date ? value : new Date(value);
    if (isNaN(d.getTime())) return null;
    const iso = d.toISOString();
    const trimmed = iso.replace('T', ' ').replace('Z', '');
    return trimmed.substring(0, 19);
  }

  private static parseDeviceIdJson(raw: unknown): number[] {
    if (!raw) return [];
    if (Array.isArray(raw)) return raw.filter((n) => typeof n === 'number');
    if (typeof raw === 'string') {
      try {
        const arr = JSON.parse(raw);
        return Array.isArray(arr) ? arr.filter((n: unknown) => typeof n === 'number') : [];
      } catch {
        return [];
      }
    }
    return [];
  }

  private static rowToUserRecord(row: any): UserRecord {
    const device_id = this.parseDeviceIdJson(row.device_id);
    const status: UserStatus =
      row.status === 'inactive' ? 'inactive' : 'active';
    return { ...row, device_id, status } as UserRecord;
  }

  static async findByGid(gid: number): Promise<UserRecord | null> {
    const conn = await getConnection();
    const [rows] = await conn.execute<RowDataPacket[]>(
      'SELECT * FROM users WHERE gid = ? LIMIT 1',
      [gid]
    );
    if (rows.length === 0) return null;
    return this.rowToUserRecord(rows[0]);
  }

  static async findByEmail(email: string): Promise<UserRecord | null> {
    const conn = await getConnection();
    const [rows] = await conn.execute<RowDataPacket[]>(
      'SELECT * FROM users WHERE email = ? LIMIT 1',
      [email]
    );
    if (rows.length === 0) return null;
    return this.rowToUserRecord(rows[0]);
  }

  static async emailExists(email: string): Promise<boolean> {
    const rec = await this.findByEmail(email);
    return !!rec;
  }

  static normalizeAccountType(v?: string | null): AccountType {
    return v === 'service' ? 'service' : 'user';
  }

  static normalizeStatus(v?: string | null): UserStatus {
    return v === 'inactive' ? 'inactive' : 'active';
  }

  /**
   * Google directory sync upsert.
   * - New email: insert with directory account_type and status active.
   * - Existing email: no changes (preserve admin status, account_type, name, dates).
   */
  static async upsertManyFromDirectory(
    records: Array<{
      email: string;
      name: string;
      createdAt?: Date | string | null;
      account_type: AccountType;
    }>
  ): Promise<{ inserted: number; skippedExisting: number }> {
    if (!records.length) return { inserted: 0, skippedExisting: 0 };
    const conn = await getConnection();
    let inserted = 0;
    let skippedExisting = 0;

    for (const rec of records) {
      const createdAt = this.toMySQLDateTime(rec.createdAt || null);
      const existing = await this.findByEmail(rec.email);
      const accountType = this.normalizeAccountType(rec.account_type);

      if (existing) {
        skippedExisting++;
        continue;
      }

      await conn.execute<ResultSetHeader>(
        'INSERT INTO users (email, name, created_at, account_type, status, device_id) VALUES (?, ?, ?, ?, ?, ?)',
        [rec.email, rec.name, createdAt, accountType, 'active', JSON.stringify([])]
      );
      inserted++;
    }

    return { inserted, skippedExisting };
  }

  /** @deprecated Do not use for directory sync — admin inactive/service must be preserved. */
  static async activateUsersPresentInDirectory(canonicalEmails: string[]): Promise<number> {
    if (!canonicalEmails.length) return 0;
    const conn = await getConnection();
    let total = 0;
    const chunk = 150;
    for (let i = 0; i < canonicalEmails.length; i += chunk) {
      const slice = canonicalEmails.slice(i, i + chunk);
      const placeholders = slice.map(() => '?').join(',');
      const [result] = await conn.execute<ResultSetHeader>(
        `UPDATE users SET status = 'active', updated_at = CURRENT_TIMESTAMP WHERE email IN (${placeholders})`,
        slice
      );
      total += result.affectedRows;
    }
    return total;
  }

  /**
   * Active users not in directory (by lowercase email) and not protected → inactive, device_id cleared, purge jobs returned for enqueue.
   */
  static async deactivateUsersMissingFromDirectory(
    directoryEmailsLower: Set<string>
  ): Promise<{
    deactivated: Array<{ gid: number; email: string; deviceIds: number[] }>;
    skippedProtected: string[];
  }> {
    const conn = await getConnection();
    const [rows] = await conn.execute<RowDataPacket[]>(
      "SELECT gid, email, device_id, status FROM users WHERE status = 'active'"
    );

    const deactivated: Array<{ gid: number; email: string; deviceIds: number[] }> = [];
    const skippedProtected: string[] = [];

    for (const row of rows as any[]) {
      const email = String(row.email);
      const lower = email.toLowerCase();
      if (directoryEmailsLower.has(lower)) continue;
      if (isEmailProtectedFromSync(email)) {
        skippedProtected.push(email);
        continue;
      }
      const deviceIds = this.parseDeviceIdJson(row.device_id);
      await conn.execute<ResultSetHeader>(
        "UPDATE users SET status = 'inactive', device_id = ?, updated_at = CURRENT_TIMESTAMP WHERE gid = ?",
        [JSON.stringify([]), row.gid]
      );
      deactivated.push({ gid: row.gid, email, deviceIds });
    }

    return { deactivated, skippedProtected };
  }

  static async list(
    params: {
      search?: string;
      limit?: number;
      offset?: number;
      enrollment?: 'enrolled' | 'un-enrolled';
      createdSort?: 'asc' | 'desc' | null;
      status?: UserStatus | 'all';
      account_type?: AccountType;
    } = {}
  ): Promise<UserRecord[]> {
    const conn = await getConnection();
    const limit = Math.max(0, Math.min(params.limit ?? 50, 200));
    const offset = Math.max(0, params.offset ?? 0);
    const search = (params.search || '').trim();
    const enrollment = params.enrollment;
    const createdSort = params.createdSort;
    const statusFilter = params.status;
    const accountTypeFilter = params.account_type;

    let whereConditions: string[] = [];
    let queryParams: any[] = [];

    if (search) {
      whereConditions.push('(email LIKE ? OR name LIKE ?)');
      queryParams.push(`%${search}%`, `%${search}%`);
    }

    if (enrollment === 'enrolled') {
      whereConditions.push(
        '(device_id IS NOT NULL AND JSON_LENGTH(COALESCE(device_id, JSON_ARRAY())) > 0)'
      );
    } else if (enrollment === 'un-enrolled') {
      whereConditions.push(
        '(device_id IS NULL OR JSON_LENGTH(COALESCE(device_id, JSON_ARRAY())) = 0)'
      );
    }

    if (statusFilter === 'active' || statusFilter === 'inactive') {
      whereConditions.push('status = ?');
      queryParams.push(statusFilter);
    }

    if (accountTypeFilter === 'user' || accountTypeFilter === 'service') {
      whereConditions.push('account_type = ?');
      queryParams.push(accountTypeFilter);
    }

    const whereClause =
      whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    let orderByClause = 'ORDER BY email ASC';
    if (createdSort === 'asc' || createdSort === 'desc') {
      orderByClause = `ORDER BY created_at ${createdSort.toUpperCase()}`;
    }

    const sql = `SELECT * FROM users ${whereClause} ${orderByClause} LIMIT ${limit} OFFSET ${offset}`;
    const [rows] = await conn.execute<RowDataPacket[]>(sql, queryParams);

    return (rows as any[]).map((row) => this.rowToUserRecord(row));
  }

  static async count(
    params: {
      search?: string;
      enrollment?: 'enrolled' | 'un-enrolled';
      status?: UserStatus | 'all';
      account_type?: AccountType;
    } = {}
  ): Promise<number> {
    const conn = await getConnection();
    const search = (params.search || '').trim();
    const enrollment = params.enrollment;
    const statusFilter = params.status;
    const accountTypeFilter = params.account_type;

    let whereConditions: string[] = [];
    let queryParams: any[] = [];

    if (search) {
      whereConditions.push('(email LIKE ? OR name LIKE ?)');
      queryParams.push(`%${search}%`, `%${search}%`);
    }

    if (enrollment === 'enrolled') {
      whereConditions.push(
        '(device_id IS NOT NULL AND JSON_LENGTH(COALESCE(device_id, JSON_ARRAY())) > 0)'
      );
    } else if (enrollment === 'un-enrolled') {
      whereConditions.push(
        '(device_id IS NULL OR JSON_LENGTH(COALESCE(device_id, JSON_ARRAY())) = 0)'
      );
    }

    if (statusFilter === 'active' || statusFilter === 'inactive') {
      whereConditions.push('status = ?');
      queryParams.push(statusFilter);
    }

    if (accountTypeFilter === 'user' || accountTypeFilter === 'service') {
      whereConditions.push('account_type = ?');
      queryParams.push(accountTypeFilter);
    }

    const whereClause =
      whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

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

  /** Set status to inactive and clear device_id JSON (purge is enqueued separately). */
  static async setInactiveAndClearDevices(gid: number): Promise<boolean> {
    const conn = await getConnection();
    const [result] = await conn.execute<ResultSetHeader>(
      "UPDATE users SET status = 'inactive', device_id = ?, updated_at = CURRENT_TIMESTAMP WHERE gid = ?",
      [JSON.stringify([]), gid]
    );
    return result.affectedRows > 0;
  }

  static async setActive(gid: number): Promise<boolean> {
    const conn = await getConnection();
    const [result] = await conn.execute<ResultSetHeader>(
      "UPDATE users SET status = 'active', updated_at = CURRENT_TIMESTAMP WHERE gid = ?",
      [gid]
    );
    return result.affectedRows > 0;
  }

  static async delete(gid: number): Promise<boolean> {
    const conn = await getConnection();

    const [result] = await conn.execute<ResultSetHeader>('DELETE FROM users WHERE gid = ?', [gid]);

    return result.affectedRows > 0;
  }

  static async create(name: string, email: string, account_type: AccountType): Promise<UserRecord> {
    const conn = await getConnection();
    const createdAt = this.toMySQLDateTime(new Date());
    const normalizedType = this.normalizeAccountType(account_type);
    const [result] = await conn.execute<ResultSetHeader>(
      'INSERT INTO users (name, email, account_type, created_at, status, device_id) VALUES (?, ?, ?, ?, ?, ?)',
      [name, email, normalizedType, createdAt, 'active', JSON.stringify([])]
    );
    return {
      gid: result.insertId,
      name,
      email,
      account_type: normalizedType,
      status: 'active',
      created_at: createdAt,
      device_id: [],
    };
  }

  static async addDevice(email: string, deviceId: number): Promise<boolean> {
    const conn = await getConnection();
    const user = await this.findByEmail(email);

    if (!user) {
      return false;
    }

    if (user.status === 'inactive') {
      return false;
    }

    let device_ids: number[] = [];
    if (user.device_id && Array.isArray(user.device_id)) {
      device_ids = [...user.device_id];
    } else if (user.device_id) {
      try {
        device_ids =
          typeof user.device_id === 'string' ? JSON.parse(user.device_id) : user.device_id;
      } catch {
        device_ids = [];
      }
    }

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

  static async removeDevice(email: string, deviceId: number): Promise<boolean> {
    const conn = await getConnection();
    const user = await this.findByEmail(email);

    if (!user) {
      return false;
    }

    let device_ids: number[] = [];
    if (user.device_id && Array.isArray(user.device_id)) {
      device_ids = [...user.device_id];
    } else if (user.device_id) {
      try {
        device_ids =
          typeof user.device_id === 'string' ? JSON.parse(user.device_id) : user.device_id;
      } catch {
        device_ids = [];
      }
    }

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
