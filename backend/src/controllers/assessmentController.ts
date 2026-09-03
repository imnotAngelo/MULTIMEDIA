import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import { supabase } from '../config/supabase.js';
import { v4 as uuidv4 } from 'uuid';
import { findUserById } from '../lib/userStore.js';
import { matchesContentTarget } from '../lib/contentTargeting.js';
import { scoreAssessmentSubmission } from '../lib/assessmentScoring.js';

const DEFAULT_INSTRUCTOR_ID = '12345678-1234-4234-8234-123456789012';

async function resolveAssessmentUser(user: { id: string; email: string }) {
  const { data: byId, error: idError } = await supabase
    .from('users')
    .select('id, email, role')
    .eq('id', user.id)
    .maybeSingle();
  if (idError) throw idError;
  if (byId) return byId;

  const { data: byEmail, error: emailError } = await supabase
    .from('users')
    .select('id, email, role')
    .eq('email', user.email)
    .maybeSingle();
  if (emailError) throw emailError;
  if (byEmail) return byEmail;

  const localUser = findUserById(user.id);
  if (!localUser) return null;

  const { data: syncedUser, error: syncError } = await supabase
    .from('users')
    .insert({
      id: localUser.id,
      email: localUser.email,
      full_name: localUser.full_name,
      role: localUser.role,
      xp_total: localUser.xp_total || 0,
      streak_days: localUser.streak_days || 0,
    })
    .select('id, email, role')
    .single();
  if (syncError && syncError.code !== '23505') throw syncError;
  return syncedUser || { id: localUser.id, email: localUser.email, role: localUser.role };
}

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
    return await operation();
  } catch (error: any) {
    throw error;
  }
}

async function getOrCreateDefaultInstructor(): Promise<string> {
  const { data: existingUser, error: fetchError } = await supabase
    .from('users')
    .select('id')
    .eq('id', DEFAULT_INSTRUCTOR_ID)
    .single();

  if (existingUser) {
    return DEFAULT_INSTRUCTOR_ID;
  }

  if (fetchError && fetchError.code !== 'PGRST116') {
    throw fetchError;
  }

  const { error: insertError } = await supabase
    .from('users')
    .insert({
      id: DEFAULT_INSTRUCTOR_ID,
      email: 'instructor@quicklearn.local',
      full_name: 'Quick Learn Instructor',
      role: 'instructor',
      xp_total: 0,
      streak_days: 0,
    });

  if (insertError && insertError.code !== '23505') {
    throw insertError;
  }

  return DEFAULT_INSTRUCTOR_ID;
}

// Ensure the course owner exists in the same database as the course.
async function resolveCourseInstructor(userId?: string): Promise<string> {
  if (!userId) {
    return getOrCreateDefaultInstructor();
  }

  const { data: existingUser, error: fetchError } = await supabase
    .from('users')
    .select('id')
    .eq('id', userId)
    .single();

  if (existingUser) {
    return userId;
  }

  if (fetchError && fetchError.code !== 'PGRST116') {
    throw fetchError;
  }

  throw new Error('Authenticated user was not found in the content database');
}

// Get or create default course
async function getOrCreateDefaultCourse(userId?: string) {
  try {
    const instructorId = await resolveCourseInstructor(userId);

    const { data: courses } = await supabase
      .from('courses')
      .select('id')
      .eq('instructor_id', instructorId)
      .eq('title', 'Quick Learn - Default Course');

    if (courses && courses.length > 0) {
      return courses[0].id;
    }

    const { data: newCourse, error } = await supabase
      .from('courses')
      .insert({
        id: uuidv4(),
        instructor_id: instructorId,
        title: 'Quick Learn - Default Course',
        description: 'Default course for assessments',
        status: 'published',
      })
      .select('id')
      .single();

    if (error) throw error;
    return newCourse?.id;
  } catch (error) {
    console.error('Error getting/creating course:', error);
    throw error;
  }
}

