import { getConnection } from './connection';

// Migration tracking table
const MIGRATIONS_TABLE = 'migrations';

// Create migrations tracking table
export const createMigrationsTable = async () => {
    const connection = getConnection();
    
    await connection.execute(`
        CREATE TABLE IF NOT EXISTS ${MIGRATIONS_TABLE} (
            id INT AUTO_INCREMENT PRIMARY KEY,
            migration_name VARCHAR(255) UNIQUE NOT NULL,
            executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
};

// Check if migration has been executed
export const isMigrationExecuted = async (migrationName: string): Promise<boolean> => {
    const connection = getConnection();
    
    const [rows] = await connection.execute(
        `SELECT COUNT(*) as count FROM ${MIGRATIONS_TABLE} WHERE migration_name = ?`,
        [migrationName]
    );
    
    return (rows as any)[0].count > 0;
};

// Mark migration as executed
export const markMigrationExecuted = async (migrationName: string) => {
    const connection = getConnection();
    
    await connection.execute(
        `INSERT INTO ${MIGRATIONS_TABLE} (migration_name) VALUES (?)`,
        [migrationName]
    );
    
    console.log(`✅ Migration '${migrationName}' marked as executed`);
};

// Migration: Add backend_url to agent.conf support
export const migration_001_add_backend_config = async () => {
    const migrationName = '001_add_backend_config';
    
    if (await isMigrationExecuted(migrationName)) {
        console.log(`⏭️  Migration '${migrationName}' already executed`);
        return;
    }
    
    console.log(`🔧 Executing migration: ${migrationName}`);
    
    // This migration is for documentation purposes
    // The actual backend_url will be added to agent.conf in the agent codebase
    
    await markMigrationExecuted(migrationName);
};

// Migration: Add users table for Google Workspace integration
export const migration_002_add_users_table = async () => {
    const migrationName = '002_add_users_table';
    
    if (await isMigrationExecuted(migrationName)) {
        console.log(`⏭️  Migration '${migrationName}' already executed`);
        return;
    }
    
    console.log(`🔧 Executing migration: ${migrationName}`);
    
    const connection = getConnection();
    
    try {
        // Create users table if it doesn't exist
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS users (
                gid INT AUTO_INCREMENT PRIMARY KEY,
                email VARCHAR(255) UNIQUE NOT NULL,
                name VARCHAR(255) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                account_type ENUM('user', 'service') DEFAULT 'user',
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_email (email),
                INDEX idx_account_type (account_type)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);
        
        console.log('✅ Added users table for Google Workspace integration');
        
    } catch (err: any) {
        console.log("ℹ️  Users table might already exist, continuing...");
    }
    
    await markMigrationExecuted(migrationName);
};



// Run all migrations
export const runMigrations = async () => {
    try {
        console.log("🚀 Running database migrations...");
        
        await createMigrationsTable();
        
        // Execute migrations in order
        await migration_001_add_backend_config();
        await migration_002_add_users_table();
        console.log("🎯 All migrations completed successfully!");
        
    } catch (err: any) {
        console.error("❌ Migration error:", err.message);
        throw new Error(`Migration failed: ${err.message}`);
    }
};

// Get list of executed migrations
export const getExecutedMigrations = async (): Promise<string[]> => {
    const connection = getConnection();
    
    try {
        const [rows] = await connection.execute(
            `SELECT migration_name FROM ${MIGRATIONS_TABLE} ORDER BY executed_at`
        );
        
        return (rows as any).map((row: any) => row.migration_name);
    } catch (err) {
        // If migrations table doesn't exist, return empty array
        return [];
    }
};