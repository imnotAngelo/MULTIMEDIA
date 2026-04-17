import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { getCourses, getCourseById, getLessons } from '../controllers/courseController.js';

const router = Router();

router.get('/', getCourses);
router.get('/:id', authMiddleware, getCourseById);
router.get('/:id/lessons', authMiddleware, getLessons);

export default router;
