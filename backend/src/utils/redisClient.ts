import { createClient } from 'redis';
import { env } from '../env/env';

// Create Redis client
const redisClient = createClient({
    socket: {
        host: env.REDIS_HOST || 'localhost',
        port: parseInt(env.REDIS_PORT || '6379'),
    },
    password: env.REDIS_PASSWORD || undefined,
});

// Error handling
redisClient.on('error', (err) => {
    console.error('❌ Redis Client Error:', err);
});

// Connect to Redis
redisClient.on('connect', () => {
    console.log('✅ Redis connected successfully');
});

// Initialize connection
export const connectRedis = async () => {
    try {
        if (!redisClient.isOpen) {
            await redisClient.connect();
        }
    } catch (err: any) {
        console.error('❌ Failed to connect to Redis:', err.message);
        throw err;
    }
};

// Disconnect from Redis
export const disconnectRedis = async () => {
    try {
        if (redisClient.isOpen) {
            await redisClient.quit();
            console.log('🔌 Redis disconnected');
        }
    } catch (err: any) {
        console.error('❌ Redis Disconnect Error:', err.message);
    }
};

export default redisClient;

