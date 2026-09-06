import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import { supabase } from '../config/supabase.js';
import { v4 as uuidv4 } from 'uuid';
import { findUserById } from '../lib/userStore.js';
import { matchesContentTarget } from '../lib/contentTargeting.js';
import { listLocalLessonsByModuleId } from '../lib/lessonStore.js';

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
      setTimeout(() => reject(new Error('Supabase request timed out')), 10000);
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

    throw new Error('Authenticated user was not found in the content database');
  } catch (error: any) {
    console.error('❌ Could not verify authenticated user:', error.message);
    throw error;
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
    if (!userId) throw new Error('Authentication is required to create content');
    const instructorId = await ensureUserExistsInSupabase(userId);

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

async function requireOwnedUnit(unitId: string, instructorId: string) {
  const { data: unit, error } = await supabase
    .from('modules')
    .select('id, courses!inner(instructor_id)')
    .eq('id', unitId)
    .eq('courses.instructor_id', instructorId)
    .maybeSingle();
  if (error) throw error;
  return unit;
}

// Create a new unit (module)
export const createUnit = async (req: AuthRequest, res: Response) => {
  try {
    const userId = (req as any).user?.id; // Optional auth, may be undefined
    const { title, description, targetSections, targetYearLevels } = req.body;

    if (!title) {
      return res.status(400).json({
        success: false,
        error: { code: 'MISSING_FIELDS', message: 'Title is required' },
      });
    }

    const cleanedSections = Array.isArray(targetSections)
      ? [...new Set(targetSections.map((s: any) => String(s).trim()).filter(Boolean))]
      : [];
    const cleanedYearLevels = Array.isArray(targetYearLevels)
      ? [...new Set(targetYearLevels.map((y: any) => Number(y)).filter((y: number) => Number.isInteger(y) && y >= 1 && y <= 3))]
      : [];

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
          order_index: 0,
          status: 'active',
          target_sections: cleanedSections,
          target_year_levels: cleanedYearLevels,
        })
        .select('id, title, description, created_at, target_sections, target_year_levels')
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
          yearLevel: null,
          section: null,
          targetSections: unitFromDb.target_sections ?? [],
          targetYearLevels: unitFromDb.target_year_levels ?? [],
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
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');

    const unitsFromDb = await safeSupabaseCall(async () => {
      if (!supabase) {
        throw new Error('Supabase unavailable');
      }

      // Instructors only see modules from courses they own.
      let coursesQuery = supabase
        .from('courses')
        .select('id, instructor_id');
      if (req.user?.role === 'instructor') {
        coursesQuery = coursesQuery.eq('instructor_id', req.user.id);
      }
      const { data: courses, error: coursesError } = await coursesQuery;

      if (coursesError) throw coursesError;

      if (!courses || courses.length === 0) {
        return [] as Array<{ id: string; title: string; description: string; created_at: string; status?: string }>;
      }

      const courseIds = courses.map(c => c.id);

      const courseOwnerById: Record<string, any> = {};
      if (req.user?.role === 'student') {
        const instructorIds = [...new Set(courses.map((course) => course.instructor_id).filter(Boolean))];
        const { data: instructors, error: instructorsError } = instructorIds.length
          ? await supabase
            .from('users')
            .select('id, section, teaching_sections, teaching_year_levels')
            .in('id', instructorIds)
          : { data: [], error: null };
        if (instructorsError) throw instructorsError;
        const instructorById = Object.fromEntries((instructors ?? []).map((instructor: any) => [instructor.id, instructor]));
        for (const course of courses) courseOwnerById[course.id] = instructorById[course.instructor_id];
      }

      // Get all modules for those courses (both active and archived so we can separate them)
      const { data: units, error } = await supabase
        .from('modules')
        .select('id, course_id, title, description, created_at, status, target_sections, target_year_levels')
        .in('course_id', courseIds)
        .order('created_at', { ascending: false });

      if (error) throw error;

      return (units || []).map((unit: any) => {
        const owner = courseOwnerById[unit.course_id];
        return {
          ...unit,
          owner_sections: owner?.teaching_sections?.length ? owner.teaching_sections : (owner?.section ? [owner.section] : []),
          owner_year_levels: Array.isArray(owner?.teaching_year_levels) ? owner.teaching_year_levels : [],
        };
      }) as Array<{ id: string; title: string; description: string; created_at: string; status: string; target_sections: string[]; target_year_levels: number[]; owner_sections: string[]; owner_year_levels: number[] }>;
    }, null as any);

    if (unitsFromDb !== null) {
      console.log('📚 Units fetched from Supabase:', unitsFromDb.length);
      const requester = (req as any).user;
      if (!requester) {
        return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Login required' } });
      }
      
      // Separate active and archived units
      const activeUnits = unitsFromDb.filter(u => u.status !== 'archived');
      const archivedUnits = unitsFromDb.filter(u => u.status === 'archived');
      
      const visibleActiveUnits = requester?.role === 'student'
        ? activeUnits.filter((u) => matchesContentTarget(u.target_sections, u.target_year_levels, requester.section, requester.year_level)
          && u.owner_sections !== undefined
          && matchesContentTarget(u.owner_sections, u.owner_year_levels, requester.section, requester.year_level))
        : activeUnits;
      
      const visibleArchivedUnits = requester?.role === 'student'
        ? archivedUnits.filter((u) => matchesContentTarget(u.target_sections, u.target_year_levels, requester.section, requester.year_level)
          && u.owner_sections !== undefined
          && matchesContentTarget(u.owner_sections, u.owner_year_levels, requester.section, requester.year_level))
        : archivedUnits;

      return res.json({
        success: true,
        data: visibleActiveUnits.map((u) => ({
          id: u.id,
          title: u.title,
          description: u.description,
          lessonCount: 0, // Will be updated when fetching lessons
          createdAt: u.created_at,
          status: u.status,
          yearLevel: null,
          section: null,
          targetSections: u.target_sections ?? [],
          targetYearLevels: u.target_year_levels ?? [],
        })),
        archived: visibleArchivedUnits.map((u) => ({
          id: u.id,
          title: u.title,
          description: u.description,
          lessonCount: 0,
          createdAt: u.created_at,
          status: u.status,
          yearLevel: null,
          section: null,
          targetSections: u.target_sections ?? [],
          targetYearLevels: u.target_year_levels ?? [],
        })),
      });
    }

    return res.status(503).json({ success: false, error: { code: 'DB_UNAVAILABLE', message: 'Database is unavailable.' } });
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

    const requester = (req as any).user;
    if (!requester) {
      return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Login required' } });
    }
    const isValidUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(unitId);

    if (requester.role === 'instructor') {
      const { data: ownedUnit, error: ownershipError } = await supabase
        .from('modules')
        .select('id, courses!inner(instructor_id)')
        .eq('id', unitId)
        .eq('courses.instructor_id', requester.id)
        .maybeSingle();
      if (ownershipError) throw ownershipError;
      if (!ownedUnit) {
        return res.status(404).json({ success: false, error: { code: 'UNIT_NOT_FOUND', message: 'Unit not found' } });
      }
    }

    if (requester.role === 'student') {
      const { data: visibleUnit, error: visibilityError } = await supabase
        .from('modules')
        .select('id, course_id, target_sections, target_year_levels')
        .eq('id', unitId)
        .maybeSingle();
      if (visibilityError) throw visibilityError;
      if (!visibleUnit || !matchesContentTarget(visibleUnit.target_sections, visibleUnit.target_year_levels, requester.section, requester.year_level)) {
        return res.status(404).json({ success: false, error: { code: 'UNIT_NOT_FOUND', message: 'Unit not found' } });
      }
      const { data: course, error: courseError } = await supabase
        .from('courses')
        .select('instructor_id')
        .eq('id', visibleUnit.course_id)
        .maybeSingle();
      if (courseError) throw courseError;
      const { data: owner, error: ownerError } = course
        ? await supabase.from('users').select('section, teaching_sections, teaching_year_levels').eq('id', course.instructor_id).maybeSingle()
        : { data: null, error: null };
      if (ownerError) throw ownerError;
      const ownerSections = Array.isArray(owner?.teaching_sections) && owner.teaching_sections.length
        ? owner.teaching_sections
        : (owner?.section ? [owner.section] : []);
      const ownerYears = Array.isArray(owner?.teaching_year_levels) ? owner.teaching_year_levels : [];
      if (!course || !owner || !matchesContentTarget(ownerSections, ownerYears, requester.section, requester.year_level)) {
        return res.status(404).json({ success: false, error: { code: 'UNIT_NOT_FOUND', message: 'Unit not found' } });
      }
    }

    const localLessons = requester.role === 'student' ? [] : listLocalLessonsByModuleId(unitId).map((l) => ({
      id: l.id,
      title: l.title,
      content: l.content || '',
      slides: Array.isArray(l.slides) ? l.slides : [],
      slide_count: l.slideCount || 0,
      created_at: l.createdAt || new Date().toISOString(),
      target_sections: [],
      target_year_levels: [],
      status: l.status || 'published',
      pdf_url: l.pdfUrl || '',
      original_format: l.originalFormat || (l.pdfUrl ? 'pdf' : 'slides'),
      video_url: l.videoUrl || '',
      graphic_url: l.graphicUrl || '',
      pdfUrl: l.pdfUrl || '',
      originalFormat: l.originalFormat || (l.pdfUrl ? 'pdf' : 'slides'),
    }));

    let allDbLessons: any[] = [];
    if (isValidUuid) {
      allDbLessons = await safeSupabaseCall(async () => {
        if (!supabase) {
          throw new Error('Supabase unavailable');
        }

        const { data: lessons, error } = await supabase
          .from('lessons')
          .select('id, title, content, slides, slide_count, created_at, status, target_sections, target_year_levels, video_url, app_link, app_name, graphic_url, pdf_url, original_format')
          .eq('module_id', unitId)
          .order('created_at', { ascending: false });

        if (error) throw error;
        return lessons || [];
      }, [] as Array<any>);
    }

    // Combine local and DB lessons, then separate by status
    const allLessons = [...(allDbLessons || []), ...localLessons];
    
    // Filter based on role and visibility
    const filteredLessons = allLessons.filter((l: any) =>
      requester?.role === 'student'
        ? matchesContentTarget(l.target_sections, l.target_year_levels, requester.section, requester.year_level)
        : true
    );

    // Separate active and archived
    const activeLessons = filteredLessons.filter((l: any) => l.status !== 'archived');
    const archivedLessons = filteredLessons.filter((l: any) => l.status === 'archived');

    console.log(`📖 Lessons for unit ${unitId}: ${activeLessons.length} active, ${archivedLessons.length} archived`);

    return res.json({
      success: true,
      data: activeLessons.map((l: any) => {
        const mappedLesson = {
          id: l.id,
          title: l.title,
          content: l.content,
          slides: Array.isArray(l.slides) ? l.slides : (typeof l.slides === 'string' ? JSON.parse(l.slides) : []),
          slideCount: l.slide_count || l.slideCount || 0,
          createdAt: l.created_at || l.createdAt,
          status: l.status,
          unitId,
          pdfUrl: l.pdf_url || l.pdfUrl || '',
          originalFormat: l.original_format || l.originalFormat || (l.pdf_url || l.pdfUrl ? 'pdf' : 'slides'),
          video_url: l.video_url || '',
          app_link: l.app_link || '',
          app_name: l.app_name || '',
        };
        return mappedLesson;
      }),
      archived: archivedLessons.map((l: any) => {
        const mappedLesson = {
          id: l.id,
          title: l.title,
          content: l.content,
          slides: Array.isArray(l.slides) ? l.slides : (typeof l.slides === 'string' ? JSON.parse(l.slides) : []),
          slideCount: l.slide_count || l.slideCount || 0,
          createdAt: l.created_at || l.createdAt,
          status: l.status,
          unitId,
          pdfUrl: l.pdf_url || l.pdfUrl || '',
          originalFormat: l.original_format || l.originalFormat || (l.pdf_url || l.pdfUrl ? 'pdf' : 'slides'),
          video_url: l.video_url || '',
          app_link: l.app_link || '',
          app_name: l.app_name || '',
        };
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
    const { slides } = req.body;

    if (!lessonId || !Array.isArray(slides)) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_SLIDES', message: 'Lesson ID and a valid slides array are required' },
      });
    }

    const { data: lessonOwner, error: ownerError } = await supabase
      .from('lessons')
      .select('module_id')
      .eq('id', lessonId)
      .maybeSingle();
    if (ownerError) throw ownerError;
    if (!lessonOwner || !userId || !(await requireOwnedUnit(lessonOwner.module_id, userId))) {
      return res.status(404).json({ success: false, error: { code: 'LESSON_NOT_FOUND', message: 'Lesson not found' } });
    }

    const { data: lesson, error } = await supabase
      .from('lessons')
      .update({
        slides,
        slide_count: slides.length,
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

    if (!userId || !(await requireOwnedUnit(unitId, userId))) {
      return res.status(404).json({ success: false, error: { code: 'UNIT_NOT_FOUND', message: 'Unit not found' } });
    }

    console.log('📦 Archiving unit:', unitId);
    
    // Archive all lessons in this unit first
    console.log('  📝 Step 1: Archiving lessons in this unit...');
    const { error: lessonsError } = await supabase
      .from('lessons')
      .update({ status: 'archived' })
      .eq('module_id', unitId);

    if (lessonsError) {
      console.error('  ⚠️  WARNING: Could not archive lessons:', lessonsError.message);
    } else {
      console.log('  ✅ Lessons archived');
    }

    // Archive the unit instead of deleting it
    console.log('  📝 Step 2: Archiving the unit itself...');
    const { error } = await supabase
      .from('modules')
      .update({ status: 'archived' })
      .eq('id', unitId);

    if (error) throw error;

    console.log('✅ Unit and all its lessons archived successfully:', unitId);

    return res.json({
      success: true,
      message: 'Unit archived successfully',
    });
  } catch (error: any) {
    console.error('❌ Archive unit error:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'ARCHIVE_FAILED',
        message: error.message,
      },
    });
  }
};

