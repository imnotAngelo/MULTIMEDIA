import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth.js';

export function adminMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({
      success: false,
      error: { code: 'FORBIDDEN', message: 'Administrator access required' },
    });
  }

  next();
}

export function instructorMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  if (req.user?.role !== 'instructor') {
    return res.status(403).json({
      success: false,
      error: { code: 'FORBIDDEN', message: 'Instructor access required' },
    });
  }

  next();
}