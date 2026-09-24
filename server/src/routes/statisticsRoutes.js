import { Router } from 'express';
import * as c from '../controllers/statisticsController.js';
import { requireAuth } from '../middleware/auth.js';
import { requirePermission, requireRole } from '../middleware/roles.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler as h } from '../utils/asyncHandler.js';
import { statisticsQuery } from '../validators/attendanceValidators.js';

const r = Router();
// Team-scoped for coaches; players use GET /player/statistics for their own figures.
const read = [requireAuth, requireRole('admin', 'coach')];

r.get('/statistics', read, validate({ query: statisticsQuery }), h(c.overview));
r.get('/statistics/players', read, validate({ query: statisticsQuery }), h(c.players));
r.get('/statistics/teams', read, validate({ query: statisticsQuery }), h(c.teams));
r.get('/statistics/trend', read, validate({ query: statisticsQuery }), h(c.trend));

r.get(['/dashboard', '/dashboard/admin'], requireAuth, requirePermission('dashboard:admin'), h(c.adminDashboard));
r.get('/dashboard/coach', requireAuth, requirePermission('dashboard:coach'), h(c.coachDashboard));
r.get('/dashboard/player', requireAuth, requirePermission('dashboard:player'), h(c.playerDashboard));

export default r;
