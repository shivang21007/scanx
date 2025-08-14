#!/usr/bin/env ts-node

// Database reset script - drops entire database and recreates it
import 'dotenv/config';
import mysql from 'mysql2/promise';
import { env } from '../env/env';
import { initializeDatabaseWithMigrations } from '../db';

async function resetDatabase() {
    let connection: mysql.Connection | null = null;
    
    try {
        console.log("⚠️  RESETTING DATABASE - This will delete ALL data!");
        console.log("🔌 Connecting to MySQL server...");
        
        // Connect to MySQL server without specifying database
        connection = await mysql.createConnection({
            host: env.MYSQL_HOST || 'localhost',
            port: parseInt(env.MYSQL_PORT || '3306'),
            user: env.MYSQL_USER ,
            password: env.MYSQL_PASSWORD
            // No database specified - we'll recreate it
        });
        
        console.log("✅ Connected to MySQL server");
        
        // Drop the entire database
        const dbName = env.MYSQL_DATABASE || 'scanx';
        console.log(`🗑️  Dropping database: ${dbName}`);
        await connection.execute(`DROP DATABASE IF EXISTS ${dbName}`);
        
        // Recreate the database
        console.log(`🔧 Creating database: ${dbName}`);
        await connection.execute(`CREATE DATABASE ${dbName}`);
        
        // Close the server connection
        await connection.end();
        connection = null;
        
        console.log("🚀 Database recreated successfully!");
        console.log("🔧 Running full initialization with migrations...");
        
        // Now run the full initialization with the new database
        await initializeDatabaseWithMigrations();
        
        console.log("🎯 Database reset completed successfully!");
        process.exit(0);
        
    } catch (error: any) {
        console.error("❌ Database reset failed:", error.message);
        process.exit(1);
    } finally {
        if (connection) {
            await connection.end();
        }
    }
}

// Reset database
resetDatabase();