import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import {
  getProfile,
  updateProfile,
  getProgress,
  getAchievements,
  getLeaderboard,
} from '../controllers/userController.js';

const router = Router();

router.get('/profile', authMiddleware, getProfile);
router.put('/profile', authMiddleware, updateProfile);
router.get('/:id/progress', authMiddleware, getProgress);
router.get('/:id/achievements', authMiddleware, getAchievements);
router.get('/leaderboard', authMiddleware, getLeaderboard);

export default router;
