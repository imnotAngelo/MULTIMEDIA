import { Router } from 'express';
import { register, login, refresh, logout, listPendingInstructors, approveInstructor, rejectInstructor } from '../controllers/authController.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

router.post('/register', register);
router.post('/login', login);
router.post('/refresh', refresh);
router.post('/logout', logout);
router.get('/admin/pending-instructors', authMiddleware, listPendingInstructors);
router.post('/admin/pending-instructors/:id/approve', authMiddleware, approveInstructor);
router.post('/admin/pending-instructors/:id/reject', authMiddleware, rejectInstructor);

export default router;
