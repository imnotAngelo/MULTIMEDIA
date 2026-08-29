import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';
import { requireJwtSecret } from './security.js';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
    year_level?: number;
    teaching_year_levels?: number[];
    section?: string;
    teaching_sections?: string[];
  };
}

export const authMiddleware = (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.split(' ')[1];

  if (!token) {
    return res.status(401).json({
      success: false,
      error: 'Authorization token not provided',
    });
  }

  try {
    const decoded = jwt.verify(token, requireJwtSecret()) as any;
    req.user = decoded;
    next();
  } catch (error: any) {
    return res.status(401).json({
      success: false,
      error: `Invalid or expired token: ${error.message}`,
    });
  }
};

// Optional auth - validates token if provided, but doesn't require it
export const optionalAuthMiddleware = (req: AuthRequest, res: Response, next: NextFunction) => {
  const token = req.headers.authorization?.split(' ')[1];

  if (token) {
    try {
      const decoded = jwt.verify(token, requireJwtSecret()) as any;
      req.user = decoded;
    } catch (error) {
      // Token provided but invalid - still allow request with no user
      console.warn('Invalid token provided, continuing without auth');
    }
  }

  // Always continue, even without valid token
  next();
};

export const errorHandler = (err: any, req: Request, res: Response, next: NextFunction) => {
  console.error('Error:', err);

  res.status(err.status || 500).json({
    success: false,
    error: {
      code: err.code || 'INTERNAL_SERVER_ERROR',
      message: err.message || 'Internal server error',
    },
  });
};