// Get or create default module
async function getOrCreateDefaultModule(courseId: string) {
  try {
    const { data: modules } = await supabase
      .from('modules')
      .select('id')
      .eq('course_id', courseId)
      .eq('title', 'Assessments Module');

    if (modules && modules.length > 0) {
      return modules[0].id;
    }

    const { data: newModule, error } = await supabase
      .from('modules')
      .insert({
        id: uuidv4(),
        course_id: courseId,
        title: 'Assessments Module',
        description: 'Module for course assessments',
        order_index: 0,
        status: 'active',
      })
      .select('id')
      .single();

    if (error) throw error;
    return newModule?.id;
  } catch (error) {
    console.error('Error getting/creating module:', error);
    throw error;
  }
}

// Create a new assessment (Instructor)
export const createAssessment = async (req: AuthRequest, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    
    console.log('📝 createAssessment called - userId:', userId);
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
      });
    }
    if ((req as any).user?.role !== 'instructor') {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Only instructors can create assessments' },
      });
    }

    const { 
      title, 
      description, 
      type, 
      dueDate, 
      allowLateSubmissions = false,
      totalPoints, 
      unitId,
      questions,
      timeLimit,
      shuffleQuestions,
      showCorrectAnswers,
      allowDuplicate = false,
      targetSections,
      targetYearLevels,
    } = req.body;

    console.log('📝 Fields - title:', title, 'type:', type, 'questions:', Array.isArray(questions) ? questions.length + ' items' : typeof questions);

    if (!title || !type) {
      return res.status(400).json({
        success: false,
        error: { code: 'MISSING_FIELDS', message: 'Title and type are required' },
      });
    }

    const instructorId = await resolveCourseInstructor(userId);
    const courseId = await getOrCreateDefaultCourse(instructorId);
    let moduleId = unitId;

    if (!moduleId) {
      moduleId = await getOrCreateDefaultModule(courseId);
    } else {
      const { data: ownedModule, error: moduleError } = await supabase
        .from('modules')
        .select('id, courses!inner(instructor_id)')
        .eq('id', moduleId)
        .eq('courses.instructor_id', userId)
        .maybeSingle();
      if (moduleError) throw moduleError;
      if (!ownedModule) {
        return res.status(404).json({ success: false, error: { code: 'UNIT_NOT_FOUND', message: 'Unit not found' } });
      }
    }

    if (type === 'quiz' && !allowDuplicate) {
      const { data: existingQuiz, error: duplicateCheckError } = await supabase
        .from('assessments')
        .select('id, title')
        .eq('module_id', moduleId)
        .eq('type', 'quiz')
        .limit(1)
        .maybeSingle();

      if (duplicateCheckError) {
        throw duplicateCheckError;
      }

      if (existingQuiz) {
        return res.status(409).json({
          success: false,
          error: {
            code: 'QUIZ_ALREADY_EXISTS',
            message: `A quiz already exists for this lesson: "${existingQuiz.title}".`,
            existingQuiz,
          },
        });
      }
    }

    const assessmentId = uuidv4();
    
    // Ensure questions_data is properly formatted
    let questionsData = questions || null;
    if (questionsData && !Array.isArray(questionsData)) {
      questionsData = [questionsData];
    }
    
    console.log('📝 questionsData to save:', questionsData ? (Array.isArray(questionsData) ? questionsData.length + ' questions' : 'non-array') : 'null');

    const cleanedTargetSections = Array.isArray(targetSections)
      ? [...new Set(targetSections.map((s: any) => String(s).trim()).filter(Boolean))]
      : [];
    const cleanedTargetYearLevels = Array.isArray(targetYearLevels)
      ? [...new Set(targetYearLevels.map((y: any) => Number(y)).filter((y: number) => Number.isInteger(y) && y >= 1 && y <= 3))]
      : [];

    const creatorYearLevel = (req as any).user?.year_level || 1;
    const insertPayload = {
      id: assessmentId,
      created_by: instructorId,
      title,
      description: description || '',
      type,
      due_date: dueDate || null,
      allow_late_submissions: allowLateSubmissions === true,
      total_points: totalPoints || 100,
      module_id: moduleId,
      status: 'published',
      questions_data: questionsData,
      time_limit: timeLimit || null,
      shuffle_questions: shuffleQuestions || false,
      show_correct_answers: showCorrectAnswers || false,
      target_sections: cleanedTargetSections,
      target_year_levels: cleanedTargetYearLevels,
      year_level: creatorYearLevel,
    };

    const createResult = await safeSupabaseCall(
      async () => {
        const { data: assessment, error } = await supabase
          .from('assessments')
          .insert(insertPayload)
          .select('*')
          .single();

        if (error) {
          console.error('📝 Insert error:', error);
          throw error;
        }

        return assessment;
      },
      null as any
    );

    if (!createResult) {
      return res.status(503).json({
        success: false,
        error: {
          code: 'DB_UNAVAILABLE',
          message: 'Assessment could not be saved because Supabase is unavailable.',
        },
      });
    }

    const assessment = createResult;

    console.log('📝 Created assessment:', assessment?.id, '- questions_data:', assessment?.questions_data ? 'present' : 'null');

    return res.status(201).json({
      success: true,
      data: assessment,
    });
  } catch (error: any) {
    console.error('Create assessment error:', error);
    return res.status(500).json({
      success: false,
      error: { code: 'CREATE_FAILED', message: error.message },
    });
  }
};

