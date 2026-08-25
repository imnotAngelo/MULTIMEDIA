import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import courseRoutes from './routes/courses.js';
import lessonRoutes from './routes/lessons.js';
import unitsRoutes from './routes/units.js';
import assessmentRoutes from './routes/assessments.js';
import laboratoryRoutes from './routes/laboratories.js';
import laboratorySubmissionRoutes from './routes/laboratorySubmissions.js';
import notificationRoutes from './routes/notifications.js';
import messageRoutes from './routes/messages.js';
import avatarRoutes from './routes/avatar.js';
import adminRoutes from './routes/admin.js';
import studentApprovalRoutes from './routes/studentApprovals.js';
import convertRoutes from './routes/convert.js';
import { errorHandler } from './middleware/auth.js';
import { supabase } from './config/supabase.js';

dotenv.config();

const app: Express = express();
const PORT = Number(process.env.PORT) || 3001;
const HOST = process.env.HOST || '0.0.0.0';

// =====================================================
// FORCE CORS - This will fix the "Failed to fetch" error
// =====================================================
app.use((req, res, next) => {
  const origin = req.headers.origin as string | undefined;

  // Always set CORS headers
  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else {
    res.setHeader('Access-Control-Allow-Origin', '*');
  }

  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader(
    'Access-Control-Allow-Methods',
    'GET, POST, PUT, PATCH, DELETE, OPTIONS'
  );
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization, X-Requested-With'
  );

  // Handle preflight request
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  next();
});

// Also keep the cors package as backup
app.use(
  cors({
    origin: true,
    credentials: true,
  })
);
// =====================================================

// Serve uploaded files statically
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

// Apply JSON parser everywhere EXCEPT multipart upload routes
app.use((req, res, next) => {
  if (
    req.path.includes('/upload-pdf') ||
    req.path.includes('/upload-file') ||
    req.path.includes('/upload')
  ) {
    return next();
  }
  express.json()(req, res, next);
});

// Debug middleware
app.use((req, res, next) => {
  console.log(`📡 ${new Date().toISOString()} ${req.method} ${req.path}`);
  next();
});

// Base /api route
app.get('/api', (req: Request, res: Response) => {
  res.json({
    success: true,
    message: 'Interactive Multimedia Learning System API',
    version: '1.0.0',
    endpoints: {
      health: '/api/health',
      auth: '/api/auth',
      users: '/api/users',
      courses: '/api/courses',
      lessons: '/api/lessons',
      units: '/api/units',
      assessments: '/api/assessments',
      laboratories: '/api/laboratories',
    },
  });
});

// Routes
console.log('🔧 Registering routes...');
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/courses', courseRoutes);
app.use('/api/lessons', lessonRoutes);
app.use('/api/units', unitsRoutes);
app.use('/api/assessments', assessmentRoutes);
app.use('/api/laboratories', laboratoryRoutes);
app.use('/api/laboratory-submissions', laboratorySubmissionRoutes);
app.use('/api/canva-submissions', laboratorySubmissionRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/users/avatar', avatarRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/instructor', studentApprovalRoutes);
app.use('/api/convert', convertRoutes);
console.log('✅ All routes registered');

// Health check
app.get('/api/health', (req: Request, res: Response) => {
  res.json({ success: true, message: 'Server is running' });
});

// 404 handler
app.use((req: Request, res: Response) => {
  console.log(`❌ 404: ${req.method} ${req.path}`);
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: 'Endpoint not found',
    },
  });
});

// Error handler
app.use(errorHandler);

// Start server
async function startServer() {
  try {
    console.log('🔄 Checking database...');
    try {
      const { error } = await supabase
        .from('laboratory_phase_progress')
        .select('id')
        .limit(1);

      if (!error) {
        console.log('✅ laboratory_phase_progress table exists');
      } else if (error.code === 'PGRST116') {
        console.warn('⚠️ laboratory_phase_progress table NOT FOUND');
      }
    } catch (dbError: any) {
      console.warn('⚠️ Could not verify table:', dbError.message);
    }

    app.listen(PORT, HOST, () => {
      console.log(`✅ Server is running on port ${PORT}`);
      console.log(`🌐 CORS is forced open for all origins`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

startServer();