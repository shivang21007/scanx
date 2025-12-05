import express from 'express';
import { 
  register, 
  login, 
  logout, 
  deleteAdmin, 
  getAdmin, 
  getAllAdmins,
  forgotPasswordSendOTP,
  forgotPasswordVerifyOTP,
  ResetPassword
} from '../controllers/authController';
import { auth, checkRegisterEnabled } from '../middleware/authMiddleware';

const router: express.Router = express.Router();

// Admin authentication routes
// Register route is protected by ENABLE_REGISTER_ENDPOINT env variable
router.post('/register', checkRegisterEnabled, register);
router.post('/login', login);

// Forgot password routes (public)
router.post('/forgot-password/send-otp', forgotPasswordSendOTP);
router.post('/forgot-password/verify-otp', forgotPasswordVerifyOTP);
router.post('/forgot-password/reset-password', ResetPassword);

// Protected routes
router.get('/me', auth, getAdmin);
router.get('/logout', auth, logout);
router.delete('/delete', auth, deleteAdmin);
router.get('/admins', auth, getAllAdmins);

export default router;

