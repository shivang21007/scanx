import 'dotenv/config';

export const env = {
    LOG_LEVEL: process.env.LOG_LEVEL,
    PORT: process.env.PORT,
    MONGO_URI: process.env.MONGO_URI,
    MYSQL_HOST: process.env.MYSQL_HOST,
    MYSQL_PORT: process.env.MYSQL_PORT,
    MYSQL_USER: process.env.MYSQL_USER,
    MYSQL_PASSWORD: process.env.MYSQL_PASSWORD,
    MYSQL_DATABASE: process.env.MYSQL_DATABASE,
    JWT_SECRET: process.env.JWT_SECRET,
    NODE_ENV: process.env.NODE_ENV,
    FRONTEND_URL: process.env.FRONTEND_URL,
    FRONTEND_URL_CORS_ALLOWED: process.env.FRONTEND_URL_CORS_ALLOWED,
    GOOGLE_SERVICE_ACCOUNT_KEY_FILE: process.env.GOOGLE_SERVICE_ACCOUNT_KEY_FILE,
    GOOGLE_WORKSPACE_ADMIN_EMAIL: process.env.GOOGLE_WORKSPACE_ADMIN_EMAIL,
    GOOGLE_WORKSPACE_CUSTOMER: process.env.GOOGLE_WORKSPACE_CUSTOMER,
    // Enable register endpoint: 'true' or '1' to enable, anything else (including undefined) to disable
    ENABLE_REGISTER_ENDPOINT: (() => {
      const value = process.env.ENABLE_REGISTER_ENDPOINT;
      return value === 'true' || value === '1';
    })(),
    SMTP_HOST: process.env.SMTP_HOST ,
    SMTP_PORT: process.env.SMTP_PORT,
    SMTP_FROM: process.env.SMTP_FROM,
    SMTP_SECURE: process.env.SMTP_SECURE,
    REDIS_HOST: process.env.REDIS_HOST,
    REDIS_PORT: process.env.REDIS_PORT,
    REDIS_PASSWORD: process.env.REDIS_PASSWORD,
}