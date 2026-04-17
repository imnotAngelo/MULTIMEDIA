import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import { supabase } from '../config/supabase.js';
import { v4 as uuidv4 } from 'uuid';

// Get or create default course
async function getOrCreateDefaultCourse(userId?: string) {
  try {
    const DEFAULT_INSTRUCTOR_ID = '12345678-1234-4234-8234-123456789012';
    let instructorId = userId || DEFAULT_INSTRUCTOR_ID;

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

    const { 
      title, 
      description, 
      type, 
      dueDate, 
      totalPoints, 
      unitId,
      questions,
      timeLimit,
      shuffleQuestions,
      showCorrectAnswers
    } = req.body;

    console.log('📝 Fields - title:', title, 'type:', type, 'questions:', Array.isArray(questions) ? questions.length + ' items' : typeof questions);

    if (!title || !type) {
      return res.status(400).json({
        success: false,
        error: { code: 'MISSING_FIELDS', message: 'Title and type are required' },
      });
    }

    const courseId = await getOrCreateDefaultCourse(userId);
    let moduleId = unitId;

    if (!moduleId) {
      moduleId = await getOrCreateDefaultModule(courseId);
    }

    const assessmentId = uuidv4();
    
    // Ensure questions_data is properly formatted
    let questionsData = questions || null;
    if (questionsData && !Array.isArray(questionsData)) {
      questionsData = [questionsData];
    }
    
    console.log('📝 questionsData to save:', questionsData ? (Array.isArray(questionsData) ? questionsData.length + ' questions' : 'non-array') : 'null');

    const insertPayload = {
      id: assessmentId,
      created_by: userId,
      title,
      description: description || '',
      type,
      due_date: dueDate || null,
      total_points: totalPoints || 100,
      module_id: moduleId,
      status: 'published',
      questions_data: questionsData,
      time_limit: timeLimit || null,
      shuffle_questions: shuffleQuestions || false,
      show_correct_answers: showCorrectAnswers || false,
    };

    const { data: assessment, error } = await supabase
      .from('assessments')
      .insert(insertPayload)
      .select('*')
      .single();

    if (error) {
      console.error('📝 Insert error:', error);
      throw error;
    }

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
    const userId = (req as any).user?.id;
    const { filter, unitId, page = 1, limit = 50 } = req.query;

    console.log('📋 getStudentAssessments - userId:', userId, 'filter:', filter);

    const pageNum = parseInt(page as string) || 1;
    const limitNum = Math.min(parseInt(limit as string) || 50, 100);
    const offset = (pageNum - 1) * limitNum;

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
        module_id
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
      throw error;
    }

    const transformedAssessments = (assessments || []).map((assessment: any) => ({
      ...assessment,
    }));

    console.log('📋 Returning', transformedAssessments.length, 'assessments');

    return res.json({
      success: true,
      data: transformedAssessments,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: count || 0,
        total_pages: Math.ceil((count || 0) / limitNum),
      },
    });
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

    const { filter, page = 1, limit = 10 } = req.query;

    const pageNum = parseInt(page as string) || 1;
    const limitNum = Math.min(parseInt(limit as string) || 10, 50);
    const offset = (pageNum - 1) * limitNum;

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
      .eq('created_by', userId);

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
        const { count: totalSubmissions, error: submissionError } = await supabase
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
    console.error('Get instructor assessments error:', error);
    return res.status(500).json({
      success: false,
      error: { code: 'FETCH_FAILED', message: error.message },
    });
  }
};

// Get assessment by ID
export const getAssessmentById = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    console.log('📋 Fetching assessment:', id);

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
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
      });
    }

    const { assessmentId } = req.params;
    const { answers, score } = req.body;

    const submissionId = uuidv4();
    const { data: submission, error } = await supabase
      .from('assessment_submissions')
      .insert({
        id: submissionId,
        assessment_id: assessmentId,
        user_id: userId,
        answers: answers || {},
        score: score || null,
        status: 'submitted',
        submitted_at: new Date().toISOString(),
      })
      .select('*')
      .single();

    if (error) throw error;

    return res.status(201).json({
      success: true,
      data: submission,
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
    const userId = (req as any).user?.id;
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
