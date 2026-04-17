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
} from '../controllers/assessmentController.js';

const router = Router();

// Instructor routes - get all assessments created by instructor (requires auth)
// MUST be defined before /:id route to avoid route collision
router.get('/instructor/all', authMiddleware, getInstructorAssessments);

// Student routes - get assessments (optional auth to show all public assessments)
router.get('/', optionalAuthMiddleware, getStudentAssessments);

// Get specific assessment (optional auth)
router.get('/:id', optionalAuthMiddleware, getAssessmentById);

// Create assessment (requires auth)
router.post('/', authMiddleware, createAssessment);

// Update assessment (requires auth)
router.put('/:id', authMiddleware, updateAssessment);

// Delete assessment (requires auth)
router.delete('/:id', authMiddleware, deleteAssessment);

// Submit assessment response (student, requires auth)
router.post('/:assessmentId/submit', authMiddleware, submitAssessmentResponse);

// Get submissions (instructor, requires auth)
router.get('/:assessmentId/submissions', authMiddleware, getAssessmentSubmissions);

// Grade submission (instructor, requires auth)
router.put('/:submissionId/grade', authMiddleware, gradeSubmission);

export default router;
