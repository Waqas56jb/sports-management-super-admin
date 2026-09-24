import { Router } from 'express';
import * as c from '../controllers/reportController.js';
import * as coachController from '../controllers/coachController.js';
import * as playerController from '../controllers/playerController.js';
import { requireAuth } from '../middleware/auth.js';
import { requirePermission, requireRole } from '../middleware/roles.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler as h } from '../utils/asyncHandler.js';
import { reportQuery } from '../validators/attendanceValidators.js';

const r = Router();

r.get('/reports/:type', requireAuth, requirePermission('reports:read'), validate({ query: reportQuery }), h(c.generate));

/** Global search — results depend on the caller's role and teams. */
r.get('/search', requireAuth, (req, res, next) => {
  const handler = req.actor.role === 'player' ? playerController.search : coachController.search;
  return h(handler)(req, res, next);
});
r.get('/admin/search', requireAuth, requireRole('admin'), h(coachController.search));

export default r;
