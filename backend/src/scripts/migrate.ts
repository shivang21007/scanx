#!/usr/bin/env ts-node

// Migration script - run separately from server startup
import 'dotenv/config';
import { initializeDatabaseWithMigrations, disconnectDB } from '../db';
import { systemLog } from '../logger/logger';

async function runMigrations() {
    try {
        systemLog.info('migration_script_start');
        
        await initializeDatabaseWithMigrations();
        
        systemLog.info('migration_script_complete');
        process.exit(0);
        
    } catch (error: any) {
        systemLog.error('migration_script_failed', { error: error.message });
        process.exit(1);
    } finally {
        await disconnectDB();
    }
}

// Run migrations
runMigrations();