// Unarchive a unit (module) - restore to active + all lessons inside
export const unarchiveUnit = async (req: AuthRequest, res: Response) => {
  try {
    const { unitId } = req.params;

    if (!unitId) {
      return res.status(400).json({
        success: false,
        error: { code: 'MISSING_ID', message: 'Unit ID is required' },
      });
    }

    if (!req.user?.id || !(await requireOwnedUnit(unitId, req.user.id))) {
      return res.status(404).json({ success: false, error: { code: 'UNIT_NOT_FOUND', message: 'Unit not found' } });
    }

    console.log('♻️ Unarchiving unit:', unitId);
    console.log('  📝 Step 1: Restoring the unit itself...');

    // Step 1: Restore the unit
    const { data: unit, error: unitError } = await supabase
      .from('modules')
      .update({ status: 'active' })
      .eq('id', unitId)
      .select()
      .single();

    if (unitError) throw unitError;
    console.log('  ✅ Unit restored:', unitId);

    // Step 2: Get all archived lessons in this unit
    console.log('  📝 Step 2: Finding archived lessons in this unit...');
    const { data: archivedLessons, error: lessonsError } = await supabase
      .from('lessons')
      .select('id, title')
      .eq('module_id', unitId)
      .eq('status', 'archived');

    if (lessonsError) {
      console.error('  ⚠️  WARNING: Could not fetch archived lessons:', lessonsError.message);
    } else {
      const lessonCount = archivedLessons?.length || 0;
      console.log(`  ✅ Found ${lessonCount} archived lessons`);

      // Step 3: Restore all archived lessons
      if (lessonCount > 0) {
        console.log('  📝 Step 3: Restoring lessons...');
        const lessonIds = archivedLessons!.map(l => l.id);
        
        const { error: restoreError } = await supabase
          .from('lessons')
          .update({ status: 'active' })
          .in('id', lessonIds);

        if (restoreError) {
          console.error('  ⚠️  WARNING: Could not restore lessons:', restoreError.message);
        } else {
          console.log(`  ✅ Restored ${lessonCount} lessons with their videos`);
        }
      }
    }

    console.log('✅ Unit and all its content unarchived successfully');

    return res.json({
      success: true,
      message: 'Unit and all its lessons restored successfully',
      data: {
        unit,
        restoredLessonCount: archivedLessons?.length || 0,
      },
    });
  } catch (error: any) {
    console.error('❌ Unarchive unit error:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'UNARCHIVE_FAILED',
        message: error.message,
      },
    });
  }
};

