import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
  };
}

export const authMiddleware = (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.split(' ')[1];

  console.log('🔐 Auth Middleware Called');
  console.log('📋 Authorization Header:', authHeader ? authHeader.substring(0, 50) + '...' : 'NONE');
  console.log('📋 Token:', token ? token.substring(0, 50) + '...' : 'NONE');
  console.log('🔑 JWT_SECRET is set:', !!process.env.JWT_SECRET);

  if (!token) {
    console.error('❌ No token provided');
    return res.status(401).json({
      success: false,
      error: 'Authorization token not provided',
    });
  }

  try {
    console.log('🔍 Verifying token...');
    const secret = process.env.JWT_SECRET || 'default-secret';
    const decoded = jwt.verify(token, secret) as any;
    console.log('✅ Token verified successfully. User:', decoded.id, decoded.email);
    req.user = decoded;
    next();
  } catch (error: any) {
    console.error('❌ JWT Verification Error:', error.message);
    console.error('❌ Error Code:', error.code);
    console.error('❌ Token (first 100 chars):', token.substring(0, 100));
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
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'default-secret') as any;
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
