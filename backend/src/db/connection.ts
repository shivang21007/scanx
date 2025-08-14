import mysql from 'mysql2/promise';
import { env } from '../env/env';

let connection: mysql.Connection | null = null;

export const connectDB = async () => {
    try {
        connection = await mysql.createConnection({
            host: env.MYSQL_HOST || 'localhost',
            port: parseInt(env.MYSQL_PORT || '3306'),
            user: env.MYSQL_USER,
            password: env.MYSQL_PASSWORD ,
            database: env.MYSQL_DATABASE || 'scanx'
        });
        
        console.log("MySQL connected successfully ....");
        
        return connection;
        
    } catch (err: any) {
        console.error("❌ MySQL Connection Error:", err.message);
        throw new Error(`Database connection failed: ${err.message}`);
    }
}

export const disconnectDB = async () => {
    try {
        if (connection) {
            await connection.end();
            connection = null;
            console.log("🔌 MySQL disconnected");
        }
    } catch (err: any) {
        console.error("❌ MySQL Disconnect Error:", err.message);
    }
}

export const getConnection = (): mysql.Connection => {
    if (!connection) {
        throw new Error('❌ Database not connected. Call connectDB() first.');
    }
    return connection;
}

// Test database connection
export const testConnection = async (): Promise<boolean> => {
    try {
        if (!connection) {
            await connectDB();
        }
        
        await connection!.ping();
        console.log("✅ Database connection test successful");
        return true;
    } catch (err: any) {
        console.error("❌ Database connection test failed:", err.message);
        return false;
    }
}