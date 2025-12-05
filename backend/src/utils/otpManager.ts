import redisClient from './redisClient';

// 10 minutes = 600 seconds
const OTP_TTL = 600;

/**
 * Store OTP in Redis with TTL
 * @param email - User email
 * @param otp - 6-digit OTP
 * @returns Redis key
 */
export async function storeOtp(email: string, otp: string): Promise<string> {
    const key = `auth:forgot:otp:email:${email}`;
    await redisClient.setEx(key, OTP_TTL, otp);
    console.log(`🔐 OTP stored for ${email}, expires in ${OTP_TTL}s`);
    return key;
}

/**
 * Get OTP from Redis
 * @param email - User email
 * @returns OTP or null if not found/expired
 */
export async function getOtp(email: string): Promise<string | null> {
    const key = `auth:forgot:otp:email:${email}`;
    const otp = await redisClient.get(key);
    return otp;
}

/**
 * Delete OTP from Redis
 * @param email - User email
 * @returns Number of keys deleted
 */
export async function deleteOtp(email: string): Promise<number> {
    const key = `auth:forgot:otp:email:${email}`;
    const result = await redisClient.del(key);
    console.log(`🗑️  OTP deleted for ${email}`);
    return result;
}

/**
 * Get remaining TTL for OTP
 * @param email - User email
 * @returns Remaining seconds or -1 if not found
 */
export async function getOtpTTL(email: string): Promise<number> {
    const key = `auth:forgot:otp:email:${email}`;
    return await redisClient.ttl(key);
}

