import { createClient } from 'redis';
import { env } from '../env/env';
import { systemLog } from '../logger/logger';

// Create Redis client
const redisClient = createClient({
    socket: {
        host: env.REDIS_HOST || 'localhost',
        port: parseInt(env.REDIS_PORT || '6379'),
    },
    password: env.REDIS_PASSWORD && env.REDIS_PASSWORD.trim() !== '' ? env.REDIS_PASSWORD : undefined,
});

// Error handling
redisClient.on('error', (err: Error) => {
    systemLog.error('redis_client_error', { error: err.message, stack: err.stack });
});

// Connect to Redis
redisClient.on('connect', () => {
    systemLog.info('redis_connected');
});

// Initialize connection
export const connectRedis = async () => {
    try {
        if (!redisClient.isOpen) {
            await redisClient.connect();
        }
    } catch (err: any) {
        systemLog.error('redis_connect_failed', { error: err.message });
        throw err;
    }
};

// Disconnect from Redis
export const disconnectRedis = async () => {
    try {
        if (redisClient.isOpen) {
            await redisClient.quit();
            systemLog.info('redis_disconnected');
        }
    } catch (err: any) {
        systemLog.error('redis_disconnect_error', { error: err.message });
    }
};

export default redisClient;