// Get all assessments (Student - returns all published assessments)
export const getStudentAssessments = async (req: AuthRequest, res: Response) => {
  try {
    const requestUser = (req as any).user;
    const resolvedUser = requestUser ? await resolveAssessmentUser(requestUser) : null;
    const userId = resolvedUser?.id;
    const { filter, unitId, page = 1, limit = 50 } = req.query;

    console.log('📋 getStudentAssessments - userId:', userId, 'filter:', filter);

    const pageNum = parseInt(page as string) || 1;
    const limitNum = Math.min(parseInt(limit as string) || 50, 100);
    const offset = (pageNum - 1) * limitNum;

    try {
      // Simple query first - avoid complex joins that can fail
      let query = supabase
        .from('assessments')
        .select(
          `
          id,
          title,
          description,
          type,
          status,
          due_date,
          total_points,
          time_limit,
          shuffle_questions,
          show_correct_answers,
          questions_data,
          created_at,
          created_by,
          module_id,
          target_sections,
          target_year_levels
        `,
          { count: 'exact' }
        )
        .eq('status', 'published');

      if (filter && filter !== 'all') {
        query = query.eq('type', filter);
      }

      if (unitId) {
        query = query.eq('module_id', unitId);
      }

      const { data: assessments, count, error } = await query
        .order('created_at', { ascending: false })
        .range(offset, offset + limitNum - 1);

      console.log('📋 Query result - error:', error?.message || 'none', '- count:', assessments?.length || 0);

      if (error) {
        console.error('📋 Supabase query error:', error);
        if (isSupabaseTransientError(error)) {
          throw error;
        }
      }

      let ownerById: Record<string, any> = {};
      if (requestUser?.role === 'student') {
        const ownerIds = [...new Set((assessments || []).map((assessment: any) => assessment.created_by).filter(Boolean))];
        if (ownerIds.length > 0) {
          const { data: owners, error: ownersError } = await supabase
            .from('users')
            .select('id, section, teaching_sections, teaching_year_levels')
            .in('id', ownerIds);
          if (ownersError) throw ownersError;
          ownerById = Object.fromEntries((owners || []).map((owner: any) => [owner.id, owner]));
        }
      }

      const transformedAssessments = (assessments || [])
        .filter((assessment: any) =>
          requestUser?.role === 'student'
            ? (() => {
              const owner = ownerById[assessment.created_by];
              const ownerSections = owner?.teaching_sections?.length ? owner.teaching_sections : (owner?.section ? [owner.section] : []);
              const ownerYears = Array.isArray(owner?.teaching_year_levels) ? owner.teaching_year_levels : [];
              return !!owner && matchesContentTarget(assessment.target_sections, assessment.target_year_levels, requestUser.section, requestUser.year_level)
                && matchesContentTarget(ownerSections, ownerYears, requestUser.section, requestUser.year_level);
            })()
            : true
        )
        .map((assessment: any) => ({
          ...assessment,
        }));

      const submissionsByAssessment = new Map<string, any>();
      if (userId && transformedAssessments.length > 0) {
        const { data: submissions, error: submissionsError } = await supabase
          .from('assessment_submissions')
          .select('id, assessment_id, score, status, submitted_at')
          .eq('user_id', userId)
          .in('assessment_id', transformedAssessments.map((assessment: any) => assessment.id))
          .order('submitted_at', { ascending: false });

        if (submissionsError) throw submissionsError;
        for (const submission of submissions || []) {
          if (!submissionsByAssessment.has(submission.assessment_id)) {
            submissionsByAssessment.set(submission.assessment_id, submission);
          }
        }
      }

      const assessmentsWithProgress = transformedAssessments.map((assessment: any) => {
        const submission = submissionsByAssessment.get(assessment.id);
        return {
          ...assessment,
          completed: Boolean(submission),
          submission: submission || null,
        };
      });

      console.log('📋 Returning', transformedAssessments.length, 'assessments');

      return res.json({
        success: true,
        data: assessmentsWithProgress,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total: count || 0,
          total_pages: Math.ceil((count || 0) / limitNum),
        },
      });
    } catch (error: any) {
      throw error;
    }
  } catch (error: any) {
    console.error('Get student assessments error:', error);
    return res.status(500).json({
      success: false,
      error: { code: 'FETCH_FAILED', message: error.message },
    });
  }
};

