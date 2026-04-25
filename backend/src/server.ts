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
import { errorHandler } from './middleware/auth.js';
import { supabase } from './config/supabase.js';

dotenv.config();

const app: Express = express();
const PORT = Number(process.env.PORT) || 3001;
/** Bind address: 0.0.0.0 for Render/Docker; override with HOST=127.0.0.1 if needed */
const HOST = process.env.HOST || '0.0.0.0';

function isLocalDevOrigin(origin: string): boolean {
  return /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
}

function parseAllowedOrigins(): Set<string> {
  const raw =
    process.env.ALLOWED_ORIGINS?.trim() ||
    process.env.FRONTEND_URL?.trim() ||
    '';
  if (!raw) return new Set();
  return new Set(
    raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
  );
}

// CORS: comma-separated FRONTEND_URL or ALLOWED_ORIGINS; in non-production, localhost is always allowed
const allowedOrigins = parseAllowedOrigins();

const corsOriginResolver = (
  origin: string | undefined,
  callback: (err: Error | null, allow?: boolean) => void
) => {
  if (!origin) {
    callback(null, true);
    return;
  }
  if (allowedOrigins.has(origin)) {
    callback(null, true);
    return;
  }
  if (process.env.NODE_ENV !== 'production' && isLocalDevOrigin(origin)) {
    callback(null, true);
    return;
  }
  callback(null, false);
};

app.use(
  cors({
    origin: corsOriginResolver,
    credentials: true,
  })
);

// Serve uploaded files statically (images/videos submitted by students)
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

// Apply JSON parser everywhere EXCEPT multipart upload routes
app.use((req, res, next) => {
  console.log(`🔍 [MIDDLEWARE_CHECK] Path: ${req.path}, Method: ${req.method}, Content-Type: ${req.headers['content-type']}`);
  if (
    req.path.includes('/upload-pdf') ||
    req.path.includes('/upload-file') ||
    req.path.includes('/upload')
  ) {
    console.log(`✅ [SKIP_JSON] Skipping JSON parsing for upload route`);
    return next();
  }
  console.log(`📝 [APPLY_JSON] Applying JSON middleware`);
  express.json()(req, res, next);
});

// Debug middleware - log all requests BEFORE routes
app.use((req, res, next) => {
  console.log(`📡 ${new Date().toISOString()} ${req.method} ${req.path}`);
  next();
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
// Laboratory submissions (new canonical path)
app.use('/api/laboratory-submissions', laboratorySubmissionRoutes);
// Backward-compatible alias (old Canva path)
app.use('/api/canva-submissions', laboratorySubmissionRoutes);
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
    // Verify table exists (optional check)
    console.log('🔄 Checking database...');
    try {
      const { data, error } = await supabase
        .from('laboratory_phase_progress')
        .select('id')
        .limit(1);
      
      if (!error) {
        console.log('✅ laboratory_phase_progress table exists');
      } else if (error.code === 'PGRST116') {
        console.warn('⚠️ laboratory_phase_progress table NOT FOUND');
        console.warn('\n📝 TO CREATE THE TABLE:');
        console.warn('1. Get your Supabase database password from:');
        console.warn('   https://app.supabase.com/project/ciopmrwvmgqsbapyljih/settings/database');
        console.warn('2. Add to .env: SUPABASE_DB_PASSWORD=<your_password>');
        console.warn('3. Run: npm run setup');
        console.warn('\n⚠️ Progress saving will not work until table is created');
      }
    } catch (dbError: any) {
      console.warn('⚠️ Could not verify table:', dbError.message);
    }
    
    app.listen(PORT, HOST, () => {
      const where = HOST === '0.0.0.0' ? 'all interfaces' : HOST;
      console.log(`Server is running on port ${PORT} (${where})`);
      if (HOST === '0.0.0.0') {
        console.log(`  Local: http://127.0.0.1:${PORT}  http://localhost:${PORT}`);
      }
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

startServer();
