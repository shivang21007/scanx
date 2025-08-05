import { getConnection } from './connection';

// Database schema definitions
export const TABLES = {
    ADMINS: 'admins',
    DEVICES: 'devices',
    SYSTEM_INFO: 'system_info',
    DISK_ENCRYPTION_INFO: 'disk_encryption_info',
    PASSWORD_MANAGER_INFO: 'password_manager_info',
    ANTIVIRUS_INFO: 'antivirus_info',
    SCREEN_LOCK_INFO: 'screen_lock_info',
    APPS_INFO: 'apps_info',
    DEVICE_SUMMARY: 'device_summary'
} as const;

// Create admins table
export const createAdminsTable = async () => {
    const connection = getConnection();
    // set time zone to IST in database
    await connection.execute(`SET time_zone = '+05:30';`);
    console.log("✅ Time zone set to IST");

    await connection.execute(`
        CREATE TABLE IF NOT EXISTS ${TABLES.ADMINS} (
            id INT AUTO_INCREMENT PRIMARY KEY,
            email VARCHAR(255) UNIQUE NOT NULL,
            password VARCHAR(255) NOT NULL,
            name VARCHAR(255),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_email (email)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    
    console.log(`✅ Table ${TABLES.ADMINS} created/verified`);
};

// Create devices table (starting ID from 101)
export const createDevicesTable = async () => {
    const connection = getConnection();
    
    await connection.execute(`
        CREATE TABLE IF NOT EXISTS ${TABLES.DEVICES} (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_email VARCHAR(255) NOT NULL,
            serial_no VARCHAR(255) UNIQUE NOT NULL,
            os_type VARCHAR(50) NOT NULL,
            os_version VARCHAR(100),
            last_seen TIMESTAMP NULL,
            status ENUM('online', 'offline', 'unknown') DEFAULT 'unknown',
            agent_version VARCHAR(50),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_user_email (user_email),
            INDEX idx_serial_no (serial_no),
            INDEX idx_last_seen (last_seen),
            INDEX idx_status (status),
            INDEX idx_os_type (os_type)
        ) ENGINE=InnoDB AUTO_INCREMENT=101 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    
    console.log(`✅ Table ${TABLES.DEVICES} created/verified`);
};

// Create individual data tables for each query type
export const createSystemInfoTable = async () => {
    const connection = getConnection();
    
    await connection.execute(`
        CREATE TABLE IF NOT EXISTS ${TABLES.SYSTEM_INFO} (
            id INT AUTO_INCREMENT PRIMARY KEY,
            device_id INT NOT NULL,
            timestamp TIMESTAMP NOT NULL,
            data JSON,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            FOREIGN KEY (device_id) REFERENCES ${TABLES.DEVICES}(id) ON DELETE CASCADE,
            UNIQUE KEY idx_device_timestamp (device_id, timestamp),
            INDEX idx_timestamp (timestamp)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    
    console.log(`✅ Table ${TABLES.SYSTEM_INFO} created/verified`);
};

export const createDiskEncryptionInfoTable = async () => {
    const connection = getConnection();
    
    await connection.execute(`
        CREATE TABLE IF NOT EXISTS ${TABLES.DISK_ENCRYPTION_INFO} (
            id INT AUTO_INCREMENT PRIMARY KEY,
            device_id INT NOT NULL,
            timestamp TIMESTAMP NOT NULL,
            data JSON,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            FOREIGN KEY (device_id) REFERENCES ${TABLES.DEVICES}(id) ON DELETE CASCADE,
            UNIQUE KEY idx_device_timestamp (device_id, timestamp),
            INDEX idx_timestamp (timestamp)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    
    console.log(`✅ Table ${TABLES.DISK_ENCRYPTION_INFO} created/verified`);
};

export const createPasswordManagerInfoTable = async () => {
    const connection = getConnection();
    
    await connection.execute(`
        CREATE TABLE IF NOT EXISTS ${TABLES.PASSWORD_MANAGER_INFO} (
            id INT AUTO_INCREMENT PRIMARY KEY,
            device_id INT NOT NULL,
            timestamp TIMESTAMP NOT NULL,
            data JSON,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            FOREIGN KEY (device_id) REFERENCES ${TABLES.DEVICES}(id) ON DELETE CASCADE,
            UNIQUE KEY idx_device_timestamp (device_id, timestamp),
            INDEX idx_timestamp (timestamp)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    
    console.log(`✅ Table ${TABLES.PASSWORD_MANAGER_INFO} created/verified`);
};

export const createAntivirusInfoTable = async () => {
    const connection = getConnection();
    
    await connection.execute(`
        CREATE TABLE IF NOT EXISTS ${TABLES.ANTIVIRUS_INFO} (
            id INT AUTO_INCREMENT PRIMARY KEY,
            device_id INT NOT NULL,
            timestamp TIMESTAMP NOT NULL,
            data JSON,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            FOREIGN KEY (device_id) REFERENCES ${TABLES.DEVICES}(id) ON DELETE CASCADE,
            UNIQUE KEY idx_device_timestamp (device_id, timestamp),
            INDEX idx_timestamp (timestamp)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    
    console.log(`✅ Table ${TABLES.ANTIVIRUS_INFO} created/verified`);
};

export const createScreenLockInfoTable = async () => {
    const connection = getConnection();
    
    await connection.execute(`
        CREATE TABLE IF NOT EXISTS ${TABLES.SCREEN_LOCK_INFO} (
            id INT AUTO_INCREMENT PRIMARY KEY,
            device_id INT NOT NULL,
            timestamp TIMESTAMP NOT NULL,
            data JSON,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            FOREIGN KEY (device_id) REFERENCES ${TABLES.DEVICES}(id) ON DELETE CASCADE,
            UNIQUE KEY idx_device_timestamp (device_id, timestamp),
            INDEX idx_timestamp (timestamp)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    
    console.log(`✅ Table ${TABLES.SCREEN_LOCK_INFO} created/verified`);
};

export const createAppsInfoTable = async () => {
    const connection = getConnection();
    
    await connection.execute(`
        CREATE TABLE IF NOT EXISTS ${TABLES.APPS_INFO} (
            id INT AUTO_INCREMENT PRIMARY KEY,
            device_id INT NOT NULL,
            timestamp TIMESTAMP NOT NULL,
            data JSON,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            FOREIGN KEY (device_id) REFERENCES ${TABLES.DEVICES}(id) ON DELETE CASCADE,
            UNIQUE KEY idx_device_timestamp (device_id, timestamp),
            INDEX idx_timestamp (timestamp)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    
    console.log(`✅ Table ${TABLES.APPS_INFO} created/verified (this table may become heavy)`);
};

// Create device_summary table for overview (which data types received)
export const createDeviceSummaryTable = async () => {
    const connection = getConnection();
    
    await connection.execute(`
        CREATE TABLE IF NOT EXISTS ${TABLES.DEVICE_SUMMARY} (
            device_id INT PRIMARY KEY,
            last_report TIMESTAMP NULL,
            system_info BOOLEAN DEFAULT FALSE,
            password_manager_info BOOLEAN DEFAULT FALSE,
            screen_lock_info BOOLEAN DEFAULT FALSE,
            antivirus_info BOOLEAN DEFAULT FALSE,
            disk_encryption_info BOOLEAN DEFAULT FALSE,
            apps_info BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            FOREIGN KEY (device_id) REFERENCES ${TABLES.DEVICES}(id) ON DELETE CASCADE,
            INDEX idx_last_report (last_report)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    
    console.log(`✅ Table ${TABLES.DEVICE_SUMMARY} created/verified`);
};

// Initialize all tables
export const initializeSchema = async () => {
    try {
        console.log("🔧 Initializing database schema...");
        await createAdminsTable();
        await createDevicesTable();
        await createSystemInfoTable();
        await createDiskEncryptionInfoTable();
        await createPasswordManagerInfoTable();
        await createAntivirusInfoTable();
        await createScreenLockInfoTable();
        await createAppsInfoTable();
        await createDeviceSummaryTable();
        
        console.log("🎯 Database schema initialized successfully!");
        
    } catch (err: any) {
        console.error("❌ Schema initialization error:", err.message);
        throw new Error(`Failed to initialize database schema: ${err.message}`);
    }
};

// Drop all tables (for development/testing)
export const dropAllTables = async () => {
    const connection = getConnection();
    
    try {
        console.log("⚠️  Dropping all tables...");
        
        // Drop in reverse order due to foreign key constraints
        await connection.execute(`DROP TABLE IF EXISTS ${TABLES.DEVICE_SUMMARY}`);
        await connection.execute(`DROP TABLE IF EXISTS ${TABLES.APPS_INFO}`);
        await connection.execute(`DROP TABLE IF EXISTS ${TABLES.SCREEN_LOCK_INFO}`);
        await connection.execute(`DROP TABLE IF EXISTS ${TABLES.ANTIVIRUS_INFO}`);
        await connection.execute(`DROP TABLE IF EXISTS ${TABLES.PASSWORD_MANAGER_INFO}`);
        await connection.execute(`DROP TABLE IF EXISTS ${TABLES.DISK_ENCRYPTION_INFO}`);
        await connection.execute(`DROP TABLE IF EXISTS ${TABLES.SYSTEM_INFO}`);
        await connection.execute(`DROP TABLE IF EXISTS ${TABLES.DEVICES}`);
        await connection.execute(`DROP TABLE IF EXISTS ${TABLES.ADMINS}`);
        
        console.log("🗑️  All tables dropped successfully");
        
    } catch (err: any) {
        console.error("❌ Error dropping tables:", err.message);
        throw err;
    }
};