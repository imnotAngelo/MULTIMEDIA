import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import { supabase } from '../config/supabase.js';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';

export const register = async (req: AuthRequest, res: Response) => {
  try {
    const { email, password, full_name, role = 'student', year_level, section } = req.body;

    if (role !== 'student' && role !== 'instructor') {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_ROLE', message: 'Only student and instructor registration is allowed' },
      });
    }

    const parsedYear = Number(year_level);
    if (!Number.isInteger(parsedYear) || parsedYear < 1 || parsedYear > 4) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_YEAR_LEVEL', message: 'Year level must be 1, 2, 3, or 4' },
      });
    }

    if (typeof section !== 'string' || !section.trim() || section.trim().length > 50) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_SECTION', message: 'Section is required and must be 50 characters or fewer' },
      });
    }

    // Validate input
    if (!email || !password || !full_name) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Missing required fields',
        },
      });
    }

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
      throw error;
    }

    // Hash password
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
          role,
          instructor_approved: role !== 'instructor',
          student_approved: role !== 'student',
          year_level: parsedYear,
          teaching_year_levels: role === 'instructor' ? [parsedYear] : [],
          section: section.trim(),
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
          },
          message: 'Registration successful',
        },
      });
    } catch (error: any) {
      return res.status(503).json({
        success: false,
        error: {
          code: 'DB_UNAVAILABLE',
          message: 'Registration could not be saved because Supabase is unavailable.',
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
      throw error;
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

    // Verify password
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

    if (user.role === 'instructor' && user.instructor_approved === false) {
      return res.status(403).json({
        success: false,
        error: { code: 'INSTRUCTOR_PENDING_APPROVAL', message: 'Your instructor account is waiting for administrator approval.' },
      });
    }

    if (user.role === 'student' && user.student_approved === false) {
      return res.status(403).json({
        success: false,
        error: { code: 'STUDENT_PENDING_APPROVAL', message: 'Your account is waiting for approval from your section\'s instructor.' },
      });
    }

    // Generate tokens
    const jwtSecret = process.env.JWT_SECRET || 'default-secret';
    const jwtRefreshSecret = process.env.JWT_REFRESH_SECRET || 'default-refresh-secret';
    const jwtExpiration = process.env.JWT_EXPIRATION || '3600s';
    const jwtRefreshExpiration = process.env.JWT_REFRESH_EXPIRATION || '86400s';

    console.log('🔑 Token Config:');
    console.log('   JWT_SECRET length:', jwtSecret.length);
    console.log('   JWT_EXPIRATION:', jwtExpiration);
    console.log('   JWT_REFRESH_EXPIRATION:', jwtRefreshExpiration);

    const accessToken = jwt.sign(
      {
        id: user.id,
        email: user.email,
        role: user.role,
        year_level: user.year_level,
        teaching_year_levels: user.teaching_year_levels,
        section: user.section,
      },
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
          instructor_approved: user.instructor_approved !== false,
          student_approved: user.student_approved !== false,
          year_level: user.year_level,
          teaching_year_levels: user.teaching_year_levels,
          section: user.section,
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

    if (!supabase) {
      return res.status(503).json({
        success: false,
        error: { code: 'DATABASE_UNAVAILABLE', message: 'Database is unavailable' },
      });
    }

    const { data: user } = await supabase
      .from('users')
      .select('id, email, role, year_level, teaching_year_levels, section')
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
      {
        id: user.id,
        email: user.email,
        role: user.role,
        year_level: user.year_level,
        teaching_year_levels: user.teaching_year_levels,
        section: user.section,
      },
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
