import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import { supabase } from '../config/supabase.js';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { createUser, findUserByEmail, listUsers, updateUser } from '../lib/userStore.js';

function isTransientAuthError(error: any): boolean {
  const message = `${error?.message || ''} ${error?.code || ''}`.toLowerCase();
  return [
    'fetch failed',
    'network',
    'socket hang up',
    'econnrefused',
    'etimedout',
    'timed out',
    'temporarily unavailable',
    'supabase unavailable',
    'missing supabase',
    'does not exist',
    'column',
  ].some((fragment) => message.includes(fragment));
}

function normalizeRole(role: string | undefined) {
  const requestedRole = typeof role === 'string' ? role.toLowerCase() : 'student';
  if (requestedRole === 'instructor') {
    return 'pending_instructor';
  }
  return requestedRole;
}

function getApprovalStatus(role: string | undefined) {
  return normalizeRole(role) === 'pending_instructor' ? 'pending' : 'approved';
}

export const register = async (req: AuthRequest, res: Response) => {
  try {
    const { email, password, full_name, role = 'student' } = req.body;

    if (!email || !password || !full_name) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Missing required fields',
        },
      });
    }

    const normalizedRole = normalizeRole(role);
    const approvalStatus = getApprovalStatus(role);

    try {
      if (!supabase) {
        throw new Error('Supabase unavailable');
      }

      const { data: existingUser, error: existingUserError } = await supabase
        .from('users')
        .select('id')
        .eq('email', email)
        .single();

      if (existingUserError && existingUserError.code !== 'PGRST116') {
        throw existingUserError;
      }

      if (existingUser) {
        return res.status(409).json({
          success: false,
          error: {
            code: 'USER_EXISTS',
            message: 'User already exists',
          },
        });
      }
    } catch (error: any) {
      if (!isTransientAuthError(error)) {
        throw error;
      }

      const fallbackUser = findUserByEmail(email);
      if (fallbackUser) {
        return res.status(409).json({
          success: false,
          error: {
            code: 'USER_EXISTS',
            message: 'User already exists',
          },
        });
      }
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    try {
      if (!supabase) {
        throw new Error('Supabase unavailable');
      }

      const { data: user, error } = await supabase
        .from('users')
        .insert({
          id: uuidv4(),
          email,
          password_hash: hashedPassword,
          full_name,
          role: normalizedRole,
          approval_status: approvalStatus,
          avatar_url: `https://api.dicebear.com/7.x/avataaars/svg?seed=${email}`,
          xp_total: 0,
          streak_days: 0,
        })
        .select();

      if (error) throw error;

      return res.status(201).json({
        success: true,
        data: {
          user: {
            id: user[0].id,
            email: user[0].email,
            full_name: user[0].full_name,
            role: user[0].role,
            approval_status: user[0].approval_status,
          },
          message: normalizedRole === 'pending_instructor'
            ? 'Registration successful. Your instructor request is pending approval.'
            : 'Registration successful',
        },
      });
    } catch (error: any) {
      if (!isTransientAuthError(error)) {
        throw error;
      }

      const fallbackUser = createUser({
        id: uuidv4(),
        email,
        password_hash: hashedPassword,
        full_name,
        role: normalizedRole,
        approval_status: approvalStatus,
        avatar_url: `https://api.dicebear.com/7.x/avataaars/svg?seed=${email}`,
        xp_total: 0,
        streak_days: 0,
      });

      return res.status(201).json({
        success: true,
        data: {
          user: {
            id: fallbackUser.id,
            email: fallbackUser.email,
            full_name: fallbackUser.full_name,
            role: fallbackUser.role,
            approval_status: fallbackUser.approval_status,
          },
          message: normalizedRole === 'pending_instructor'
            ? 'Registration successful. Your instructor request is pending approval.'
            : 'Registration successful',
        },
      });
    }
  } catch (error: any) {
    console.error('Register error:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'REGISTRATION_FAILED',
        message: error.message,
      },
    });
  }
};

