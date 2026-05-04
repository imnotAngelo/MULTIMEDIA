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

const router = Router();

router.get('/profile', authMiddleware, getProfile);
router.put('/profile', authMiddleware, updateProfile);
router.get('/students', authMiddleware, getStudents);
router.get('/submissions/stats', authMiddleware, getSubmissionStats);
router.post('/lesson-progress', authMiddleware, upsertLessonProgress);
router.get('/lesson-progress/me', authMiddleware, getMyLessonProgress);
router.get('/lesson-progress/stats', authMiddleware, getLessonProgressStats);
router.get('/:id/progress', authMiddleware, getProgress);
router.get('/:id/achievements', authMiddleware, getAchievements);
router.get('/leaderboard', authMiddleware, getLeaderboard);

export default router;
