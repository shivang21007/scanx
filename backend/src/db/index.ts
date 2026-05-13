// Database module exports
export { connectDB, disconnectDB, getConnection, testConnection } from './connection';
export { initializeSchema, dropAllTables, TABLES } from './schema';
export { runMigrations, getExecutedMigrations } from './migrations';

// Import functions for internal use
import { connectDB as _connectDB } from './connection';
import { initializeSchema as _initializeSchema } from './schema';
import { runMigrations as _runMigrations } from './migrations';
import { systemLog } from '../logger/logger';

// Simple database connection for server startup (assume schema exists)
export const initializeDatabase = async () => {
    try {
        systemLog.info('db_connect_startup');
        
        // Just connect to database - schema should already exist from migrations
        await _connectDB();
        
        systemLog.info('db_connected');
        
    } catch (err: any) {
        systemLog.error('db_connect_failed', { error: err.message });
        throw err;
    }
};

// Complete database setup with migrations (for migration script)
export const initializeDatabaseWithMigrations = async () => {
    try {
        systemLog.info('db_setup_migrations_start');
        
        // Step 1: Connect to database
        await _connectDB();
        
        // Step 2: Initialize schema
        await _initializeSchema();
        
        // Step 3: Run migrations
        await _runMigrations();
        
        systemLog.info('db_setup_migrations_complete');
        
    } catch (err: any) {
        systemLog.error('db_setup_migrations_failed', { error: err.message });
        throw err;
    }
};