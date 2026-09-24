import { Router } from 'express';
import * as c from '../controllers/matchController.js';
import { requireAuth } from '../middleware/auth.js';
import { requirePermission } from '../middleware/roles.js';
import { idParam, validate } from '../middleware/validate.js';
import { asyncHandler as h } from '../utils/asyncHandler.js';
import * as v from '../validators/matchValidators.js';

const r = Router();
const read = [requireAuth, requirePermission('matches:read')];
const admin = [requireAuth, requirePermission('matches:manage')];
// Admins and the coaches of the two teams (checked per match in the service).
const operate = [requireAuth, requirePermission('matches:operate')];

r.get('/matches', read, validate({ query: v.query }), h(c.list));
r.get('/matches/counts', read, h(c.counts));
r.get('/matches/:id', read, idParam(), h(c.get));

r.post('/matches', admin, validate({ body: v.create }), h(c.create));
r.patch('/matches/:id', admin, idParam(), validate({ body: v.update }), h(c.update));
r.put('/matches/:id', admin, idParam(), validate({ body: v.update }), h(c.update));
r.delete('/matches/:id', admin, idParam(), h(c.remove));

r.patch(['/matches/:id/status', '/matches/:id/score'], operate, idParam(), validate({ body: v.status }), h(c.updateStatus));
r.patch('/matches/:id/statistics', operate, idParam(), validate({ body: v.teamStats }), h(c.updateStatistics));
r.put(['/matches/:id/statistics', '/matches/:id/team-stats'], operate, idParam(), validate({ body: v.teamStats }), h(c.updateStatistics));
r.patch('/matches/:id/lineup', operate, idParam(), validate({ body: v.lineup }), h(c.saveLineup));
r.put('/matches/:id/lineups/:side', operate, validate({ params: v.sideParams, body: v.lineup }), h(c.saveLineup));
r.post('/matches/:id/events', operate, idParam(), validate({ body: v.event }), h(c.addEvent));
r.patch('/matches/:id/events/:eventId', operate, validate({ params: v.eventParams, body: v.eventUpdate }), h(c.updateEvent));
r.delete('/matches/:id/events/:eventId', operate, validate({ params: v.eventParams }), h(c.removeEvent));

export default r;
