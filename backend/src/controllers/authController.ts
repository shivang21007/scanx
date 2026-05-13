import { AdminModel, Admin } from '../models/Admin';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { env } from '../env/env';
import { Request, Response } from 'express';
import { sendForgotPasswordOTPMail, sendRegistrationWelcomeMail } from '../services/sendMail';
import { storeOtp, getOtp, deleteOtp } from '../utils/otpManager';
import { getRequestLogger } from '../logger/logger';

interface AuthRequest extends Request {
  admin?: Admin;
}

export const getAdmin = async (req: AuthRequest, res: Response) => {
  const log = getRequestLogger(req);
  try {
    if (!req.admin?.id) {
      log.warn('auth_me_missing_admin_id');
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const admin = await AdminModel.findById(req.admin.id);
    if (!admin) {
      log.warn('auth_me_admin_not_found', { adminId: req.admin.id });
      return res.status(404).json({ message: 'Admin not found' });
    }

    log.info('auth_me_success', { email: admin.email });
    const { password, ...adminData } = admin;
    res.json(adminData);
  } catch (err: any) {
    log.error('auth_me_failed', { error: err?.message });
    res.status(500).json({ error: err.message });
  }
};

export const register = async (req: Request, res: Response) => {
  const log = getRequestLogger(req);
  const { email, password, name } = req.body;

  try {
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    const existing = await AdminModel.findByEmail(email);
    if (existing) {
      return res.status(400).json({ message: 'Admin already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const adminId = await AdminModel.create({
      email,
      password: hashedPassword,
      name
    });

    const adminData = { id: adminId, email, name };

    res.status(201).json({
      message: 'Admin registered successfully. Please login to continue.',
      admin: adminData
    });

    sendRegistrationWelcomeMail(email, name).catch((emailError: Error) => {
      log.error('registration_welcome_email_failed', { email, error: emailError.message });
    });
  } catch (err: any) {
    log.error('register_failed', { error: err?.message });
    res.status(500).json({ error: err.message });
  }
};

export const login = async (req: Request, res: Response) => {
  const log = getRequestLogger(req);
  const { email, password } = req.body;

  try {
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    const admin = await AdminModel.findByEmail(email);
    if (!admin) {
      log.warn('login_user_not_found', { email });
      return res.status(400).json({ message: 'User not found' });
    }

    const isMatch = await bcrypt.compare(password, admin.password);
    if (!isMatch) {
      log.warn('login_invalid_credentials', { email });
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { id: admin.id, email: admin.email },
      env.JWT_SECRET as string,
      { expiresIn: '12h' }
    );

    const requestHost = req.get('host');
    const hostname = requestHost?.split(':')[0];

    log.info('login_success', { email, requestHost, hostname });

    res.cookie('scanx_token', token, {
      httpOnly: true,
      secure: env.NODE_ENV === 'production',
      sameSite: env.NODE_ENV === 'production' ? 'strict' : 'lax',
      maxAge: 12 * 60 * 60 * 1000,
      path: '/',
      domain: hostname ? hostname : undefined
    });

    const { password: _, ...adminData } = admin;

    res.json({
      message: 'Login successful',
      admin: adminData
    });
  } catch (err: any) {
    log.error('login_failed', { error: err?.message });
    res.status(500).json({ error: err.message });
  }
};

export const logout = async (req: Request, res: Response) => {
  const log = getRequestLogger(req);
  const requestHost = req.get('host');
  const hostname = requestHost?.split(':')[0];

  log.info('logout', { requestHost, hostname });

  res.clearCookie('scanx_token', {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: env.NODE_ENV === 'production' ? 'strict' : 'lax',
    path: '/',
    domain: hostname ? hostname : undefined
  });

  res.json({ message: 'Logged out successfully' });
};

export const deleteAdmin = async (req: AuthRequest, res: Response) => {
  const log = getRequestLogger(req);
  try {
    if (!req.admin?.id) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const deleted = await AdminModel.delete(req.admin.id);
    if (!deleted) {
      return res.status(404).json({ message: 'Admin not found' });
    }

    log.info('admin_deleted', { adminId: req.admin.id });
    res.json({ message: 'Admin deleted successfully' });
  } catch (err: any) {
    log.error('delete_admin_failed', { error: err?.message });
    res.status(500).json({ error: err.message });
  }
};

export const getAllAdmins = async (req: AuthRequest, res: Response) => {
  const log = getRequestLogger(req);
  try {
    const admins = await AdminModel.findAll();
    res.json(admins);
  } catch (err: any) {
    log.error('get_all_admins_failed', { error: err?.message });
    res.status(500).json({ error: err.message });
  }
};

export const forgotPasswordSendOTP = async (req: Request, res: Response) => {
  const log = getRequestLogger(req);
  const { email } = req.body;

  try {
    if (!email) {
      return res.status(400).json({ message: 'Email is required' });
    }

    const admin = await AdminModel.findByEmail(email);
    if (!admin) {
      return res.status(404).json({ message: 'No account found with this email' });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    await storeOtp(email, otp);

    sendForgotPasswordOTPMail(email, otp).catch((emailError: Error) => {
      log.error('forgot_password_otp_email_failed', { email, error: emailError.message });
    });

    log.info('forgot_password_otp_sent', { email });
    return res.status(200).json({
      message: 'OTP sent to your email. Please check your inbox.',
      email
    });
  } catch (err: any) {
    log.error('forgot_password_send_otp_failed', { error: err?.message });
    res.status(500).json({
      message: 'Failed to send OTP. Please try again.',
      error: err.message
    });
  }
};

export const forgotPasswordVerifyOTP = async (req: Request, res: Response) => {
  const log = getRequestLogger(req);
  const { email, otp } = req.body;

  try {
    if (!email || !otp) {
      return res.status(400).json({ message: 'Email and OTP are required' });
    }

    const storedOtp = await getOtp(email);

    if (!storedOtp) {
      return res.status(400).json({ message: 'OTP expired or not found. Please request a new one.' });
    }

    if (storedOtp !== otp) {
      return res.status(400).json({ message: 'Invalid OTP. Please try again.' });
    }

    log.info('forgot_password_otp_verified', { email });
    return res.status(200).json({
      message: 'OTP verified successfully. You can now reset your password.',
      email
    });
  } catch (err: any) {
    log.error('forgot_password_verify_otp_failed', { error: err?.message });
    res.status(500).json({
      message: 'Failed to verify OTP. Please try again.',
      error: err.message
    });
  }
};

export const ResetPassword = async (req: Request, res: Response) => {
  const log = getRequestLogger(req);
  const { email, otp, newPassword } = req.body;

  try {
    if (!email || !otp || !newPassword) {
      return res.status(400).json({ message: 'Email, OTP, and new password are required' });
    }

    const storedOtp = await getOtp(email);

    if (!storedOtp) {
      return res.status(400).json({ message: 'OTP expired. Please start the process again.' });
    }

    if (storedOtp !== otp) {
      return res.status(400).json({ message: 'Invalid OTP.' });
    }

    const admin = await AdminModel.findByEmail(email);
    if (!admin) {
      return res.status(404).json({ message: 'Account not found' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 12);

    if (!admin.id) {
      return res.status(500).json({ message: 'Admin ID not found' });
    }
    await AdminModel.updatePassword(admin.id, hashedPassword);

    await deleteOtp(email);

    log.info('password_reset_success', { email });
    return res.status(200).json({
      message: 'Password reset successfully. You can now login with your new password.'
    });
  } catch (err: any) {
    log.error('password_reset_failed', { error: err?.message });
    res.status(500).json({
      message: 'Failed to reset password. Please try again.',
      error: err.message
    });
  }
};
