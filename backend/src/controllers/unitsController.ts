import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import { supabase } from '../config/supabase.js';
import { v4 as uuidv4 } from 'uuid';
import { listLocalUnits } from '../lib/unitStore.js';
import { listLocalLessonsByModuleId } from '../lib/lessonStore.js';
import { findUserById } from '../lib/userStore.js';

// Use a consistent default instructor ID for unauthenticated requests (proper UUID)
const DEFAULT_INSTRUCTOR_ID = '12345678-1234-4234-8234-123456789012';

function isSupabaseTransientError(error: any): boolean {
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
  ].some((fragment) => message.includes(fragment));
}

async function safeSupabaseCall<T>(operation: () => Promise<T>, fallback: T): Promise<T> {
  try {
    if (!supabase) {
      throw new Error('Supabase unavailable');
    }
    const timeout = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Supabase request timed out')), 3000);
    });
    return await Promise.race([operation(), timeout]);
  } catch (error: any) {
    if (isSupabaseTransientError(error)) {
      return fallback;
    }
    throw error;
  }
}

// Verify a user ID exists in Supabase's users table; sync it from the local
// auth store if we know about it locally, otherwise fall back to the default instructor.
async function ensureUserExistsInSupabase(userId: string): Promise<string> {
  try {
    const { data: existingUser, error } = await supabase
      .from('users')
      .select('id')
      .eq('id', userId)
      .single();

    if (existingUser) {
      return userId;
    }

    if (error && error.code !== 'PGRST116') throw error;

    const localUser = findUserById(userId);
    if (localUser) {
      console.warn('⚠️ Syncing locally-known user into Supabase before creating course:', userId);
      const { error: insertError } = await supabase
        .from('users')
        .insert({
          id: localUser.id,
          email: localUser.email,
          full_name: localUser.full_name,
          role: localUser.role,
          xp_total: localUser.xp_total || 0,
          streak_days: localUser.streak_days || 0,
        });

      if (!insertError) {
        return userId;
      }
      console.warn('⚠️ Could not sync local user into Supabase, falling back to default instructor:', insertError.message);
    } else {
      console.warn('⚠️ Authenticated user not found in Supabase or local store, falling back to default instructor:', userId);
    }

    return getOrCreateDefaultInstructor();
  } catch (error: any) {
    console.warn('⚠️ Error verifying user in Supabase, falling back to default instructor:', error.message);
    return getOrCreateDefaultInstructor();
  }
}

// Get or create default instructor user
async function getOrCreateDefaultInstructor() {
  try {
    console.log('👤 Checking for default instructor...');
    
    // Try to get existing default instructor
    const { data: user, error: fetchError } = await supabase
      .from('users')
      .select('id')
      .eq('id', DEFAULT_INSTRUCTOR_ID)
      .single();

    if (user) {
      console.log('✅ Found existing default instructor');
      return DEFAULT_INSTRUCTOR_ID;
    }

    // Create default instructor if doesn't exist
    if (fetchError?.code === 'PGRST116') {
      console.log('📝 Creating default instructor user...');
      
      const { data: newUser, error: createError } = await supabase
        .from('users')
        .insert({
          id: DEFAULT_INSTRUCTOR_ID,
          email: 'instructor@quicklearn.local',
          full_name: 'Quick Learn Instructor',
          role: 'instructor',
          xp_total: 0,
          streak_days: 0,
        })
        .select('id')
        .single();

      if (createError) {
        // User might already exist, that's ok
        console.log('ℹ️ Could not create instructor (may already exist):', createError.message);
      } else {
        console.log('✅ Created default instructor');
      }
      
      return DEFAULT_INSTRUCTOR_ID;
    }

    if (fetchError) throw fetchError;
    return DEFAULT_INSTRUCTOR_ID;
  } catch (error) {
    console.error('❌ Error getting/creating default instructor:', error);
    throw error;
  }
}

