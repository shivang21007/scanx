import { AdminModel, Admin } from '../models/Admin';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { env } from '../env/env';
import { Request, Response } from 'express';
import { sendForgotPasswordOTPMail, sendRegistrationWelcomeMail } from '../services/sendMail';
import { storeOtp, getOtp, deleteOtp } from '../utils/otpManager';
// Extend Request interface to include admin info
interface AuthRequest extends Request {
  admin?: Admin;
}

export const getAdmin = async (req: AuthRequest, res: Response) => {
  try {
    console.log('getAdmin called, req.admin:', req.admin);
    
    if (!req.admin?.id) {
      console.log('No admin ID in request, returning 401');
      return res.status(401).json({ message: 'Unauthorized' });
    }
    
    const admin = await AdminModel.findById(req.admin.id);
    if (!admin) {
      console.log('Admin not found in database for ID:', req.admin.id);
      return res.status(404).json({ message: 'Admin not found' });
    }
    
    console.log('Admin found, returning data:', admin.email);
    // Remove password from response
    const { password, ...adminData } = admin;
    res.json(adminData);
  } catch (err: any) {
    console.error('getAdmin error:', err);
    res.status(500).json({ error: err.message });
  }
};

export const register = async (req: Request, res: Response) => {
  const { email, password, name } = req.body;

  try {
    // Validate input
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    // Check if admin already exists
    const existing = await AdminModel.findByEmail(email);
    if (existing) {
      return res.status(400).json({ message: 'Admin already exists' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);
    
    // Create new admin
    const adminId = await AdminModel.create({ 
      email, 
      password: hashedPassword, 
      name 
    });

    // Return admin data (without password)
    // Note: No token is generated here - user must login separately to get a token
    const adminData = { id: adminId, email, name };
    
    res.status(201).json({ 
      message: 'Admin registered successfully. Please login to continue.',
      admin: adminData
    });

    // Send welcome email (non-blocking, won't crash if it fails)
    sendRegistrationWelcomeMail(email, name).catch((emailError) => {
      console.error('Failed to send registration welcome email:', emailError.message);
      // Email failure doesn't affect registration success
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

export const login = async (req: Request, res: Response) => {
  const { email, password } = req.body;

  try {
    // Validate input
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    // Check if admin exists
    const admin = await AdminModel.findByEmail(email);
    if (!admin) {
      return res.status(400).json({ message: 'User not found' });
    }

    // Check if password is correct
    const isMatch = await bcrypt.compare(password, admin.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    // Generate JWT token
    const token = jwt.sign(
      { id: admin.id, email: admin.email }, 
      env.JWT_SECRET as string, 
      { expiresIn: '12h' }
    );
    
    // Get dynamic domain from request
    const requestHost = req.get('host'); // Gets "localhost:5173" or "127.0.0.1:5173"
    const hostname = requestHost?.split(':')[0]; // Gets "localhost" or "127.0.0.1"
    
    console.log('Login: Request host:', requestHost, 'Hostname:', hostname);
    
    // Set secure httpOnly cookie with dynamic domain
    res.cookie('scanx_token', token, {
      httpOnly: true,
      secure: env.NODE_ENV === 'production', // Only over HTTPS in production
      sameSite: env.NODE_ENV === 'production' ? 'strict' : 'lax', // Prevent CSRF attacks
      maxAge: 12 * 60 * 60 * 1000, // 12 hours in milliseconds
      path: '/',
      // In development: don't set domain (works with any host)
      // In production: you might want to set a specific domain
      domain: hostname ? hostname : undefined
    });
    
    console.log('Setting cookie with token:', token.substring(0, 20) + '...');
    
    // Remove password from response
    const { password: _, ...adminData } = admin;
    
    res.json({ 
      message: 'Login successful',
      admin: adminData
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

export const logout = async (req: Request, res: Response) => {
  // Get dynamic domain from request
  const requestHost = req.get('host'); // Gets "localhost:5173" or "127.0.0.1:5173"
  const hostname = requestHost?.split(':')[0]; // Gets "localhost" or "127.0.0.1"
  
  console.log('Logout: Request host:', requestHost, 'Hostname:', hostname);
  
  // Clear the httpOnly cookie with same settings as when it was set
  res.clearCookie('scanx_token', {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: env.NODE_ENV === 'production' ? 'strict' : 'lax',
    path: '/',
    // In development: don't set domain (works with any host)
    // In production: you might want to set a specific domain
    domain: hostname ? hostname : undefined
  });
  
  console.log('User logged out, cookie cleared');
  res.json({ message: 'Logged out successfully' });
};

export const deleteAdmin = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.admin?.id) {
      return res.status(401).json({ message: 'Unauthorized' });
    }
    
    // Delete admin by ID
    const deleted = await AdminModel.delete(req.admin.id);
    if (!deleted) {
      return res.status(404).json({ message: 'Admin not found' });
    }
    
    res.json({ message: 'Admin deleted successfully' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

export const getAllAdmins = async (req: AuthRequest, res: Response) => {
  try {
    const admins = await AdminModel.findAll();
    res.json(admins);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};


/**
 * Step 1: Send OTP to user's email
 */
export const forgotPasswordSendOTP = async (req: Request, res: Response) => {
  const { email } = req.body;
  
  try {
    // Validate input
    if (!email) {
      return res.status(400).json({ message: 'Email is required' });
    }

    // Check if admin exists
    const admin = await AdminModel.findByEmail(email);
    if (!admin) {
      return res.status(404).json({ message: 'No account found with this email' });
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    
    // Store OTP in Redis with 10 minutes TTL
    await storeOtp(email, otp);
    
    // Send OTP email (non-blocking, won't crash if it fails)
    sendForgotPasswordOTPMail(email, otp).catch((emailError) => {
      console.error('Failed to send OTP email:', emailError.message);
      // OTP is still stored in Redis, user can retry or contact support
    });
    
    console.log(`📧 OTP sent to ${email}`);
    return res.status(200).json({ 
      message: 'OTP sent to your email. Please check your inbox.',
      email 
    });
  } catch (err: any) {
    console.error('Error sending OTP:', err);
    res.status(500).json({ 
      message: 'Failed to send OTP. Please try again.',
      error: err.message 
    });
  }
};

/**
 * Step 2: Verify OTP
 */
export const forgotPasswordVerifyOTP = async (req: Request, res: Response) => {
  const { email, otp } = req.body;
  
  try {
    // Validate input
    if (!email || !otp) {
      return res.status(400).json({ message: 'Email and OTP are required' });
    }

    // Get OTP from Redis
    const storedOtp = await getOtp(email);
    
    if (!storedOtp) {
      return res.status(400).json({ message: 'OTP expired or not found. Please request a new one.' });
    }

    // Verify OTP
    if (storedOtp !== otp) {
      return res.status(400).json({ message: 'Invalid OTP. Please try again.' });
    }

    console.log(`✅ OTP verified for ${email}`);
    return res.status(200).json({ 
      message: 'OTP verified successfully. You can now reset your password.',
      email 
    });
  } catch (err: any) {
    console.error('Error verifying OTP:', err);
    res.status(500).json({ 
      message: 'Failed to verify OTP. Please try again.',
      error: err.message 
    });
  }
};

/**
 * Step 3: Reset password
 */
export const ResetPassword = async (req: Request, res: Response) => {
  const { email, otp, newPassword } = req.body;
  
  try {
    // Validate input
    if (!email || !otp || !newPassword) {
      return res.status(400).json({ message: 'Email, OTP, and new password are required' });
    }

    // Verify OTP one more time
    const storedOtp = await getOtp(email);
    
    if (!storedOtp) {
      return res.status(400).json({ message: 'OTP expired. Please start the process again.' });
    }

    if (storedOtp !== otp) {
      return res.status(400).json({ message: 'Invalid OTP.' });
    }

    // Get admin
    const admin = await AdminModel.findByEmail(email);
    if (!admin) {
      return res.status(404).json({ message: 'Account not found' });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 12);
    
    // Update password in database
    if (!admin.id) {
      return res.status(500).json({ message: 'Admin ID not found' });
    }
    await AdminModel.updatePassword(admin.id, hashedPassword);
    
    // Delete OTP from Redis
    await deleteOtp(email);
    
    console.log(`🔐 Password reset successful for ${email}`);
    return res.status(200).json({ 
      message: 'Password reset successfully. You can now login with your new password.' 
    });
  } catch (err: any) {
    console.error('Error resetting password:', err);
    res.status(500).json({ 
      message: 'Failed to reset password. Please try again.',
      error: err.message 
    });
  }
};