export const login = async (req: AuthRequest, res: Response) => {
  try {
    const { email, password } = req.body;

    console.log('🔐 Login attempt for:', email);

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Missing email or password',
        },
      });
    }

    let user: any = null;

    try {
      if (!supabase) {
        throw new Error('Supabase unavailable');
      }

      const { data: dbUser, error } = await supabase
        .from('users')
        .select('*')
        .eq('email', email)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      user = dbUser;
    } catch (error: any) {
      if (!isTransientAuthError(error)) {
        throw error;
      }

      const fallbackUser = findUserByEmail(email);
      if (fallbackUser) {
        user = fallbackUser;
      }
    }

    if (!user) {
      console.error('❌ User not found:', email);
      return res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Invalid email or password',
        },
      });
    }

    if (user.role === 'pending_instructor' || user.approval_status === 'pending') {
      return res.status(403).json({
        success: false,
        error: {
          code: 'PENDING_APPROVAL',
          message: 'Your instructor account is pending admin approval.',
        },
      });
    }

    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      console.error('❌ Invalid password for:', email);
      return res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Invalid email or password',
        },
      });
    }

    const jwtSecret = process.env.JWT_SECRET || 'default-secret';
    const jwtRefreshSecret = process.env.JWT_REFRESH_SECRET || 'default-refresh-secret';
    const jwtExpiration = process.env.JWT_EXPIRATION || '3600s';
    const jwtRefreshExpiration = process.env.JWT_REFRESH_EXPIRATION || '86400s';

    console.log('🔑 Token Config:');
    console.log('   JWT_SECRET length:', jwtSecret.length);
    console.log('   JWT_EXPIRATION:', jwtExpiration);
    console.log('   JWT_REFRESH_EXPIRATION:', jwtRefreshExpiration);

    const accessToken = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      jwtSecret as any,
      { expiresIn: jwtExpiration } as any
    );

    const refreshToken = jwt.sign(
      { id: user.id },
      jwtRefreshSecret as any,
      { expiresIn: jwtRefreshExpiration } as any
    );

    console.log('✅ Tokens generated successfully');
    console.log('📋 Access Token (first 50 chars):', accessToken.substring(0, 50) + '...');

    return res.json({
      success: true,
      data: {
        access_token: accessToken,
        refresh_token: refreshToken,
        expires_in: 3600,
        user: {
          id: user.id,
          email: user.email,
          full_name: user.full_name,
          role: user.role,
          approval_status: user.approval_status,
          avatar_url: user.avatar_url,
          xp_total: user.xp_total,
          streak_days: user.streak_days,
        },
      },
    });
  } catch (error: any) {
    console.error('Login error:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'LOGIN_FAILED',
        message: error.message,
      },
    });
  }
};

export const listPendingInstructors = async (req: AuthRequest, res: Response) => {
  try {
    if (req.user?.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Admin role required' },
      });
    }

    try {
      if (!supabase) {
        throw new Error('Supabase unavailable');
      }

      const { data: pendingUsersFromDb, error } = await supabase
        .from('users')
        .select('*')
        .eq('role', 'pending_instructor');

      if (error) throw error;

      const pendingUsers = (pendingUsersFromDb || [])
        .filter((user: any) => user.role === 'pending_instructor' || user.approval_status === 'pending')
        .map(({ password_hash, ...rest }: any) => rest);

      return res.json({
        success: true,
        data: { pending_instructors: pendingUsers },
      });
    } catch (error: any) {
      if (!isTransientAuthError(error)) {
        throw error;
      }

      const pendingUsers = listUsers()
        .filter((user) => user.role === 'pending_instructor' || user.approval_status === 'pending')
        .map(({ password_hash, ...rest }) => rest);

      return res.json({
        success: true,
        data: { pending_instructors: pendingUsers },
      });
    }
  } catch (error: any) {
    console.error('List pending instructors error:', error);
    return res.status(500).json({
      success: false,
      error: { code: 'FETCH_FAILED', message: error.message },
    });
  }
};

