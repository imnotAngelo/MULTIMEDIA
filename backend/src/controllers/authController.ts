import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import { supabase } from '../config/supabase.js';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'node:crypto';
import { EmailServiceError, sendPasswordResetEmail, sendVerificationEmail } from '../lib/email.js';

const VERIFICATION_TOKEN_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const PASSWORD_RESET_TOKEN_TTL_MS = 30 * 60 * 1000;

function createVerificationToken() {
  return {
    token: crypto.randomBytes(32).toString('hex'),
    code: crypto.randomInt(0, 1_000_000).toString().padStart(6, '0'),
    expiresAt: new Date(Date.now() + VERIFICATION_TOKEN_TTL_MS).toISOString(),
  };
}


export const register = async (req: AuthRequest, res: Response) => {
  try {
    const {
      email: rawEmail,
      password,
      full_name,
      role = 'student',
      year_level,
      section,
      teaching_year_levels,
      teaching_sections,
    } = req.body;
    const email = typeof rawEmail === 'string' ? rawEmail.trim().toLowerCase() : '';

    if (role !== 'student' && role !== 'instructor') {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_ROLE', message: 'Only student and instructor registration is allowed' },
      });
    }

    let parsedYear = 0;
    let parsedTeachingYears: number[] = [];
    let parsedSection = '';
    let parsedTeachingSections: string[] = [];

    if (role === 'instructor') {
      const yearsInput = Array.isArray(teaching_year_levels) ? teaching_year_levels : [];
      for (const value of yearsInput) {
        const n = Number(value);
        if (!Number.isInteger(n) || n < 1 || n > 4) {
          return res.status(400).json({
            success: false,
            error: { code: 'INVALID_YEAR_LEVEL', message: 'Each teaching year level must be 1, 2, 3, or 4' },
          });
        }
        if (!parsedTeachingYears.includes(n)) parsedTeachingYears.push(n);
      }
      if (parsedTeachingYears.length === 0) {
        return res.status(400).json({
          success: false,
          error: { code: 'INVALID_YEAR_LEVEL', message: 'Select at least one year level you teach' },
        });
      }

      const sectionsInput = Array.isArray(teaching_sections) ? teaching_sections : [];
      for (const value of sectionsInput) {
        const trimmed = typeof value === 'string' ? value.trim() : '';
        if (!trimmed || trimmed.length > 50) {
          return res.status(400).json({
            success: false,
            error: { code: 'INVALID_SECTION', message: 'Each section must be 1-50 characters' },
          });
        }
        if (!parsedTeachingSections.includes(trimmed)) parsedTeachingSections.push(trimmed);
      }
      if (parsedTeachingSections.length === 0) {
        return res.status(400).json({
          success: false,
          error: { code: 'INVALID_SECTION', message: 'Add at least one section you handle' },
        });
      }

      parsedYear = parsedTeachingYears[0];
      parsedSection = parsedTeachingSections[0];
    } else {
      parsedYear = Number(year_level);
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
      parsedSection = section.trim();
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

      const { token: verificationToken, code: verificationCode, expiresAt: verificationExpiresAt } = createVerificationToken();

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
          teaching_year_levels: role === 'instructor' ? parsedTeachingYears : [],
          section: parsedSection,
          teaching_sections: role === 'instructor' ? parsedTeachingSections : [],
          avatar_url: `https://api.dicebear.com/7.x/avataaars/svg?seed=${email}`,
          xp_total: 0,
          streak_days: 0,
          email_verified: false,
          email_verification_token: verificationToken,
          email_verification_code: verificationCode,
          email_verification_expires: verificationExpiresAt,
        })
        .select();

      if (error) throw error;

      try {
        await sendVerificationEmail(email, full_name, verificationToken, verificationCode);
      } catch (emailError) {
        console.error('⚠️ Registration succeeded but verification email failed to send:', emailError);
      }

      return res.status(201).json({
        success: true,
        data: {
          user: {
            id: user[0].id,
            email: user[0].email,
            full_name: user[0].full_name,
            role: user[0].role,
          },
          message: 'Registration successful. Please check your email to verify your account before signing in.',
        },
      });
    } catch (error: any) {
      const isUnavailable = !supabase || /fetch failed|network|timeout|econn|unavailable/i.test(error?.message || '');
      console.error('Registration insert failed:', error);
      return res.status(isUnavailable ? 503 : 500).json({
        success: false,
        error: {
          code: isUnavailable ? 'DB_UNAVAILABLE' : error?.code || 'REGISTRATION_INSERT_FAILED',
          message: isUnavailable
            ? 'Registration could not reach Supabase. Please check the backend connection.'
            : error?.message || 'Registration could not be saved.',
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
    const { email: rawEmail, password } = req.body;
    const email = typeof rawEmail === 'string' ? rawEmail.trim().toLowerCase() : '';

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

    if (user.email_verified === false) {
      return res.status(403).json({
        success: false,
        error: { code: 'EMAIL_NOT_VERIFIED', message: 'Please verify your email address before signing in. Check your inbox for the verification link.' },
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
        teaching_sections: user.teaching_sections,
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
          teaching_sections: user.teaching_sections,
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

export const verifyEmail = async (req: AuthRequest, res: Response) => {
  try {
    const token = typeof req.query.token === 'string' ? req.query.token : req.body?.token;

    if (!token) {
      return res.status(400).json({
        success: false,
        error: { code: 'MISSING_TOKEN', message: 'Verification token is required' },
      });
    }

    if (!supabase) {
      return res.status(503).json({
        success: false,
        error: { code: 'DB_UNAVAILABLE', message: 'Database is unavailable.' },
      });
    }

    const { data: user, error } = await supabase
      .from('users')
      .select('id, email_verified, email_verification_expires')
      .eq('email_verification_token', token)
      .single();

    if (error || !user) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_TOKEN', message: 'This verification link is invalid or has already been used.' },
      });
    }

    if (user.email_verified) {
      return res.json({ success: true, data: { message: 'Your email is already verified.' } });
    }

    if (user.email_verification_expires && new Date(user.email_verification_expires).getTime() < Date.now()) {
      return res.status(400).json({
        success: false,
        error: { code: 'TOKEN_EXPIRED', message: 'This verification link has expired. Please request a new one.' },
      });
    }

    const { error: updateError } = await supabase
      .from('users')
      .update({ email_verified: true, email_verification_token: null, email_verification_code: null, email_verification_expires: null })
      .eq('id', user.id);

    if (updateError) throw updateError;

    return res.json({ success: true, data: { message: 'Email verified. You can now sign in.' } });
  } catch (error: any) {
    console.error('Verify email error:', error);
    return res.status(500).json({
      success: false,
      error: { code: 'VERIFY_EMAIL_FAILED', message: error.message },
    });
  }
};

export const verifyEmailCode = async (req: AuthRequest, res: Response) => {
  try {
    const rawEmail = req.body?.email;
    const rawCode = req.body?.code;
    const email = typeof rawEmail === 'string' ? rawEmail.trim().toLowerCase() : '';
    const code = typeof rawCode === 'string' ? rawCode.trim() : '';

    if (!email || !code) {
      return res.status(400).json({
        success: false,
        error: { code: 'MISSING_FIELDS', message: 'Email and code are required' },
      });
    }

    if (!supabase) {
      return res.status(503).json({
        success: false,
        error: { code: 'DB_UNAVAILABLE', message: 'Database is unavailable.' },
      });
    }

    const { data: user, error } = await supabase
      .from('users')
      .select('id, email_verified, email_verification_code, email_verification_expires')
      .eq('email', email)
      .single();

    if (error || !user) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_CODE', message: 'That code is incorrect or has expired.' },
      });
    }

    if (user.email_verified) {
      return res.json({ success: true, data: { message: 'Your email is already verified.' } });
    }

    if (!user.email_verification_code || user.email_verification_code !== code) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_CODE', message: 'That code is incorrect or has expired.' },
      });
    }

    if (user.email_verification_expires && new Date(user.email_verification_expires).getTime() < Date.now()) {
      return res.status(400).json({
        success: false,
        error: { code: 'CODE_EXPIRED', message: 'This code has expired. Please request a new one.' },
      });
    }

    const { error: updateError } = await supabase
      .from('users')
      .update({ email_verified: true, email_verification_token: null, email_verification_code: null, email_verification_expires: null })
      .eq('id', user.id);

    if (updateError) throw updateError;

    return res.json({ success: true, data: { message: 'Email verified. You can now sign in.' } });
  } catch (error: any) {
    console.error('Verify email code error:', error);
    return res.status(500).json({
      success: false,
      error: { code: 'VERIFY_CODE_FAILED', message: error.message },
    });
  }
};

