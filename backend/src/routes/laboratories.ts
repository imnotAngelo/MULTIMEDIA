import express, { Router } from 'express';
import {
  getLaboratoryProgress,
  updatePhaseProgress,
  getPhaseProgressDetails,
  getLabStatistics,
  completeLaboratory,
} from '../controllers/laboratoryProgressController.js';
import { authMiddleware } from '../middleware/auth.js';

const router: Router = express.Router();

// Require authentication for all laboratory progress endpoints
router.use(authMiddleware);

// Get user's overall laboratory statistics (must come before :unitId routes)
router.get('/stats', getLabStatistics);

// Mark a laboratory as completed
router.post('/complete', completeLaboratory);

// Update phase progress (create or update)
router.post('/phase-progress', updatePhaseProgress);

// Get laboratory progress for a specific unit
router.get('/:unitId/progress', getLaboratoryProgress);

// Get detailed phase progress for a unit
router.get('/:unitId/phase-details', getPhaseProgressDetails);

export default router;
