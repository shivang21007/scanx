import { AdminModel, Admin } from '../models/Admin';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { env } from '../env/env';
import { Request, Response } from 'express';

// Extend Request interface to include admin info
interface AuthRequest extends Request {
  admin?: Admin;
}

export const getAdmin = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.admin?.id) {
      return res.status(401).json({ message: 'Unauthorized' });
    }
    
    const admin = await AdminModel.findById(req.admin.id);
    if (!admin) {
      return res.status(404).json({ message: 'Admin not found' });
    }
    
    // Remove password from response
    const { password, ...adminData } = admin;
    res.json(adminData);
  } catch (err: any) {
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

    // Generate JWT token
    const token = jwt.sign(
      { id: adminId, email }, 
      env.JWT_SECRET as string, 
      { expiresIn: '12h' }
    );
    
    // Set secure httpOnly cookie
    res.cookie('scanx_token', token, {
      httpOnly: true,
      secure: env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 12 * 60 * 60 * 1000,
      path: '/'
    });

    // Return admin data (without password)
    const adminData = { id: adminId, email, name };
    
    res.status(201).json({ 
      message: 'Admin registered successfully',
      admin: adminData
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
      return res.status(400).json({ message: 'Invalid credentials' });
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
    
    // Set secure httpOnly cookie
    res.cookie('scanx_token', token, {
      httpOnly: true,
      secure: env.NODE_ENV === 'production', // Only over HTTPS in production
      sameSite: 'lax', // Prevent CSRF attacks
      maxAge: 12 * 60 * 60 * 1000, // 12 hours in milliseconds
      path: '/'
    });
    
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
  // Clear the httpOnly cookie
  res.clearCookie('scanx_token', {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/'
  });
  
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