// Get or create default course for units
async function getOrCreateDefaultCourse(userId?: string) {
  try {
    let instructorId = userId;

    // If no user ID provided, use/create default instructor
    if (!instructorId) {
      instructorId = await getOrCreateDefaultInstructor();
    } else {
      // The JWT may reference a user created under a previous/different Supabase
      // project. Verify the user actually exists here (or sync it from the local
      // auth store) before using it as a foreign key, otherwise fall back.
      instructorId = await ensureUserExistsInSupabase(instructorId);
    }

    console.log('📚 Getting/creating course for instructor:', instructorId);
    
    // Try to get existing default course
    const { data: courses, error: fetchError } = await supabase
      .from('courses')
      .select('id')
      .eq('instructor_id', instructorId)
      .eq('title', 'Quick Learn - Default Course');

    if (courses && courses.length > 0) {
      console.log('✅ Found existing course:', courses[0].id);
      return courses[0].id;
    }

    console.log('📝 Creating new default course...');
    
    // Create new default course
    const { data: newCourse, error: createError } = await supabase
      .from('courses')
      .insert({
        id: uuidv4(),
        instructor_id: instructorId,
        title: 'Quick Learn - Default Course',
        description: 'Default course for storing units and lessons',
        status: 'published',
      })
      .select('id')
      .single();

    if (createError) throw createError;
    console.log('✅ Created new course:', newCourse.id);
    return newCourse.id;
  } catch (error) {
    console.error('❌ Error getting/creating default course:', error);
    throw error;
  }
}

// Create a new unit (module)
export const createUnit = async (req: AuthRequest, res: Response) => {
  try {
    const userId = (req as any).user?.id; // Optional auth, may be undefined
    const { title, description } = req.body;
    const yearLevel = req.user?.year_level;
    const section = req.user?.section;

    if (!title) {
      return res.status(400).json({
        success: false,
        error: { code: 'MISSING_FIELDS', message: 'Title is required' },
      });
    }

    console.log('📝 Creating unit:', { title, description, userId: userId || 'anonymous' });

    const unitId = uuidv4();

    const unitFromDb = await safeSupabaseCall(async () => {
      const courseId = await getOrCreateDefaultCourse(userId);
      console.log('💾 Using course:', courseId);

      const { data: unit, error } = await supabase
        .from('modules')
        .insert({
          id: unitId,
          course_id: courseId,
          title,
          description: description || '',
          year_level: yearLevel || null,
          section: section || null,
          order_index: 0,
          status: 'active',
        })
        .select('id, title, description, year_level, section, created_at')
        .single();

      if (error) throw error;
      return unit;
    }, null as any);

    if (unitFromDb) {
      console.log('✅ Unit created:', unitFromDb);
      return res.status(201).json({
        success: true,
        data: {
          id: unitFromDb.id,
          title: unitFromDb.title,
          description: unitFromDb.description,
          yearLevel: unitFromDb.year_level,
          section: unitFromDb.section,
          createdAt: unitFromDb.created_at,
        },
      });
    }

    return res.status(503).json({
      success: false,
      error: {
        code: 'DB_UNAVAILABLE',
        message: 'Unit could not be saved because Supabase is unavailable.',
      },
    });
  } catch (error: any) {
    console.error('❌ Create unit error:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'CREATE_FAILED',
        message: error.message,
      },
    });
  }
};

// Get all units (modules)
export const getUnits = async (req: AuthRequest, res: Response) => {
  try {
    const localUnits = listLocalUnits();

    const unitsFromDb = await safeSupabaseCall(async () => {
      if (!supabase) {
        throw new Error('Supabase unavailable');
      }

      // Get all courses to find all modules
      const { data: courses, error: coursesError } = await supabase
        .from('courses')
        .select('id')
        .eq('status', 'published');

      if (coursesError) throw coursesError;

      if (!courses || courses.length === 0) {
        return [] as Array<{ id: string; title: string; description: string; created_at: string }>;
      }

      const courseIds = courses.map(c => c.id);

      // Get all modules for those courses
      const { data: units, error } = await supabase
        .from('modules')
        .select('id, title, description, year_level, section, created_at')
        .in('course_id', courseIds)
        .eq('status', 'active')
        .order('created_at', { ascending: false });

      if (error) throw error;

      return (units || []) as Array<{ id: string; title: string; description: string; created_at: string }>;
    }, null as any);

    // `unitsFromDb` is `null` only when Supabase was unreachable/errored (see safeSupabaseCall).
    // A successful call that legitimately found zero units returns `[]`, which must NOT fall back to stale local data.
    if (unitsFromDb !== null) {
      console.log('📚 Units fetched from Supabase:', unitsFromDb.length);
      return res.json({
        success: true,
        data: unitsFromDb.map((u) => ({
          id: u.id,
          title: u.title,
          description: u.description,
          lessonCount: 0, // Will be updated when fetching lessons
          createdAt: u.created_at,
          yearLevel: u.year_level,
          section: u.section,
        })),
      });
    }

    console.warn('⚠️ Supabase unreachable, falling back to local units store');
    return res.json({
      success: true,
      data: localUnits.map((u) => ({
        id: u.id,
        title: u.title,
        description: u.description,
        lessonCount: 0,
        createdAt: u.createdAt,
        yearLevel: u.yearLevel,
        section: u.section,
      })),
    });
  } catch (error: any) {
    console.error('❌ Get units error:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'FETCH_FAILED',
        message: error.message,
      },
    });
  }
};

