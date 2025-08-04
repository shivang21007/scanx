import jwt from 'jsonwebtoken';
import { env } from '../env/env';
import { Request, Response, NextFunction } from 'express';

// Extend Request interface to include admin info
interface AuthRequest extends Request {
  admin?: {
    id: number;
    email: string;
  };
}

export const auth = (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.header('Authorization');
  const token = authHeader?.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;
  
  if (!token) {
    return res.status(401).json({ 
      message: 'Access denied. No token provided.',
      logout: true 
    });
  }

  try {
    const decoded = jwt.verify(token, env.JWT_SECRET as string) as any;
    
    // Check if token is expired (24 hours)
    const currentTime = Math.floor(Date.now() / 1000);
    if (decoded.exp && decoded.exp < currentTime) {
      return res.status(401).json({ 
        message: 'Token expired. Please sign in again.',
        logout: true,
        expired: true
      });
    }
    
    req.admin = { id: decoded.id, email: decoded.email };
    next();
  } catch (err: any) {
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

