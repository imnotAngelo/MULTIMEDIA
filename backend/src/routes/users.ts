import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import {
  getProfile,
  updateProfile,
  getProgress,
  getAchievements,
  getLeaderboard,
  getStudents,
  getSubmissionStats,
  upsertLessonProgress,
  getMyLessonProgress,
  getLessonProgressStats,
} from '../controllers/userController.js';
import { supabase } from '../config/supabase.js';

const router = Router();

// Specific routes first (must be BEFORE parameterized :id routes)
router.get('/profile', authMiddleware, getProfile);
router.put('/profile', authMiddleware, updateProfile);
router.get('/students', authMiddleware, getStudents);
router.get('/submissions/stats', authMiddleware, getSubmissionStats);
router.get('/lesson-progress/me', authMiddleware, getMyLessonProgress);
router.get('/lesson-progress/stats', authMiddleware, getLessonProgressStats);
router.post('/lesson-progress', authMiddleware, upsertLessonProgress);
router.get('/leaderboard', authMiddleware, getLeaderboard);

// Migration check endpoint - verify if SQL migration has been executed
router.get('/debug/migration-status', authMiddleware, async (req: any, res) => {
  try {
    console.log(`🔍 MIGRATION CHECK: Verifying database schema...`);

    const migrationStatus: any = {
      timestamp: new Date().toISOString(),
      columns_exist: {},
      migration_complete: false,
    };

    // Check if year_level column exists in lessons
    const { data: lessonData, error: lessonError } = await supabase
      .from('lessons')
      .select('year_level')
      .limit(1);

    if (lessonError?.message.includes('column') || lessonError?.message.includes('does not exist')) {
      migrationStatus.columns_exist.lessons = false;
      migrationStatus.lessons_error = 'year_level column does not exist';
    } else {
      migrationStatus.columns_exist.lessons = true;
    }

    // Check if year_level column exists in assessments
    const { data: assessData, error: assessError } = await supabase
      .from('assessments')
      .select('year_level')
      .limit(1);

    if (assessError?.message.includes('column') || assessError?.message.includes('does not exist')) {
      migrationStatus.columns_exist.assessments = false;
      migrationStatus.assessments_error = 'year_level column does not exist';
    } else {
      migrationStatus.columns_exist.assessments = true;
    }

    // Check if year_level column exists in laboratories
    const { data: labData, error: labError } = await supabase
      .from('laboratories')
      .select('year_level')
      .limit(1);

    if (labError?.message.includes('column') || labError?.message.includes('does not exist')) {
      migrationStatus.columns_exist.laboratories = false;
      migrationStatus.laboratories_error = 'year_level column does not exist';
    } else {
      migrationStatus.columns_exist.laboratories = true;
    }

    // Migration is complete only if all columns exist
    migrationStatus.migration_complete = 
      migrationStatus.columns_exist.lessons &&
      migrationStatus.columns_exist.assessments &&
      migrationStatus.columns_exist.laboratories;

    if (migrationStatus.migration_complete) {
      console.log(`✅ MIGRATION STATUS: All columns exist! Archiving is optimized.`);
    } else {
      console.log(`⚠️  MIGRATION STATUS: Using fallback archiving (columns not found). Still works!`);
    }

    return res.json({
      success: true,
      migration_status: migrationStatus,
    });
  } catch (error: any) {
    console.error('Migration check error:', error);
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Diagnostic endpoint - check database state (must be BEFORE :id routes)
router.get('/debug/archive-state', authMiddleware, async (req: any, res) => {
  try {
    const userId = req.user?.id;
    const userYearLevel = req.user?.year_level;
    
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Not authenticated' });
    }

    console.log(`📊 DEBUG: Checking archive state for user ${userId} (current year_level=${userYearLevel})`);

    const diagnostics: any = {
      userId,
      userYearLevel,
      tables: {},
    };

    // Check lessons
    const { data: lessons, error: lessonsError } = await supabase
      .from('lessons')
      .select('id, title, year_level, status, module_id')
      .limit(5);

    diagnostics.tables.lessons = {
      error: lessonsError?.message || 'OK',
      count: lessons?.length || 0,
      sample: lessons?.slice(0, 3) || [],
    };

    // Check assessments  
    const { data: assessments, error: assessmentsError } = await supabase
      .from('assessments')
      .select('id, title, year_level, status, type, module_id')
      .limit(5);

    diagnostics.tables.assessments = {
      error: assessmentsError?.message || 'OK',
      count: assessments?.length || 0,
      sample: assessments?.slice(0, 3) || [],
    };

    // Check laboratories
    const { data: labs, error: labsError } = await supabase
      .from('laboratories')
      .select('id, year_level, status')
      .limit(5);

    diagnostics.tables.laboratories = {
      error: labsError?.message || 'OK',
      count: labs?.length || 0,
      sample: labs?.slice(0, 3) || [],
    };

    console.log('📊 DEBUG STATE:', JSON.stringify(diagnostics, null, 2));

    return res.json({
      success: true,
      diagnostics,
    });
  } catch (error: any) {
    console.error('Debug endpoint error:', error);
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Test archiving endpoint - manually archive all content
router.post('/debug/test-archive', authMiddleware, async (req: any, res) => {
  try {
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Not authenticated' });
    }

    console.log(`\n🧪 TEST ARCHIVE: Manual archiving for user ${userId}`);

    const results: any = {
      timestamp: new Date().toISOString(),
      steps: [],
    };

    // Get all unarchived modules
    console.log(`  📝 Step 1: Fetching unarchived modules...`);
    const { data: modules, error: modError } = await supabase
      .from('modules')
      .select('id, title')
      .neq('status', 'archived');

    console.log(`  ${modError ? '❌ ERROR' : '✅ OK'}: ${modules?.length || 0} modules found`);
    if (modError) console.log(`     Error: ${modError.message}`);
    results.steps.push({ name: 'Fetch modules', modules: modules?.length || 0, error: modError?.message });

    if (modules && modules.length > 0) {
      console.log(`  📝 Archiving ${modules.length} modules...`);
      const { error: archError } = await supabase
        .from('modules')
        .update({ status: 'archived' })
        .in('id', modules.map(m => m.id));
      
      console.log(`  ${archError ? '❌ ERROR' : '✅ Archived'}: ${modules.length} modules`);
      if (archError) console.log(`     Error: ${archError.message}`);
      results.steps.push({ name: 'Archive modules', count: modules.length, error: archError?.message });
    }

    // Get all unarchived lessons
    console.log(`  📝 Step 2: Fetching unarchived lessons...`);
    const { data: lessons, error: lessonError } = await supabase
      .from('lessons')
      .select('id, title')
      .neq('status', 'archived');

    console.log(`  ${lessonError ? '❌ ERROR' : '✅ OK'}: ${lessons?.length || 0} lessons found`);
    if (lessonError) console.log(`     Error: ${lessonError.message}`);
    results.steps.push({ name: 'Fetch lessons', lessons: lessons?.length || 0, error: lessonError?.message });

    if (lessons && lessons.length > 0) {
      console.log(`  📝 Archiving ${lessons.length} lessons...`);
      const { error: archError } = await supabase
        .from('lessons')
        .update({ status: 'archived' })
        .in('id', lessons.map(l => l.id));
      
      console.log(`  ${archError ? '❌ ERROR' : '✅ Archived'}: ${lessons.length} lessons`);
      if (archError) console.log(`     Error: ${archError.message}`);
      results.steps.push({ name: 'Archive lessons', count: lessons.length, error: archError?.message });
    }

    // Get all unarchived assessments
    console.log(`  📝 Step 3: Fetching unarchived assessments...`);
    const { data: assessments, error: assessError } = await supabase
      .from('assessments')
      .select('id, title')
      .neq('status', 'archived');

    console.log(`  ${assessError ? '❌ ERROR' : '✅ OK'}: ${assessments?.length || 0} assessments found`);
    if (assessError) console.log(`     Error: ${assessError.message}`);
    results.steps.push({ name: 'Fetch assessments', assessments: assessments?.length || 0, error: assessError?.message });

    if (assessments && assessments.length > 0) {
      console.log(`  📝 Archiving ${assessments.length} assessments...`);
      const { error: archError } = await supabase
        .from('assessments')
        .update({ status: 'archived' })
        .in('id', assessments.map(a => a.id));
      
      console.log(`  ${archError ? '❌ ERROR' : '✅ Archived'}: ${assessments.length} assessments`);
      if (archError) console.log(`     Error: ${archError.message}`);
      results.steps.push({ name: 'Archive assessments', count: assessments.length, error: archError?.message });
    }

    // Get all unarchived laboratories
    console.log(`  📝 Step 4: Fetching unarchived laboratories...`);
    const { data: labs, error: labError } = await supabase
      .from('laboratories')
      .select('id')
      .neq('status', 'archived');

    console.log(`  ${labError ? '❌ ERROR' : '✅ OK'}: ${labs?.length || 0} laboratories found`);
    if (labError) console.log(`     Error: ${labError.message}`);
    results.steps.push({ name: 'Fetch laboratories', laboratories: labs?.length || 0, error: labError?.message });

    if (labs && labs.length > 0) {
      console.log(`  📝 Archiving ${labs.length} laboratories...`);
      const { error: archError } = await supabase
        .from('laboratories')
        .update({ status: 'archived' })
        .in('id', labs.map(l => l.id));
      
      console.log(`  ${archError ? '❌ ERROR' : '✅ Archived'}: ${labs.length} laboratories`);
      if (archError) console.log(`     Error: ${archError.message}`);
      results.steps.push({ name: 'Archive laboratories', count: labs.length, error: archError?.message });
    }

    console.log(`✅ TEST ARCHIVE COMPLETE\n`);

    return res.json({
      success: true,
      message: 'Manual archive test completed - check backend logs',
      results,
    });
  } catch (error: any) {
    console.error('Test archive error:', error);
    return res.status(500).json({
      success: false,
      error: error.message,
      stack: error.stack,
    });
  }
});

// Parameterized routes (must be LAST)
router.get('/:id/progress', authMiddleware, getProgress);
router.get('/:id/achievements', authMiddleware, getAchievements);

export default router;
