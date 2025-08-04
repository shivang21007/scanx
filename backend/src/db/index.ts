// Database module exports
export { connectDB, disconnectDB, getConnection, testConnection } from './connection';
export { initializeSchema, dropAllTables, TABLES } from './schema';
export { runMigrations, getExecutedMigrations } from './migrations';

// Import functions for internal use
import { connectDB as _connectDB } from './connection';
import { initializeSchema as _initializeSchema } from './schema';
import { runMigrations as _runMigrations } from './migrations';

// Simple database connection for server startup (assume schema exists)
export const initializeDatabase = async () => {
    try {
        console.log("🔌 Connecting to database...");
        
        // Just connect to database - schema should already exist from migrations
        await _connectDB();
        
        console.log("Database connected successfully!");
        
    } catch (err: any) {
        console.error("❌ Database connection failed:", err.message);
        throw err;
    }
};

// Complete database setup with migrations (for migration script)
export const initializeDatabaseWithMigrations = async () => {
    try {
        console.log("🚀 Starting complete database setup...");
        
        // Step 1: Connect to database
        await _connectDB();
        
        // Step 2: Initialize schema
        await _initializeSchema();
        
        // Step 3: Run migrations
        await _runMigrations();
        
        console.log("✅ Database setup with migrations completed successfully!");
        
    } catch (err: any) {
        console.error("❌ Database setup failed:", err.message);
        throw err;
    }
};