export const approveInstructor = async (req: AuthRequest, res: Response) => {
  try {
    if (req.user?.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Admin role required' },
      });
    }

    try {
      if (!supabase) {
        throw new Error('Supabase unavailable');
      }

      const { data: updatedUser, error } = await supabase
        .from('users')
        .update({ role: 'instructor', approval_status: 'approved' })
        .eq('id', req.params.id)
        .select('*')
        .single();

      if (error) throw error;

      return res.json({
        success: true,
        data: { user: updatedUser },
        message: 'Instructor approved successfully',
      });
    } catch (error: any) {
      if (!isTransientAuthError(error)) {
        throw error;
      }

      const updatedUser = updateUser(req.params.id, { role: 'instructor', approval_status: 'approved' });
      if (!updatedUser) {
        return res.status(404).json({
          success: false,
          error: { code: 'USER_NOT_FOUND', message: 'Instructor request not found' },
        });
      }

      return res.json({
        success: true,
        data: { user: updatedUser },
        message: 'Instructor approved successfully',
      });
    }
  } catch (error: any) {
    console.error('Approve instructor error:', error);
    return res.status(500).json({
      success: false,
      error: { code: 'UPDATE_FAILED', message: error.message },
    });
  }
};

export const rejectInstructor = async (req: AuthRequest, res: Response) => {
  try {
    if (req.user?.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Admin role required' },
      });
    }

    try {
      if (!supabase) {
        throw new Error('Supabase unavailable');
      }

      const { data: updatedUser, error } = await supabase
        .from('users')
        .update({ role: 'student', approval_status: 'rejected' })
        .eq('id', req.params.id)
        .select('*')
        .single();

      if (error) throw error;

      return res.json({
        success: true,
        data: { user: updatedUser },
        message: 'Instructor request rejected',
      });
    } catch (error: any) {
      if (!isTransientAuthError(error)) {
        throw error;
      }

      const updatedUser = updateUser(req.params.id, { role: 'student', approval_status: 'rejected' });
      if (!updatedUser) {
        return res.status(404).json({
          success: false,
          error: { code: 'USER_NOT_FOUND', message: 'Instructor request not found' },
        });
      }

      return res.json({
        success: true,
        data: { user: updatedUser },
        message: 'Instructor request rejected',
      });
    }
  } catch (error: any) {
    console.error('Reject instructor error:', error);
    return res.status(500).json({
      success: false,
      error: { code: 'UPDATE_FAILED', message: error.message },
    });
  }
};

export const refresh = async (req: AuthRequest, res: Response) => {
  try {
    const { refresh_token } = req.body;

    if (!refresh_token) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_TOKEN',
          message: 'Refresh token not provided',
        },
      });
    }

    const decoded = jwt.verify(
      refresh_token,
      process.env.JWT_REFRESH_SECRET || 'default-refresh-secret'
    ) as any;

    const { data: user } = await supabase
      .from('users')
      .select('id, email, role')
      .eq('id', decoded.id)
      .single();

    if (!user) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'USER_NOT_FOUND',
          message: 'User not found',
        },
      });
    }

    const newAccessToken = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      (process.env.JWT_SECRET || 'default-secret') as any,
      { expiresIn: process.env.JWT_EXPIRATION || '3600s' } as any
    );

    return res.json({
      success: true,
      data: {
        access_token: newAccessToken,
        expires_in: 3600,
      },
    });
  } catch (error: any) {
    return res.status(401).json({
      success: false,
      error: {
        code: 'INVALID_REFRESH_TOKEN',
        message: 'Invalid or expired refresh token',
      },
    });
  }
};

export const logout = async (req: AuthRequest, res: Response) => {
  return res.json({
    success: true,
    message: 'Logged out successfully',
  });
};