export const resendVerification = async (req: AuthRequest, res: Response) => {
  try {
    const rawEmail = req.body?.email;
    const email = typeof rawEmail === 'string' ? rawEmail.trim().toLowerCase() : '';

    if (!email) {
      return res.status(400).json({
        success: false,
        error: { code: 'MISSING_EMAIL', message: 'Email is required' },
      });
    }

    if (!supabase) {
      return res.status(503).json({
        success: false,
        error: { code: 'DB_UNAVAILABLE', message: 'Database is unavailable.' },
      });
    }

    const { data: user, error } = await supabase
      .from('users')
      .select('id, full_name, email_verified')
      .eq('email', email)
      .single();

    // Respond with a generic success message even if the account doesn't exist, to avoid leaking which emails are registered.
    if (error || !user) {
      return res.json({ success: true, data: { message: 'If an account with that email exists, a verification email has been sent.' } });
    }

    if (user.email_verified) {
      return res.json({ success: true, data: { message: 'Your email is already verified. You can sign in.' } });
    }

    const { token, code, expiresAt } = createVerificationToken();
    const { error: updateError } = await supabase
      .from('users')
      .update({ email_verification_token: token, email_verification_code: code, email_verification_expires: expiresAt })
      .eq('id', user.id);

    if (updateError) throw updateError;

    await sendVerificationEmail(email, user.full_name, token, code);

    return res.json({ success: true, data: { message: 'Verification email sent. Please check your inbox.' } });
  } catch (error: any) {
    console.error('Resend verification error:', error);
    return res.status(500).json({
      success: false,
      error: { code: 'RESEND_VERIFICATION_FAILED', message: error.message },
    });
  }
};