// Get all assessments (Instructor - returns created assessments)
export const getInstructorAssessments = async (req: AuthRequest, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
      });
    }

    const instructorId = await resolveCourseInstructor(userId);
    const { filter, page = 1, limit = 10 } = req.query;

    const pageNum = parseInt(page as string) || 1;
    const limitNum = Math.min(parseInt(limit as string) || 10, 50);
    const offset = (pageNum - 1) * limitNum;

    try {
      let query = supabase
        .from('assessments')
        .select(
          `
          *,
          module:module_id(title),
          _count:assessment_submissions(count)
        `,
          { count: 'exact' }
        )
        .eq('created_by', instructorId)
        .eq('status', 'published');

      if (filter && filter !== 'all') {
        query = query.eq('type', filter);
      }

      const { data: assessments, count, error } = await query
        .order('created_at', { ascending: false })
        .range(offset, offset + limitNum - 1);

      if (error) throw error;

      // Get submission counts for each assessment
      const enrichedAssessments = await Promise.all(
        (assessments || []).map(async (assessment: any) => {
          const { count: totalSubmissions } = await supabase
            .from('assessment_submissions')
            .select('id', { count: 'exact' })
            .eq('assessment_id', assessment.id);

          const { count: gradedSubmissions } = await supabase
            .from('assessment_submissions')
            .select('id', { count: 'exact' })
            .eq('assessment_id', assessment.id)
            .neq('score', null);

          return {
            ...assessment,
            unitName: assessment.module?.title || 'Uncategorized',
            submissions: totalSubmissions || 0,
            graded: gradedSubmissions || 0,
          };
        })
      );

      return res.json({
        success: true,
        data: enrichedAssessments,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total: count || 0,
          total_pages: Math.ceil((count || 0) / limitNum),
        },
      });
    } catch (error: any) {
      throw error;
    }
  } catch (error: any) {
    console.error('Get instructor assessments error:', error);
    return res.status(500).json({
      success: false,
      error: { code: 'FETCH_FAILED', message: error.message },
    });
  }
};

