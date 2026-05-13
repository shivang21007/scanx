import jwt from 'jsonwebtoken';
import { env } from '../env/env';
import { Request, Response, NextFunction } from 'express';
import { getCurrentIST } from '../utils/timezone';
import { getRequestLogger } from '../logger/logger';

/**
 * Middleware to check if registration endpoint is enabled
 * Returns 405 Method Not Allowed if registration is disabled
 */
export const checkRegisterEnabled = (req: Request, res: Response, next: NextFunction) => {
  const log = getRequestLogger(req);
  if (!env.ENABLE_REGISTER_ENDPOINT) {
    log.info('registration_disabled', { enableRegisterEndpoint: env.ENABLE_REGISTER_ENDPOINT, redirectTo: '/login' });
    return res.status(405).json({
      message: 'Registration is not available. Please use the login endpoint.',
      error: 'Method Not Allowed',
      redirectTo: '/login'
    });
  }
  next();
};

// Extend Request interface to include admin info
interface AuthRequest extends Request {
  admin?: {
    id: number;
    email: string;
  };
}

export const auth = (req: AuthRequest, res: Response, next: NextFunction) => {
  const log = getRequestLogger(req);
  // Try to get token from cookie first, then fall back to Authorization header for backwards compatibility
  const token = req.cookies?.scanx_token || 
    (req.header('Authorization')?.startsWith('Bearer ') ? req.header('Authorization')!.split(' ')[1] : null);
  
  // console.log('Auth middleware called for:', req.path);
  // console.log('Cookies received:', Object.keys(req.cookies || {}));
  
  if (!token) {
    log.warn('auth_missing_token');
    return res.status(401).json({ 
      message: 'Access denied. No token provided.',
      logout: true 
    });
  }

  try {
    const decoded = jwt.verify(token, env.JWT_SECRET as string) as any;
    
    // Check if token is expired (using IST time)
    const currentTime = Math.floor(getCurrentIST().getTime() / 1000);
    if (decoded.exp && decoded.exp < currentTime) {
      log.warn('auth_token_expired_claim', { email: decoded.email });
      return res.status(401).json({ 
        message: 'Token expired. Please sign in again.',
        logout: true,
        expired: true
      });
    }
    
    req.admin = { id: decoded.id, email: decoded.email };
    next();
  } catch (err: any) {
    // console.log('Token verification failed:', err.message);
    
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