export const forgotPassword = async (req: AuthRequest, res: Response) => {
  const genericMessage = 'If an account with that email exists, a password reset link has been sent.';

  try {
    const rawEmail = req.body?.email;
    const email = typeof rawEmail === 'string' ? rawEmail.trim().toLowerCase() : '';
    if (!email) {
      return res.status(400).json({ success: false, error: { code: 'MISSING_EMAIL', message: 'Email is required' } });
    }
    if (!supabase) {
      return res.status(503).json({ success: false, error: { code: 'DB_UNAVAILABLE', message: 'Database is unavailable.' } });
    }

    const { data: user, error } = await supabase
      .from('users')
      .select('id, email, full_name')
      .eq('email', email)
      .single();

    if (error || !user) return res.json({ success: true, data: { message: genericMessage } });

    const token = crypto.randomBytes(32).toString('hex');
    const code = crypto.randomInt(0, 1_000_000).toString().padStart(6, '0');
    const expiresAt = new Date(Date.now() + PASSWORD_RESET_TOKEN_TTL_MS).toISOString();
    const { error: updateError } = await supabase
      .from('users')
      .update({ password_reset_token: token, password_reset_code: code, password_reset_expires: expiresAt })
      .eq('id', user.id);
    if (updateError) throw updateError;

    await sendPasswordResetEmail(user.email, user.full_name, token, code);
    return res.json({ success: true, data: { message: genericMessage } });
  } catch (error: any) {
    console.error('Forgot password error:', error);
    if (error instanceof EmailServiceError) {
      return res.status(503).json({
        success: false,
        error: { code: 'EMAIL_SERVICE_UNAVAILABLE', message: 'Password reset email service is unavailable. Please contact the administrator.' },
      });
    }
    return res.status(500).json({ success: false, error: { code: 'FORGOT_PASSWORD_FAILED', message: 'Unable to process the password reset request.' } });
  }
};

export const resetPassword = async (req: AuthRequest, res: Response) => {
  try {
    const token = typeof req.body?.token === 'string' ? req.body.token.trim() : '';
    const code = typeof req.body?.code === 'string' ? req.body.code.trim() : '';
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    if ((!token && (!email || !code)) || !password) {
      return res.status(400).json({ success: false, error: { code: 'MISSING_FIELDS', message: 'Reset token and new password are required' } });
    }
    if (password.length < 6) {
      return res.status(400).json({ success: false, error: { code: 'WEAK_PASSWORD', message: 'Password must be at least 6 characters' } });
    }
    if (!supabase) {
      return res.status(503).json({ success: false, error: { code: 'DB_UNAVAILABLE', message: 'Database is unavailable.' } });
    }

    const { data: user, error } = await supabase
      .from('users')
      .select('id, password_reset_code, password_reset_expires')
      .eq(token ? 'password_reset_token' : 'email', token || email)
      .single();
    if (error || !user) {
      return res.status(400).json({ success: false, error: { code: 'INVALID_RESET_TOKEN', message: 'This reset link is invalid or has already been used.' } });
    }
    if (!user.password_reset_expires || new Date(user.password_reset_expires).getTime() < Date.now()) {
      return res.status(400).json({ success: false, error: { code: 'RESET_TOKEN_EXPIRED', message: 'This reset link has expired. Please request a new one.' } });
    }
    if (code && user.password_reset_code !== code) {
      return res.status(400).json({ success: false, error: { code: 'INVALID_RESET_CODE', message: 'That confirmation code is incorrect.' } });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const { error: updateError } = await supabase
      .from('users')
      .update({ password_hash: passwordHash, password_reset_token: null, password_reset_code: null, password_reset_expires: null })
      .eq('id', user.id);
    if (updateError) throw updateError;

    return res.json({ success: true, data: { message: 'Password reset successfully. You can now sign in.' } });
  } catch (error: any) {
    console.error('Reset password error:', error);
    return res.status(500).json({ success: false, error: { code: 'RESET_PASSWORD_FAILED', message: 'Unable to reset the password.' } });
  }
};
