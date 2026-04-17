import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import { supabase } from '../config/supabase.js';
import { v4 as uuidv4 } from 'uuid';

// Use a consistent default instructor ID for unauthenticated requests (proper UUID)
const DEFAULT_INSTRUCTOR_ID = '12345678-1234-4234-8234-123456789012';

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

    if (!title) {
      return res.status(400).json({
        success: false,
        error: { code: 'MISSING_FIELDS', message: 'Title is required' },
      });
    }

    console.log('📝 Creating unit:', { title, description, userId: userId || 'anonymous' });

    const courseId = await getOrCreateDefaultCourse(userId);
    console.log('💾 Using course:', courseId);

    // Create module (unit)
    const unitId = uuidv4();
    const { data: unit, error } = await supabase
      .from('modules')
      .insert({
        id: unitId,
        course_id: courseId,
        title,
        description: description || '',
        order_index: 0,
        status: 'active',
      })
      .select('id, title, description, created_at')
      .single();

    if (error) throw error;

    console.log('✅ Unit created:', unit);

    return res.status(201).json({
      success: true,
      data: {
        id: unit.id,
        title: unit.title,
        description: unit.description,
        createdAt: unit.created_at,
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
    // Get all courses to find all modules
    const { data: courses, error: coursesError } = await supabase
      .from('courses')
      .select('id')
      .eq('status', 'published');

    if (coursesError) throw coursesError;

    if (!courses || courses.length === 0) {
      return res.json({
        success: true,
        data: [],
      });
    }

    const courseIds = courses.map(c => c.id);

    // Get all modules for those courses
    const { data: units, error } = await supabase
      .from('modules')
      .select('id, title, description, created_at')
      .in('course_id', courseIds)
      .eq('status', 'active')
      .order('created_at', { ascending: false });

    if (error) throw error;

    console.log('📚 Units fetched:', units?.length || 0);

    return res.json({
      success: true,
      data: (units || []).map(u => ({
        id: u.id,
        title: u.title,
        description: u.description,
        lessonCount: 0, // Will be updated when fetching lessons
        createdAt: u.created_at,
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

    const { data: lessons, error } = await supabase
      .from('lessons')
      .select('id, title, content, slides, slide_count, created_at, status')
      .eq('module_id', unitId)
      .eq('status', 'published')
      .order('created_at', { ascending: false });

    if (error) throw error;

    console.log(`📖 Lessons for unit ${unitId}:`, lessons?.length || 0);
    if (lessons && lessons.length > 0) {
      console.log('📊 First lesson data:', JSON.stringify(lessons[0], null, 2));
    }

    return res.json({
      success: true,
      data: (lessons || []).map(l => {
        const mappedLesson = {
          id: l.id,
          title: l.title,
          content: l.content,
          slides: Array.isArray(l.slides) ? l.slides : (typeof l.slides === 'string' ? JSON.parse(l.slides) : []),
          slideCount: l.slide_count || 0,
          createdAt: l.created_at,
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
