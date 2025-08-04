import { getConnection } from '../db/connection';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

export interface Admin {
    id?: number;
    email: string;
    password: string;
    name?: string;
    created_at?: Date;
    updated_at?: Date;
}

export class AdminModel {
    // Create new admin
    static async create(admin: Omit<Admin, 'id' | 'created_at' | 'updated_at'>): Promise<number> {
        const connection = getConnection();
        const [result] = await connection.execute<ResultSetHeader>(
            'INSERT INTO admins (email, password, name) VALUES (?, ?, ?)',
            [admin.email, admin.password, admin.name || null]
        );
        return result.insertId;
    }

    // Find admin by email
    static async findByEmail(email: string): Promise<Admin | null> {
        const connection = getConnection();
        const [rows] = await connection.execute<RowDataPacket[]>(
            'SELECT * FROM admins WHERE email = ?',
            [email]
        );
        return rows.length > 0 ? rows[0] as Admin : null;
    }

    // Find admin by ID
    static async findById(id: number): Promise<Admin | null> {
        const connection = getConnection();
        const [rows] = await connection.execute<RowDataPacket[]>(
            'SELECT * FROM admins WHERE id = ?',
            [id]
        );
        return rows.length > 0 ? rows[0] as Admin : null;
    }

    // Get all admins
    static async findAll(): Promise<Admin[]> {
        const connection = getConnection();
        const [rows] = await connection.execute<RowDataPacket[]>(
            'SELECT id, email, name, created_at, updated_at FROM admins ORDER BY created_at DESC'
        );
        return rows as Admin[];
    }

    // Update admin
    static async update(id: number, updates: Partial<Admin>): Promise<boolean> {
        const connection = getConnection();
        const fields = Object.keys(updates).filter(key => key !== 'id');
        const values = fields.map(key => updates[key as keyof Admin]);
        
        if (fields.length === 0) return false;
        
        const setClause = fields.map(field => `${field} = ?`).join(', ');
        const [result] = await connection.execute<ResultSetHeader>(
            `UPDATE admins SET ${setClause} WHERE id = ?`,
            [...values, id]
        );
        return result.affectedRows > 0;
    }

    // Delete admin
    static async delete(id: number): Promise<boolean> {
        const connection = getConnection();
        const [result] = await connection.execute<ResultSetHeader>(
            'DELETE FROM admins WHERE id = ?',
            [id]
        );
        return result.affectedRows > 0;
    }
}