// Unarchive a lesson - restore to active (with video)
export const unarchiveLesson = async (req: AuthRequest, res: Response) => {
  try {
    const { lessonId } = req.params;

    if (!lessonId) {
      return res.status(400).json({
        success: false,
        error: { code: 'MISSING_ID', message: 'Lesson ID is required' },
      });
    }

    console.log('♻️ Unarchiving lesson:', lessonId);
    console.log('  📝 Restoring lesson with video and all content...');

    const { data: lesson, error } = await supabase
      .from('lessons')
      .update({ status: 'active' })
      .eq('id', lessonId)
      .select('id, title, module_id, status, video_url, app_link, app_name, created_at')
      .single();

    if (error) throw error;

    console.log('✅ Lesson unarchived:', lessonId);
    if (lesson?.video_url) {
      console.log('  ✅ Video preserved:', lesson.video_url.substring(0, 80) + '...');
    }

    return res.json({
      success: true,
      message: 'Lesson restored successfully with all content',
      data: lesson,
    });
  } catch (error: any) {
    console.error('❌ Unarchive lesson error:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'UNARCHIVE_FAILED',
        message: error.message,
      },
    });
  }
};

// Update lesson metadata (video URL, app link, app name)
export const updateLessonMetadata = async (req: AuthRequest, res: Response) => {
  try {
    const { lessonId } = req.params;
    const { video_url, app_link, app_name } = req.body;

    if (!lessonId) {
      return res.status(400).json({
        success: false,
        error: { code: 'MISSING_ID', message: 'Lesson ID is required' },
      });
    }

    console.log('📝 Updating lesson metadata:', { lessonId, video_url, app_link, app_name });

    // Build update object with only provided fields
    const updateData: any = {};
    if (video_url !== undefined) updateData.video_url = video_url || null;
    if (app_link !== undefined) updateData.app_link = app_link || null;
    if (app_name !== undefined) updateData.app_name = app_name || null;

    const { data: lesson, error } = await supabase
      .from('lessons')
      .update(updateData)
      .eq('id', lessonId)
      .select('id, title, video_url, app_link, app_name')
      .single();

    if (error) throw error;

    console.log('✅ Lesson metadata updated:', lesson);

    return res.json({
      success: true,
      message: 'Lesson metadata updated successfully',
      data: lesson,
    });
  } catch (error: any) {
    console.error('❌ Update lesson metadata error:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'UPDATE_FAILED',
        message: error.message,
      },
    });
  }
};


