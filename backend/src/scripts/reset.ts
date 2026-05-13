#!/usr/bin/env ts-node

// Database reset script - drops entire database and recreates it
import 'dotenv/config';
import mysql from 'mysql2/promise';
import { env } from '../env/env';
import { initializeDatabaseWithMigrations } from '../db';
import { systemLog } from '../logger/logger';

async function resetDatabase() {
    let connection: mysql.Connection | null = null;
    
    try {
        systemLog.warn('database_reset_started');
        systemLog.info('database_reset_connecting_server');
        
        // Connect to MySQL server without specifying database
        connection = await mysql.createConnection({
            host: env.MYSQL_HOST || 'localhost',
            port: parseInt(env.MYSQL_PORT || '3306'),
            user: env.MYSQL_USER ,
            password: env.MYSQL_PASSWORD
            // No database specified - we'll recreate it
        });
        
        systemLog.info('database_reset_server_connected');
        
        // Drop the entire database
        const dbName = env.MYSQL_DATABASE || 'scanx';
        systemLog.warn('database_reset_dropping', { dbName });
        await connection.execute(`DROP DATABASE IF EXISTS ${dbName}`);
        
        // Recreate the database
        systemLog.info('database_reset_creating', { dbName });
        await connection.execute(`CREATE DATABASE ${dbName}`);
        
        // Close the server connection
        await connection.end();
        connection = null;
        
        systemLog.info('database_reset_recreated');
        systemLog.info('database_reset_running_migrations');
        
        // Now run the full initialization with the new database
        await initializeDatabaseWithMigrations();
        
        systemLog.info('database_reset_complete');
        process.exit(0);
        
    } catch (error: any) {
        systemLog.error('database_reset_failed', { error: error.message });
        process.exit(1);
    } finally {
        if (connection) {
            await connection.end();
        }
    }
}

// Reset database
resetDatabase();