// Get assessment by ID
export const getMyAssessmentSubmission = async (req: AuthRequest, res: Response) => {
  try {
    const requestUser = (req as any).user;
    const resolvedUser = requestUser ? await resolveAssessmentUser(requestUser) : null;
    const userId = resolvedUser?.id;
    const { assessmentId } = req.params;
    if (!userId) {
      return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } });
    }

    const { data: submission, error } = await supabase
      .from('assessment_submissions')
      .select('id, assessment_id, answers, score, status, submitted_at')
      .eq('assessment_id', assessmentId)
      .eq('user_id', userId)
      .order('submitted_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    return res.json({ success: true, data: submission || null });
  } catch (error: any) {
    console.error('Get student submission error:', error);
    return res.status(500).json({ success: false, error: { code: 'SUBMISSION_FETCH_FAILED', message: error.message } });
  }
};

export const getAssessmentById = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    console.log('📋 Fetching assessment:', id);

    try {
      const { data: assessment, error } = await supabase
        .from('assessments')
        .select(
          `
          id,
          title,
          description,
          type,
          status,
          due_date,
          total_points,
          time_limit,
          shuffle_questions,
          show_correct_answers,
          questions_data,
          created_at,
          created_by,
          module_id,
          target_sections,
          target_year_levels,
          instructor:created_by(id, full_name),
          submissions:assessment_submissions(*)
        `
        )
        .eq('id', id)
        .single();

      if (error || !assessment) {
        console.error('❌ Assessment not found:', error);
        return res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Assessment not found' },
        });
      }

      const requester = (req as any).user;
      if (requester?.role === 'student') {
        const { data: owner } = await supabase
          .from('users')
          .select('section, teaching_sections, teaching_year_levels')
          .eq('id', assessment.created_by)
          .maybeSingle();
        const ownerSections = owner?.teaching_sections?.length ? owner.teaching_sections : (owner?.section ? [owner.section] : []);
        const ownerYears = Array.isArray(owner?.teaching_year_levels) ? owner.teaching_year_levels : [];
        if (!owner || assessment.status !== 'published'
          || !matchesContentTarget(assessment.target_sections, assessment.target_year_levels, requester.section, requester.year_level)
          || !matchesContentTarget(ownerSections, ownerYears, requester.section, requester.year_level)) {
          return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Assessment not found' } });
        }
        assessment.submissions = (assessment.submissions || []).filter((submission: any) => submission.user_id === requester.id);
      } else if (!requester) {
        return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Login required' } });
      } else if (requester.role === 'instructor' && assessment.created_by !== requester.id) {
        return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Assessment not found' } });
      }

      console.log('📝 Assessment data retrieved:');
      console.log('  - ID:', assessment.id);
      console.log('  - Title:', assessment.title);
      console.log('  - Type:', assessment.type);
      console.log('  - Has questions_data?:', 'questions_data' in assessment);
      console.log('  - questions_data value:', assessment.questions_data);
      console.log('  - questions_data type:', typeof assessment.questions_data);
      console.log('  - questions_data is array?:', Array.isArray(assessment.questions_data));
      if (Array.isArray(assessment.questions_data)) {
        console.log('  - questions_data length:', assessment.questions_data.length);
      }

      return res.json({
        success: true,
        data: assessment,
      });
    } catch (error: any) {
      console.error('Get assessment error:', error);
      return res.status(500).json({
        success: false,
        error: { code: 'FETCH_FAILED', message: error.message },
      });
    }
  } catch (error: any) {
    console.error('Get assessment error:', error);
    return res.status(500).json({
      success: false,
      error: { code: 'FETCH_FAILED', message: error.message },
    });
  }
};

