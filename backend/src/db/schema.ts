import { getConnection } from './connection';
import { systemLog } from '../logger/logger';

// Database schema definitions
export const TABLES = {
    ADMINS: 'admins',
    USERS: 'users',
    DEVICES: 'devices',
    SYSTEM_INFO: 'system_info',
    DISK_ENCRYPTION_INFO: 'disk_encryption_info',
    PASSWORD_MANAGER_INFO: 'password_manager_info',
    ANTIVIRUS_INFO: 'antivirus_info',
    SCREEN_LOCK_INFO: 'screen_lock_info',
    APPS_INFO: 'apps_info',
    DEVICE_SUMMARY: 'device_summary',
    DEVICE_INTERVAL_REQUESTS: 'device_interval_requests'
} as const;

// Create admins table
export const createAdminsTable = async () => {
    const connection = await getConnection();
    // set time zone to IST in database
    await connection.execute(`SET time_zone = '+05:30';`);
    systemLog.info("✅ Time zone set to IST");

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
    
    systemLog.info(`✅ Table ${TABLES.ADMINS} created/verified`);
};

// Create users table for Google Workspace employees
export const createUsersTable = async () => {
    const connection = await getConnection();
    
    await connection.execute(`
        CREATE TABLE IF NOT EXISTS ${TABLES.USERS} (
            gid INT AUTO_INCREMENT PRIMARY KEY,
            email VARCHAR(255) UNIQUE NOT NULL,
            name VARCHAR(255) NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            account_type ENUM('user', 'service') DEFAULT 'user',
            status ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
            device_id JSON DEFAULT NULL,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_email (email),
            INDEX idx_account_type (account_type),
            INDEX idx_status (status)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    
    systemLog.info(`✅ Table ${TABLES.USERS} created/verified`);
};

// Create devices table (starting ID from 101)
// Note: serial_no is NOT unique alone - composite unique (serial_no, computer_name) is used
// This is because Windows desktops often have generic serial numbers like "Default string"
export const createDevicesTable = async () => {
    const connection = await getConnection();
    
    await connection.execute(`
        CREATE TABLE IF NOT EXISTS ${TABLES.DEVICES} (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_email VARCHAR(255) NOT NULL,
            serial_no VARCHAR(255) NOT NULL,
            computer_name VARCHAR(255),
            os_type VARCHAR(50) NOT NULL,
            os_version VARCHAR(100),
            last_seen TIMESTAMP NULL,
            status ENUM('online', 'offline', 'unknown') DEFAULT 'unknown',
            scanx_version VARCHAR(50),
            osqueryi_version VARCHAR(50),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_user_email (user_email),
            INDEX idx_serial_no (serial_no),
            INDEX idx_computer_name (computer_name),
            INDEX idx_last_seen (last_seen),
            INDEX idx_status (status),
            INDEX idx_os_type (os_type),
            UNIQUE KEY idx_serial_computer_unique (serial_no, computer_name)
        ) ENGINE=InnoDB AUTO_INCREMENT=101 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    
    systemLog.info(`✅ Table ${TABLES.DEVICES} created/verified`);
};

// Create individual data tables for each query type
export const createSystemInfoTable = async () => {
    const connection = await getConnection();
    
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
    
    systemLog.info(`✅ Table ${TABLES.SYSTEM_INFO} created/verified`);
};

export const createDiskEncryptionInfoTable = async () => {
    const connection = await getConnection();
    
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
    
    systemLog.info(`✅ Table ${TABLES.DISK_ENCRYPTION_INFO} created/verified`);
};

export const createPasswordManagerInfoTable = async () => {
    const connection = await getConnection();
    
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
    
    systemLog.info(`✅ Table ${TABLES.PASSWORD_MANAGER_INFO} created/verified`);
};

export const createAntivirusInfoTable = async () => {
    const connection = await getConnection();
    
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
    
    systemLog.info(`✅ Table ${TABLES.ANTIVIRUS_INFO} created/verified`);
};

export const createScreenLockInfoTable = async () => {
    const connection = await getConnection();
    
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
    
    systemLog.info(`✅ Table ${TABLES.SCREEN_LOCK_INFO} created/verified`);
};

export const createAppsInfoTable = async () => {
    const connection = await getConnection();
    
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
    
    systemLog.info(`✅ Table ${TABLES.APPS_INFO} created/verified (this table may become heavy)`);
};

// Create device_summary table for overview (which data types received)
export const createDeviceSummaryTable = async () => {
    const connection = await getConnection();
    
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
            interval_info INT DEFAULT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            FOREIGN KEY (device_id) REFERENCES ${TABLES.DEVICES}(id) ON DELETE CASCADE,
            INDEX idx_last_report (last_report)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    
    systemLog.info(`✅ Table ${TABLES.DEVICE_SUMMARY} created/verified`);
};

// Create device_interval_requests table for interval push updates
export const createDeviceIntervalRequestsTable = async () => {
    const connection = await getConnection();
    
    await connection.execute(`
        CREATE TABLE IF NOT EXISTS ${TABLES.DEVICE_INTERVAL_REQUESTS} (
            id INT AUTO_INCREMENT PRIMARY KEY,
            device_id INT NOT NULL,
            requested_interval VARCHAR(50) NOT NULL,
            requested_interval_seconds INT NOT NULL,
            status ENUM('pending', 'applied', 'failed', 'cancelled') DEFAULT 'pending',
            requested_by VARCHAR(255),
            requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            applied_at TIMESTAMP NULL,
            agent_confirmation JSON NULL,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            FOREIGN KEY (device_id) REFERENCES ${TABLES.DEVICES}(id) ON DELETE CASCADE,
            INDEX idx_device_status (device_id, status),
            INDEX idx_status (status),
            INDEX idx_requested_at (requested_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    
    systemLog.info(`✅ Table ${TABLES.DEVICE_INTERVAL_REQUESTS} created/verified`);
};

// Initialize all tables
export const initializeSchema = async () => {
    try {
        systemLog.info("🔧 Initializing database schema...");
        await createAdminsTable();
        await createUsersTable();
        await createDevicesTable();
        await createSystemInfoTable();
        await createDiskEncryptionInfoTable();
        await createPasswordManagerInfoTable();
        await createAntivirusInfoTable();
        await createScreenLockInfoTable();
        await createAppsInfoTable();
        await createDeviceSummaryTable();
        await createDeviceIntervalRequestsTable();
        
        systemLog.info("🎯 Database schema initialized successfully!");
        
    } catch (err: any) {
        systemLog.error('schema_init_failed', { error: err.message });
        throw new Error(`Failed to initialize database schema: ${err.message}`);
    }
};

// Drop all tables (for development/testing)
export const dropAllTables = async () => {
    const connection = await getConnection();
    
    try {
        systemLog.info("⚠️  Dropping all tables...");
        
        // Drop in reverse order due to foreign key constraints
        await connection.execute(`DROP TABLE IF EXISTS ${TABLES.DEVICE_INTERVAL_REQUESTS}`);
        await connection.execute(`DROP TABLE IF EXISTS ${TABLES.DEVICE_SUMMARY}`);
        await connection.execute(`DROP TABLE IF EXISTS ${TABLES.APPS_INFO}`);
        await connection.execute(`DROP TABLE IF EXISTS ${TABLES.SCREEN_LOCK_INFO}`);
        await connection.execute(`DROP TABLE IF EXISTS ${TABLES.ANTIVIRUS_INFO}`);
        await connection.execute(`DROP TABLE IF EXISTS ${TABLES.PASSWORD_MANAGER_INFO}`);
        await connection.execute(`DROP TABLE IF EXISTS ${TABLES.DISK_ENCRYPTION_INFO}`);
        await connection.execute(`DROP TABLE IF EXISTS ${TABLES.SYSTEM_INFO}`);
        await connection.execute(`DROP TABLE IF EXISTS ${TABLES.DEVICES}`);
        await connection.execute(`DROP TABLE IF EXISTS ${TABLES.USERS}`);
        await connection.execute(`DROP TABLE IF EXISTS ${TABLES.ADMINS}`);
        
        systemLog.info("🗑️  All tables dropped successfully");
        
    } catch (err: any) {
        systemLog.error('drop_tables_failed', { error: err.message });
        throw err;
    }
};