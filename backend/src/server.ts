import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import courseRoutes from './routes/courses.js';
import lessonRoutes from './routes/lessons.js';
import unitsRoutes from './routes/units.js';
import assessmentRoutes from './routes/assessments.js';
import laboratoryRoutes from './routes/laboratories.js';
import canvaSubmissionRoutes from './routes/canvaSubmissions.js';
import { errorHandler } from './middleware/auth.js';
import { supabase } from './config/supabase.js';

dotenv.config();

const app: Express = express();
const PORT = process.env.PORT || 3001;

// Middleware
// Allow localhost on any port for development, use FRONTEND_URL in production
const corsOrigin = process.env.FRONTEND_URL || (process.env.NODE_ENV === 'production' 
  ? 'http://localhost:5173' 
  : /^http:\/\/localhost:\d+$/);

app.use(cors({
  origin: corsOrigin,
  credentials: true,
}));

// Apply JSON parser everywhere EXCEPT multipart upload routes
// Skip for /api/lessons/upload-pdf so multer can handle multipart/form-data
app.use((req, res, next) => {
  // Skip JSON parsing for multipart form data uploads
  console.log(`🔍 [MIDDLEWARE_CHECK] Path: ${req.path}, Method: ${req.method}, Content-Type: ${req.headers['content-type']}`);
  if (req.path.includes('/upload-pdf') || req.path.includes('/upload')) {
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
app.use('/api/canva-submissions', canvaSubmissionRoutes);
console.log('✅ All routes registered');

// Health check
app.get('/api/health', (req: Request, res: Response) => {
  res.json({ success: true, message: 'Server is running' });
});

// 404 handler
app.use((req: Request, res: Response) => {
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
    
    // Start listening
    app.listen(PORT, () => {
      console.log(`Server is running on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

startServer();