// Update assessment
export const updateAssessment = async (req: AuthRequest, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
      });
    }

    const { id } = req.params;
    const updates = req.body;

    // Check authorization
    const { data: assessment } = await supabase
      .from('assessments')
      .select('created_by')
      .eq('id', id)
      .single();

    if (!assessment || assessment.created_by !== userId) {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Not authorized to update this assessment' },
      });
    }

    const { data: updated, error } = await supabase
      .from('assessments')
      .update(updates)
      .eq('id', id)
      .select('*')
      .single();

    if (error) throw error;

    return res.json({
      success: true,
      data: updated,
    });
  } catch (error: any) {
    console.error('Update assessment error:', error);
    return res.status(500).json({
      success: false,
      error: { code: 'UPDATE_FAILED', message: error.message },
    });
  }
};

// Delete assessment
export const deleteAssessment = async (req: AuthRequest, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
      });
    }

    const { id } = req.params;

    // Check authorization
    const { data: assessment } = await supabase
      .from('assessments')
      .select('created_by')
      .eq('id', id)
      .single();

    if (!assessment || assessment.created_by !== userId) {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Not authorized to delete this assessment' },
      });
    }

    const { error } = await supabase.from('assessments').delete().eq('id', id);

    if (error) throw error;

    return res.json({
      success: true,
      message: 'Assessment deleted successfully',
    });
  } catch (error: any) {
    console.error('Delete assessment error:', error);
    return res.status(500).json({
      success: false,
      error: { code: 'DELETE_FAILED', message: error.message },
    });
  }
};

// Submit assessment response
export const submitAssessmentResponse = async (req: AuthRequest, res: Response) => {
  try {
    const requestUser = (req as any).user;
    const resolvedUser = requestUser ? await resolveAssessmentUser(requestUser) : null;
    const userId = resolvedUser?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
      });
    }

    const { assessmentId } = req.params;
    const { answers } = req.body;

    if (requestUser?.role !== 'student') {
      return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Only students can submit assessments' } });
    }

    const { data: assessment, error: assessmentError } = await supabase
      .from('assessments')
      .select('id, questions_data, due_date, allow_late_submissions, status, target_sections, target_year_levels')
      .eq('id', assessmentId)
      .single();

    if (assessmentError || !assessment) {
      return res.status(404).json({
        success: false,
        error: { code: 'ASSESSMENT_NOT_FOUND', message: 'Quiz not found' },
      });
    }

    if (assessment.status !== 'published' || !matchesContentTarget(
      assessment.target_sections,
      assessment.target_year_levels,
      requestUser.section,
      requestUser.year_level
    )) {
      return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'This assessment is not assigned to your section and year level' } });
    }

    if (assessment.due_date && new Date(assessment.due_date).getTime() <= Date.now() && !assessment.allow_late_submissions) {
      return res.status(403).json({
        success: false,
        error: { code: 'ASSESSMENT_LOCKED', message: 'This quiz is closed because its due date has passed.' },
      });
    }

    const submittedAnswers = Array.isArray(answers)
      ? answers
      : Object.entries(answers || {}).map(([questionId, answer]) => ({ questionId, answer }));
    const questions = Array.isArray(assessment.questions_data) ? assessment.questions_data : [];
    const { score: calculatedScore, results: gradingResults, earnedPoints, possiblePoints } = scoreAssessmentSubmission(
      questions,
      submittedAnswers
    );

    const earnedPointsValue = earnedPoints;

    const { data: existingSubmission, error: existingSubmissionError } = await supabase
      .from('assessment_submissions')
      .select('id, assessment_id, answers, score, status, submitted_at')
      .eq('assessment_id', assessmentId)
      .eq('user_id', userId)
      .maybeSingle();

    if (existingSubmissionError) throw existingSubmissionError;
    if (existingSubmission) {
      return res.status(200).json({
        success: true,
        data: existingSubmission,
        score: existingSubmission.score,
        results: gradingResults,
        alreadySubmitted: true,
      });
    }

    const submissionId = uuidv4();
    const submissionPayload = {
        id: submissionId,
        assessment_id: assessmentId,
        user_id: userId,
        answers: answers || {},
        score: calculatedScore,
        possible_points: possiblePoints,
        earned_points: earnedPointsValue,
        status: 'submitted',
        submitted_at: new Date().toISOString(),
    };
    let { data: submissionRows, error } = await supabase
      .from('assessment_submissions')
      .upsert(submissionPayload, { onConflict: 'assessment_id,user_id', ignoreDuplicates: true })
      .select('*')
      .limit(1);

    if (error && /earned_points|possible_points|schema cache|column .* does not exist/i.test(error.message || '')) {
      const legacyPayload = { ...submissionPayload } as Record<string, any>;
      delete legacyPayload.earned_points;
      delete legacyPayload.possible_points;
      const legacyResult = await supabase
        .from('assessment_submissions')
        .upsert(legacyPayload, { onConflict: 'assessment_id,user_id', ignoreDuplicates: true })
        .select('*')
        .limit(1);
      submissionRows = legacyResult.data;
      error = legacyResult.error;
    }

    if (error) throw error;

    let submission = submissionRows?.[0];
    if (!submission) {
      const { data: savedSubmission, error: savedSubmissionError } = await supabase
        .from('assessment_submissions')
        .select('*')
        .eq('assessment_id', assessmentId)
        .eq('user_id', userId)
        .single();
      if (savedSubmissionError) throw savedSubmissionError;
      submission = savedSubmission;
    }

    return res.status(201).json({
      success: true,
      data: submission,
      score: calculatedScore,
      results: gradingResults,
    });
  } catch (error: any) {
    console.error('Submit assessment error:', error);
    return res.status(500).json({
      success: false,
      error: { code: 'SUBMIT_FAILED', message: error.message },
    });
  }
};

