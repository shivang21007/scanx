import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import authRoutes from './routes/authRoutes';
import deviceRoutes from './routes/deviceRoutes';
import userRoutes from './routes/usersRoutes';
import updateRoutes from './routes/updatesRoutes';
import { startUsersSyncScheduler, FileDirectoryClient, GoogleApiDirectoryClient } from './services/googleWorkspace';
import { initializeDatabase } from './db';
import { connectRedis } from './utils/redisClient';
import { env } from './env/env';
import { getCurrentISTString } from './utils/timezone';
import { systemLog, getRequestLogger } from './logger/logger';
import { requestContextMiddleware } from './middleware/requestLogging';

const app = express();

app.use(requestContextMiddleware);

// CORS configuration
const cors_allowed_origins = env.FRONTEND_URL_CORS_ALLOWED?.split(',').map((url: string) => url.trim()) || []; 

// Fallback origins for development if no env variable is set
const defaultOrigins = [
  'http://localhost:5173', // Vite dev server
  'http://127.0.0.1:5173',
  'http://172.0.10.183:5173',
  'http://192.168.22.22:5173',
  'http://scanx.com:5173',
  'https://scanx.com'
];

const allowedOrigins = cors_allowed_origins.length > 0 ? cors_allowed_origins : defaultOrigins;
systemLog.info('CORS allowed origins configured', { origins: allowedOrigins });

// Middleware
app.use(cors({
  origin: function (origin: any, callback: any) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      systemLog.warn('CORS blocked origin', { origin });
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true, // Allow cookies to be sent
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: [
    'Content-Type', 
    'Authorization', 
    'X-Requested-With',
    'Accept',
    'Origin'
  ],
  exposedHeaders: ['Set-Cookie'],
  optionsSuccessStatus: 200, // Some legacy browsers (IE11, various SmartTVs) choke on 204
  preflightContinue: false
}));
app.use(cookieParser());
app.use(express.json({ limit: '10mb' })); // Increase limit for agent data
app.use(express.urlencoded({ extended: true }));

// Initialize database (connection + schema + migrations)
initializeDatabase().catch(err => {
  systemLog.error('Failed to initialize database', { error: (err as Error)?.message, stack: (err as Error)?.stack });
  process.exit(1);
});

// Initialize Redis connection
connectRedis().catch(err => {
  systemLog.error('Failed to connect to Redis', { error: (err as Error)?.message, stack: (err as Error)?.stack });
  process.exit(1);
});

// Health check endpoint
app.get(['/', '/api', '/api/health'], (req: express.Request, res: express.Response) => {
  res.status(200).json({ 
    message: 'ScanX Backend API is running 🚀',
    scanxVersion: process.env.SCANX_VERSION || '1.0.0',
    osqueryiVersion: process.env.OSQUERYI_VERSION || '5.19.0',
    endpoints: {
      auth: '/api/auth',
      devices: '/api/devices',
      agent: '/api/devices/agent/report',
      health: '/api/health'
    },
    timestamp: getCurrentISTString(),
    uptime: process.uptime().toFixed(3) + " seconds"
  });
});


// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/devices', deviceRoutes);
app.use('/api/users', userRoutes);
app.use('/api/updates', updateRoutes);

// 404 handler
app.use('*', (req: express.Request, res: express.Response) => {
  res.status(404).json({ message: 'Endpoint not found' });
});

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  getRequestLogger(req).error('express_unhandled_error', {
    error: err?.message,
    stack: err?.stack,
    path: req.originalUrl,
  });
  res.status(500).json({ 
    message: 'Internal server error',
    error: env.NODE_ENV === 'development' ? err.message : err.message
  });
});

const PORT = env.PORT || 5000;

app.listen(PORT, () => {
  systemLog.info('ScanX backend listening', {
    port: PORT,
    agentReport: `http://localhost:${PORT}/api/devices/agent/report`,
    devicesApi: `http://localhost:${PORT}/api/devices`,
    auth: `http://localhost:${PORT}/api/auth`,
    updates: `http://localhost:${PORT}/api/updates/update-check`,
  });

  // Start Google Workspace users sync scheduler (Google API if env set, otherwise file fallback)
  try {
    const keyFile = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_FILE;
    const adminEmail = process.env.GOOGLE_WORKSPACE_ADMIN_EMAIL;
    const customer = process.env.GOOGLE_WORKSPACE_CUSTOMER || 'my_customer';
    if (keyFile && adminEmail) {
      const client = new GoogleApiDirectoryClient({ keyFile, adminEmail, customer });
      startUsersSyncScheduler(client);
      systemLog.info('Users sync scheduler started (Google API)', { schedule: 'daily 12:00 IST' });
    } else {
      const path = require('path');
      const filePath = path.join(process.cwd(), 'test_dir', 'users.json');
      const client = new FileDirectoryClient(filePath);
      startUsersSyncScheduler(client);
      systemLog.info('Users sync scheduler started (file fallback)', { schedule: 'daily 12:00 IST' });
    }
  } catch (e) {
    systemLog.error('Failed to start users sync scheduler', { error: (e as any)?.message || String(e) });
  }
});

