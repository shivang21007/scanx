import { getConnection } from '../db/connection';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

export type AccountType = 'user' | 'service';

export interface UserRecord {
  gid: number; 
  email: string;
  name: string;
  created_at?: Date | string | null;
  account_type: AccountType;
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
    const conn = getConnection();
    const [rows] = await conn.execute<RowDataPacket[]>(
      'SELECT * FROM users WHERE email = ? LIMIT 1',
      [email]
    );
    return rows.length ? (rows[0] as any as UserRecord) : null;
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
    const conn = getConnection();
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
          'INSERT INTO users (email, name, created_at, account_type) VALUES (?, ?, ?, ?)',
          [rec.email, rec.name, createdAt, accountType]
        );
        upserted++;
      }
    }

    return upserted;
  }

  static async list(params: { search?: string; limit?: number; offset?: number } = {}): Promise<UserRecord[]> {
    const conn = getConnection();
    const limit = Math.max(0, Math.min(params.limit ?? 50, 200));
    const offset = Math.max(0, params.offset ?? 0);
    const search = (params.search || '').trim();

    if (search) {
      const sql = `SELECT * FROM users WHERE email LIKE ? OR name LIKE ? ORDER BY email ASC LIMIT ${limit} OFFSET ${offset}`;
      const [rows] = await conn.execute<RowDataPacket[]>(sql, [`%${search}%`, `%${search}%`]);
      return rows as any as UserRecord[];
    }

    const sql = `SELECT * FROM users ORDER BY email ASC LIMIT ${limit} OFFSET ${offset}`;
    const [rows] = await conn.execute<RowDataPacket[]>(sql);
    return rows as any as UserRecord[];
  }

  static async count(params: { search?: string } = {}): Promise<number> {
    const conn = getConnection();
    const search = (params.search || '').trim();
    if (search) {
      const [rows] = await conn.execute<RowDataPacket[]>(
        'SELECT COUNT(1) as c FROM users WHERE email LIKE ? OR name LIKE ?',
        [`%${search}%`, `%${search}%`]
      );
      return Number((rows[0] as any).c || 0);
    }
    const [rows] = await conn.execute<RowDataPacket[]>(
      'SELECT COUNT(1) as c FROM users'
    );
    return Number((rows[0] as any).c || 0);
  }

  static async updateAccountType(gid: number, accountType: AccountType): Promise<boolean> {
    const conn = getConnection();
    const normalizedType = this.normalizeAccountType(accountType);
    
    const [result] = await conn.execute<ResultSetHeader>(
      'UPDATE users SET account_type = ?, updated_at = CURRENT_TIMESTAMP WHERE gid = ?',
      [normalizedType, gid]
    );
    
    return result.affectedRows > 0;
  }

  static async delete(gid: number): Promise<boolean> {
    const conn = getConnection();
    
    const [result] = await conn.execute<ResultSetHeader>(
      'DELETE FROM users WHERE gid = ?',
      [gid]
    );
    
    return result.affectedRows > 0;
  }
}


