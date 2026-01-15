import express from 'express';
import { auth } from '../middleware/authMiddleware';
import {
  receiveAgentData,
  getDevices,
  getDevicesTable,
  getDeviceById,
  getDeviceDataHistory,
  getDashboardStats,
  getDeviceData,
  removeDeviceById,
  requestIntervalChange,
  getIntervalRequestHistory,
  confirmIntervalUpdate,
  deleteIntervalRequest
} from '../controllers/deviceController';

const router: express.Router = express.Router();

// Public route for agent data submission (no auth required)
router.post('/agent/report', receiveAgentData); // Receive agent data from agent
// Public route for agent interval confirmation (no auth required)
router.post('/agent/interval-confirm', confirmIntervalUpdate); // Confirm interval update from agent

// Protected admin routes for device management
router.get('/dashboard/stats', auth, getDashboardStats); // Get dashboard stats
// New enriched endpoint for devices table
router.get('/table', auth, getDevicesTable);  // Get devices table

router.get('/', auth, getDevices); // Get devices
router.get('/:id', auth, getDeviceById); // Get device by id
router.delete('/:id', auth, removeDeviceById); // Remove device by id
router.get('/:id/data/:type', auth, getDeviceData); // Get device data by type
router.get('/:id/data/:type/history', auth, getDeviceDataHistory); // Get device data history by type

// Interval request routes
router.put('/:id/interval-request', auth, requestIntervalChange); // Request interval change
router.get('/:id/interval-request/history', auth, getIntervalRequestHistory); // Get interval request history
router.delete('/interval-request/:requestId', auth, deleteIntervalRequest); // Delete interval request

export default router;