// Get lessons for a unit
export const getUnitLessons = async (req: AuthRequest, res: Response) => {
  try {
    const { unitId } = req.params;

    if (!unitId) {
      return res.status(400).json({
        success: false,
        error: { code: 'MISSING_ID', message: 'Unit ID is required' },
      });
    }

    const localLessons = listLocalLessonsByModuleId(unitId);
    if (localLessons.length > 0) {
      return res.json({
        success: true,
        data: localLessons.map((lesson: any) => ({
          id: lesson.id,
          title: lesson.title,
          content: lesson.content,
          slides: lesson.slides || [],
          slideCount: lesson.slide_count || lesson.slideCount || 0,
          createdAt: lesson.created_at || lesson.createdAt,
          unitId,
        })),
      });
    }

    const lessonsFromDb = await safeSupabaseCall(async () => {
      if (!supabase) {
        throw new Error('Supabase unavailable');
      }

      const { data: lessons, error } = await supabase
        .from('lessons')
        .select('id, title, content, slides, slide_count, created_at, status')
        .eq('module_id', unitId)
        .eq('status', 'published')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return lessons || [];
    }, [] as Array<any>);

    const allLessons = [...(lessonsFromDb || []), ...localLessons];

    console.log(`📖 Lessons for unit ${unitId}:`, allLessons.length);
    if (allLessons.length > 0) {
      console.log('📊 First lesson data:', JSON.stringify(allLessons[0], null, 2));
    }

    return res.json({
      success: true,
      data: allLessons.map((l: any) => {
        const mappedLesson = {
          id: l.id,
          title: l.title,
          content: l.content,
          slides: Array.isArray(l.slides) ? l.slides : (typeof l.slides === 'string' ? JSON.parse(l.slides) : []),
          slideCount: l.slide_count || l.slideCount || 0,
          createdAt: l.created_at || l.createdAt,
          unitId,
        };
        console.log('📝 Mapped lesson:', { id: mappedLesson.id, title: mappedLesson.title, slidesCount: mappedLesson.slides.length });
        return mappedLesson;
      }),
    });
  } catch (error: any) {
    console.error('❌ Get unit lessons error:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'FETCH_FAILED',
        message: error.message,
      },
    });
  }
};

// Update lesson with slides (used by upload-pdf endpoint)
export const updateLessonSlides = async (req: AuthRequest, res: Response) => {
  try {
    // Optional auth
    const userId = (req as any).user?.id;
    const { lessonId } = req.params;
    const { slides, slideCount } = req.body;

    if (!lessonId || !slides) {
      return res.status(400).json({
        success: false,
        error: { code: 'MISSING_FIELDS', message: 'Lesson ID and slides are required' },
      });
    }

    const { data: lesson, error } = await supabase
      .from('lessons')
      .update({
        slides,
        slide_count: slideCount || slides.length,
      })
      .eq('id', lessonId)
      .select('id, title, slides, slide_count')
      .single();

    if (error) throw error;

    console.log('✅ Lesson slides updated:', lessonId);

    return res.json({
      success: true,
      data: lesson,
    });
  } catch (error: any) {
    console.error('❌ Update lesson slides error:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'UPDATE_FAILED',
        message: error.message,
      },
    });
  }
};

// Delete a unit
export const deleteUnit = async (req: AuthRequest, res: Response) => {
  try {
    // Optional auth - continue even without user
    const userId = (req as any).user?.id;
    const { unitId } = req.params;

    if (!unitId) {
      return res.status(400).json({
        success: false,
        error: { code: 'MISSING_ID', message: 'Unit ID is required' },
      });
    }

    // Delete all lessons in this unit first
    await supabase
      .from('lessons')
      .delete()
      .eq('module_id', unitId);

    // Delete the unit
    const { error } = await supabase
      .from('modules')
      .delete()
      .eq('id', unitId);

    if (error) throw error;

    console.log('✅ Unit deleted:', unitId);

    return res.json({
      success: true,
      message: 'Unit deleted successfully',
    });
  } catch (error: any) {
    console.error('❌ Delete unit error:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'DELETE_FAILED',
        message: error.message,
      },
    });
  }
};