// Get assessment submissions
export const getAssessmentSubmissions = async (req: AuthRequest, res: Response) => {
  try {
    const requestUser = (req as any).user;
    const resolvedUser = requestUser ? await resolveAssessmentUser(requestUser) : null;
    const userId = resolvedUser?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
      });
    }

    const { assessmentId } = req.params;

    // Verify instructor owns this assessment
    const { data: assessment } = await supabase
      .from('assessments')
      .select('created_by')
      .eq('id', assessmentId)
      .single();

    if (!assessment || assessment.created_by !== userId) {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Not authorized to view submissions' },
      });
    }

    const { data: submissions, error } = await supabase
      .from('assessment_submissions')
      .select(
        `
        *,
        student:user_id(id, full_name, email)
      `
      )
      .eq('assessment_id', assessmentId)
      .order('submitted_at', { ascending: false });

    if (error) throw error;

    return res.json({
      success: true,
      data: submissions,
    });
  } catch (error: any) {
    console.error('Get submissions error:', error);
    return res.status(500).json({
      success: false,
      error: { code: 'FETCH_FAILED', message: error.message },
    });
  }
};

// Grade submission
export const gradeSubmission = async (req: AuthRequest, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
      });
    }

    const { submissionId } = req.params;
    const { score, feedback } = req.body;

    // Verify authorization
    const { data: submission } = await supabase
      .from('assessment_submissions')
      .select('assessment_id')
      .eq('id', submissionId)
      .single();

    if (!submission) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Submission not found' },
      });
    }

    const { data: assessment } = await supabase
      .from('assessments')
      .select('created_by')
      .eq('id', submission.assessment_id)
      .single();

    if (!assessment || assessment.created_by !== userId) {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Not authorized to grade' },
      });
    }

    const { data: graded, error } = await supabase
      .from('assessment_submissions')
      .update({
        score,
        feedback: feedback || '',
        status: 'graded',
      })
      .eq('id', submissionId)
      .select('*')
      .single();

    if (error) throw error;

    return res.json({
      success: true,
      data: graded,
    });
  } catch (error: any) {
    console.error('Grade submission error:', error);
    return res.status(500).json({
      success: false,
      error: { code: 'GRADE_FAILED', message: error.message },
    });
  }
};
