import { Router } from 'express';
import { authMiddleware, optionalAuthMiddleware } from '../middleware/auth.js';
import {
  createAssessment,
  getStudentAssessments,
  getInstructorAssessments,
  getAssessmentById,
  updateAssessment,
  deleteAssessment,
  submitAssessmentResponse,
  getAssessmentSubmissions,
  gradeSubmission,
  getMyAssessmentSubmission,
} from '../controllers/assessmentController.js';

const router = Router();

// Instructor routes - get all assessments created by instructor (requires auth)
// MUST be defined before /:id route to avoid route collision
router.get('/instructor/all', authMiddleware, getInstructorAssessments);

router.get('/archived-results', authMiddleware, async (req: any, res: any) => {
  if (req.user?.role !== 'student') return res.status(403).json({ success: false, error: { message: 'Student role required' } });
  const { data, error } = await (await import('../config/supabase.js')).supabase
    .from('assessment_submissions')
    .select('id, assessment_id, score, status, submitted_at, assessment:assessment_id(title, status, archived_year_level)')
    .eq('user_id', req.user.id)
    .eq('assessment.status', 'archived')
    .order('submitted_at', { ascending: false });
  if (error) return res.status(500).json({ success: false, error: { message: error.message } });
  return res.json({ success: true, data: data || [] });
});

// Student routes - get assessments (optional auth to show all public assessments)
router.get('/', optionalAuthMiddleware, getStudentAssessments);

// Get specific assessment (optional auth)
router.get('/:assessmentId/my-submission', authMiddleware, getMyAssessmentSubmission);

// Get specific assessment (optional auth)
router.get('/:id', authMiddleware, getAssessmentById);

// Create assessment (requires auth)
router.post('/', authMiddleware, createAssessment);

// Update assessment (requires auth)
router.put('/:id', authMiddleware, updateAssessment);

// Restore an instructor-owned quiz from the archive.
router.patch('/:id/restore', authMiddleware, async (req: any, res: any) => {
  req.body = { status: 'published' };
  return updateAssessment(req, res);
});

// Delete assessment (requires auth)
router.delete('/:id', authMiddleware, deleteAssessment);

// Submit assessment response (student, requires auth)
router.post('/:assessmentId/submit', authMiddleware, submitAssessmentResponse);

// Get submissions (instructor, requires auth)
router.get('/:assessmentId/submissions', authMiddleware, getAssessmentSubmissions);

// Grade submission (instructor, requires auth)
router.put('/:submissionId/grade', authMiddleware, gradeSubmission);

export default router;
