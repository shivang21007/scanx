import express from 'express';
import { register, login, logout, deleteAdmin, getAdmin, getAllAdmins } from '../controllers/authController';
import { auth } from '../middleware/authMiddleware';

const router: express.Router = express.Router();

// Admin authentication routes
router.post('/register', register);
router.post('/login', login);
router.get('/me', auth, getAdmin);
router.get('/logout', auth, logout);
router.delete('/delete', auth, deleteAdmin);
router.get('/admins', auth, getAllAdmins);

export default router;

