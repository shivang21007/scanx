import mysql from 'mysql2/promise';
import { env } from '../env/env';

// Create a connection pool
const mysqlPool = mysql.createPool({
    host: env.MYSQL_HOST,
    port: parseInt(env.MYSQL_PORT || '3306'),
    user: env.MYSQL_USER,
    password: env.MYSQL_PASSWORD,
    database: env.MYSQL_DATABASE,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// Test the connection
const testConnection = async () => {
    try {
        const connection = await mysqlPool.getConnection();
        console.log("MySQL connected successfully at port", env.MYSQL_PORT,"🚀");
        connection.release();
    } catch (error) {
        console.log("MySQL Error:", error);
    }
}

export { mysqlPool, testConnection };