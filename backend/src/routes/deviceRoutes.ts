import express from 'express';
import { auth } from '../middleware/authMiddleware';
import {
  receiveAgentData,
  getDevices,
  getDeviceById,
  getDeviceData,
  getDashboardStats
} from '../controllers/deviceController';

const router: express.Router = express.Router();

// Public route for agent data submission (no auth required)
router.post('/agent/report', receiveAgentData);

// Protected admin routes for device management
router.get('/dashboard/stats', auth, getDashboardStats);
router.get('/', auth, getDevices);
router.get('/:id', auth, getDeviceById);
router.get('/:id/data/:type', auth, getDeviceData);

export default router;

