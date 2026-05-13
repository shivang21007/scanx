import mysql from 'mysql2/promise';
import { env } from '../env/env';
import { systemLog } from '../logger/logger';

// Use connection pool instead of single connection for better reliability
const mysqlPool = mysql.createPool({
    host: env.MYSQL_HOST || 'localhost',
    port: parseInt(env.MYSQL_PORT || '3306'),
    user: env.MYSQL_USER,
    password: env.MYSQL_PASSWORD,
    database: env.MYSQL_DATABASE || 'scanx',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    // Connection timeout settings
    connectTimeout: 60000, // 60 seconds
    // Connection pool will automatically handle reconnection
    // Pool manages connection lifecycle automatically
});

let poolConnection: mysql.PoolConnection | null = null;

// Ensure we have a valid connection from the pool
const ensureConnection = async (): Promise<mysql.PoolConnection> => {
    try {
        // If we have a connection, test if it's still alive
        if (poolConnection) {
            try {
                // Try to ping the connection
                await poolConnection.ping();
                return poolConnection;
            } catch (pingError) {
                // Connection is dead, release it and get a new one
                systemLog.info("⚠️  Connection lost, reconnecting...");
                try {
                    poolConnection.release();
                } catch (e) {
                    // Ignore release errors if connection is already closed
                }
                poolConnection = null;
            }
        }
        
        // Get a new connection from the pool
        poolConnection = await mysqlPool.getConnection();
        systemLog.info("✅ Database connection established from pool");
        return poolConnection;
        
    } catch (err: any) {
        systemLog.error('mysql_pool_connection_failed', { error: err.message });
        throw new Error(`Database connection failed: ${err.message}`);
    }
};

export const connectDB = async () => {
    try {
        // Test pool connection
        const testConn = await mysqlPool.getConnection();
        await testConn.ping();
        testConn.release();
        
        // Get a persistent connection from pool for compatibility
        poolConnection = await mysqlPool.getConnection();
        
        systemLog.info("✅ MySQL pool connected successfully");
        return poolConnection;
        
    } catch (err: any) {
        systemLog.error('mysql_connect_failed', { error: err.message });
        throw new Error(`Database connection failed: ${err.message}`);
    }
}

export const disconnectDB = async () => {
    try {
        if (poolConnection) {
            poolConnection.release();
            poolConnection = null;
        }
        await mysqlPool.end();
        systemLog.info("🔌 MySQL pool disconnected");
    } catch (err: any) {
        systemLog.error('mysql_disconnect_error', { error: err.message });
    }
}

// Get connection with automatic reconnection
export const getConnection = async (): Promise<mysql.PoolConnection> => {
    return await ensureConnection();
}

// Synchronous version for backward compatibility (deprecated - will auto-reconnect)
// Note: This maintains backward compatibility but models should migrate to async getConnection
export const getConnectionSync = (): mysql.PoolConnection => {
    if (!poolConnection) {
        throw new Error('❌ Database not connected. Call connectDB() first.');
    }
    return poolConnection;
}

// Test database connection
export const testConnection = async (): Promise<boolean> => {
    try {
        const conn = await ensureConnection();
        await conn.ping();
        systemLog.info("✅ Database connection test successful");
        return true;
    } catch (err: any) {
        systemLog.error('mysql_connection_test_failed', { error: err.message });
        return false;
    }
}