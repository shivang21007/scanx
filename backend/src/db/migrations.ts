import { getConnection } from './connection';

// Migration tracking table
const MIGRATIONS_TABLE = 'migrations';

// Create migrations tracking table
export const createMigrationsTable = async () => {
    const connection = await getConnection();
    
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
    const connection = await getConnection();
    
    const [rows] = await connection.execute(
        `SELECT COUNT(*) as count FROM ${MIGRATIONS_TABLE} WHERE migration_name = ?`,
        [migrationName]
    );
    
    return (rows as any)[0].count > 0;
};

// Mark migration as executed
export const markMigrationExecuted = async (migrationName: string) => {
    const connection = await getConnection();
    
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
    
    const connection = await getConnection();
    
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

// Migration: Add devices JSON field to users table
export const migration_003_add_devices_field = async () => {
    const migrationName = '003_add_devices_field';
    
    if (await isMigrationExecuted(migrationName)) {
        console.log(`⏭️  Migration '${migrationName}' already executed`);
        return;
    }
    
    console.log(`🔧 Executing migration: ${migrationName}`);
    
    const connection = await getConnection();
    
    try {
        // Check if column already exists
        const [columns] = await connection.execute(
            `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
             WHERE TABLE_SCHEMA = DATABASE() 
             AND TABLE_NAME = 'users' 
             AND COLUMN_NAME = 'device_id'`
        );
        
        if ((columns as any[]).length === 0) {
            // Add devices JSON column
            await connection.execute(`
                ALTER TABLE users 
                ADD COLUMN device_id JSON DEFAULT NULL 
                AFTER account_type
            `);
            
            console.log('✅ Added devices JSON field to users table');
        } else {
            console.log('ℹ️  Devices column already exists');
        }
        
    } catch (err: any) {
        console.error(`❌ Error adding devices field: ${err.message}`);
        throw err;
    }
    
    await markMigrationExecuted(migrationName);
};

// Migration: Rename agent_version to scanx_version and add osqueryi_version
export const migration_004_split_agent_versions = async () => {
    const migrationName = '004_split_agent_versions';
    
    if (await isMigrationExecuted(migrationName)) {
        console.log(`⏭️  Migration '${migrationName}' already executed`);
        return;
    }
    
    console.log(`🔧 Executing migration: ${migrationName}`);
    
    const connection = await getConnection();
    
    try {
        // Check if agent_version column exists
        const [agentVersionCheck] = await connection.execute(
            `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
             WHERE TABLE_SCHEMA = DATABASE() 
             AND TABLE_NAME = 'devices' 
             AND COLUMN_NAME = 'agent_version'`
        );
        
        // Check if scanx_version column already exists
        const [scanxVersionCheck] = await connection.execute(
            `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
             WHERE TABLE_SCHEMA = DATABASE() 
             AND TABLE_NAME = 'devices' 
             AND COLUMN_NAME = 'scanx_version'`
        );
        
        if ((agentVersionCheck as any[]).length > 0 && (scanxVersionCheck as any[]).length === 0) {
            // Rename agent_version to scanx_version (preserves data)
            await connection.execute(`
                ALTER TABLE devices 
                CHANGE COLUMN agent_version scanx_version VARCHAR(50)
            `);
            
            console.log('✅ Renamed agent_version to scanx_version (data preserved)');
        } else if ((scanxVersionCheck as any[]).length > 0) {
            console.log('ℹ️  scanx_version column already exists');
        } else {
            console.log('ℹ️  agent_version column does not exist, nothing to rename');
        }
        
        // Check if osqueryi_version column exists
        const [osqueryiVersionCheck] = await connection.execute(
            `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
             WHERE TABLE_SCHEMA = DATABASE() 
             AND TABLE_NAME = 'devices' 
             AND COLUMN_NAME = 'osqueryi_version'`
        );
        
        if ((osqueryiVersionCheck as any[]).length === 0) {
            // Add osqueryi_version column after scanx_version
            await connection.execute(`
                ALTER TABLE devices 
                ADD COLUMN osqueryi_version VARCHAR(50) 
                AFTER scanx_version
            `);
            
            console.log('✅ Added osqueryi_version column');
        } else {
            console.log('ℹ️  osqueryi_version column already exists');
        }
        
    } catch (err: any) {
        console.error(`❌ Error splitting agent versions: ${err.message}`);
        throw err;
    }
    
    await markMigrationExecuted(migrationName);
};

// Migration: Add password_manager_names to password_manager_info table
export const migration_005_add_password_manager_names = async () => {
    const migrationName = '005_add_password_manager_names';
    
    if (await isMigrationExecuted(migrationName)) {
        console.log(`⏭️  Migration '${migrationName}' already executed`);
        return;
    }
    
    console.log(`🔧 Executing migration: ${migrationName}`);
    
    const connection = await getConnection();
    
    try {
        // The password_manager_info table stores data in a JSON column
        // We need to check if the JSON structure needs updating
        // Since data is stored as JSON, we just need to ensure the column exists
        // The JSON data structure will be handled by the application code
        
        console.log('✅ Password manager names will be stored in the JSON data column');
        console.log('ℹ️  No schema changes needed - data structure handled by application');
        
    } catch (err: any) {
        console.error(`❌ Error in password_manager_names migration: ${err.message}`);
        throw err;
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
        await migration_003_add_devices_field();
        await migration_004_split_agent_versions();
        await migration_005_add_password_manager_names();
        
        console.log("🎯 All migrations completed successfully!");
        
    } catch (err: any) {
        console.error("❌ Migration error:", err.message);
        throw new Error(`Migration failed: ${err.message}`);
    }
};

// Get list of executed migrations
export const getExecutedMigrations = async (): Promise<string[]> => {
    const connection = await getConnection();
    
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