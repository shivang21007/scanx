import jwt from 'jsonwebtoken';
import { env } from '../env/env';
import { Request, Response, NextFunction } from 'express';
import { getCurrentIST } from '../utils/timezone';

// Extend Request interface to include admin info
interface AuthRequest extends Request {
  admin?: {
    id: number;
    email: string;
  };
}

export const auth = (req: AuthRequest, res: Response, next: NextFunction) => {
  // Try to get token from cookie first, then fall back to Authorization header for backwards compatibility
  const token = req.cookies?.scanx_token || 
    (req.header('Authorization')?.startsWith('Bearer ') ? req.header('Authorization')!.split(' ')[1] : null);
  
  console.log('Auth middleware called for:', req.path);
  console.log('Cookies received:', Object.keys(req.cookies || {}));
  console.log('Token found:', !!token);
  
  if (!token) {
    console.log('No token provided, returning 401');
    return res.status(401).json({ 
      message: 'Access denied. No token provided.',
      logout: true 
    });
  }

  try {
    const decoded = jwt.verify(token, env.JWT_SECRET as string) as any;
    console.log('Token decoded successfully for user:', decoded.email);
    
    // Check if token is expired (using IST time)
    const currentTime = Math.floor(getCurrentIST().getTime() / 1000);
    if (decoded.exp && decoded.exp < currentTime) {
      console.log('Token expired for user:', decoded.email);
      return res.status(401).json({ 
        message: 'Token expired. Please sign in again.',
        logout: true,
        expired: true
      });
    }
    
    req.admin = { id: decoded.id, email: decoded.email };
    console.log('Auth successful, proceeding to next middleware');
    next();
  } catch (err: any) {
    console.log('Token verification failed:', err.message);
    
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        message: 'Token expired. Please sign in again.',
        logout: true,
        expired: true
      });
    } else if (err.name === 'JsonWebTokenError') {
      return res.status(401).json({ 
        message: 'Invalid token. Please sign in again.',
        logout: true 
      });
    } else {
      return res.status(400).json({ 
        message: 'Token validation failed', 
        error: err.message,
        logout: true
      });
    }
  }
};

