#!/usr/bin/env ts-node

// Migration script - run separately from server startup
import 'dotenv/config';
import { initializeDatabaseWithMigrations, disconnectDB } from '../db';

async function runMigrations() {
    try {
        console.log("🔧 Running database migrations...");
        
        await initializeDatabaseWithMigrations();
        
        console.log("🎯 Migration script completed successfully!");
        process.exit(0);
        
    } catch (error: any) {
        console.error("❌ Migration failed:", error.message);
        process.exit(1);
    } finally {
        await disconnectDB();
    }
}

// Run migrations
runMigrations();