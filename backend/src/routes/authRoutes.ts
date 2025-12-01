import express from 'express';
import { register, login, logout, deleteAdmin, getAdmin, getAllAdmins } from '../controllers/authController';
import { auth, checkRegisterEnabled } from '../middleware/authMiddleware';

const router: express.Router = express.Router();

// Admin authentication routes
// Register route is protected by ENABLE_REGISTER_ENDPOINT env variable
router.post('/register', checkRegisterEnabled, register);
router.post('/login', login);
router.get('/me', auth, getAdmin);
router.get('/logout', auth, logout);
router.delete('/delete', auth, deleteAdmin);
router.get('/admins', auth, getAllAdmins);

export default router;

