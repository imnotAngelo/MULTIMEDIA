import { Router } from 'express';
import { register, login, refresh, logout, verifyEmail, verifyEmailCode, resendVerification } from '../controllers/authController.js';

const router = Router();

router.post('/register', register);
router.post('/login', login);
router.post('/refresh', refresh);
router.post('/logout', logout);
router.get('/verify-email', verifyEmail);
router.post('/verify-email', verifyEmail);
router.post('/verify-email-code', verifyEmailCode);
router.post('/resend-verification', resendVerification);

export default router;
