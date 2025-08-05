import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import authRoutes from './routes/authRoutes';
import deviceRoutes from './routes/deviceRoutes';
import { initializeDatabase } from './db';
import { env } from './env/env';
import { getCurrentISTString } from './utils/timezone';

const app = express();

// Middleware
app.use(cors({
  origin: env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true, // Allow cookies to be sent
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  exposedHeaders: ['Set-Cookie']
}));
app.use(cookieParser());
app.use(express.json({ limit: '10mb' })); // Increase limit for agent data
app.use(express.urlencoded({ extended: true }));

// Initialize database (connection + schema + migrations)
initializeDatabase().catch(err => {
  console.error('Failed to initialize database:', err);
  process.exit(1);
});

// Health check endpoint
app.get('/', (req, res) => {
  res.json({ 
    message: 'MDM Backend API is running 🚀',
    version: '1.0.0',
    endpoints: {
      auth: '/api/auth',
      devices: '/api/devices',
      agent: '/api/devices/agent/report'
    }
  });
});

app.get('/health', (req, res) => {
  res.status(200).json({ 
    message: 'Server is healthy 🚀',
    timestamp: getCurrentISTString()
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/devices', deviceRoutes);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ message: 'Endpoint not found' });
});

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err);
  res.status(500).json({ 
    message: 'Internal server error',
    error: env.NODE_ENV === 'development' ? err.message : err.message
  });
});

const PORT = env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🚀 MDM Backend Server running on port ${PORT}`);
  console.log(`Agent endpoint: http://localhost:${PORT}/api/devices/agent/report`);
  console.log(`Admin dashboard API: http://localhost:${PORT}/api/devices`);
  console.log(`Auth endpoint: http://localhost:${PORT}/api/auth`);
});

