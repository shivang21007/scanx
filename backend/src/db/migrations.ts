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

// Migration: Add indexes for performance
export const migration_002_add_performance_indexes = async () => {
    const migrationName = '002_add_performance_indexes';
    
    if (await isMigrationExecuted(migrationName)) {
        console.log(`⏭️  Migration '${migrationName}' already executed`);
        return;
    }
    
    console.log(`🔧 Executing migration: ${migrationName}`);
    
    const connection = getConnection();
    
    try {
        // Add compound indexes for better query performance
        await connection.execute(`
            ALTER TABLE device_data 
            ADD INDEX IF NOT EXISTS idx_device_type_timestamp (device_id, data_type, timestamp)
        `);
        
        await connection.execute(`
            ALTER TABLE devices 
            ADD INDEX IF NOT EXISTS idx_user_status (user_email, status)
        `);
        
        console.log("✅ Performance indexes added");
        
    } catch (err: any) {
        // Ignore errors for indexes that might already exist
        console.log("ℹ️  Some indexes might already exist, continuing...");
    }
    
    await markMigrationExecuted(migrationName);
};

// Migration: Add device categories
export const migration_003_add_device_categories = async () => {
    const migrationName = '003_add_device_categories';
    
    if (await isMigrationExecuted(migrationName)) {
        console.log(`⏭️  Migration '${migrationName}' already executed`);
        return;
    }
    
    console.log(`🔧 Executing migration: ${migrationName}`);
    
    const connection = getConnection();
    
    try {
        // Add category column to devices table
        await connection.execute(`
            ALTER TABLE devices 
            ADD COLUMN IF NOT EXISTS category ENUM('laptop', 'desktop', 'mobile', 'tablet', 'server') DEFAULT 'laptop'
        `);
        
        await connection.execute(`
            ALTER TABLE devices 
            ADD INDEX IF NOT EXISTS idx_category (category)
        `);
        
        console.log("✅ Device categories added");
        
    } catch (err: any) {
        console.log("ℹ️  Device category column might already exist, continuing...");
    }
    
    await markMigrationExecuted(migrationName);
};

// // Migration: Add computer_name column to devices table
// export const migration_004_add_computer_name = async () => {
//     const migrationName = '004_add_computer_name';
    
//     if (await isMigrationExecuted(migrationName)) {
//         console.log(`⏭️  Migration '${migrationName}' already executed`);
//         return;
//     }
    
//     console.log(`🔧 Executing migration: ${migrationName}`);
    
//     const connection = getConnection();
    
//     try {
//         // Check if column already exists
//         const [columns] = await connection.execute(
//             `SHOW COLUMNS FROM devices LIKE 'computer_name'`
//         );
        
//         if ((columns as any[]).length === 0) {
//             await connection.execute(`
//                 ALTER TABLE devices 
//                 ADD COLUMN computer_name VARCHAR(255) AFTER serial_no,
//                 ADD INDEX idx_computer_name (computer_name)
//             `);
//             console.log('✅ Added computer_name column to devices table');
//         } else {
//             console.log('ℹ️  computer_name column already exists in devices table');
//         }
        
//     } catch (err: any) {
//         console.log("ℹ️  Computer name column might already exist, continuing...");
//     }
    
//     await markMigrationExecuted(migrationName);
// };

// Run all migrations
export const runMigrations = async () => {
    try {
        console.log("🚀 Running database migrations...");
        
        await createMigrationsTable();
        
        // Execute migrations in order
        await migration_001_add_backend_config();
        await migration_002_add_performance_indexes();
        await migration_003_add_device_categories();
        
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