import { Router } from 'express';
import * as c from '../controllers/competitionController.js';
import { requireAuth } from '../middleware/auth.js';
import { requirePermission } from '../middleware/roles.js';
import { idParam, validate } from '../middleware/validate.js';
import { asyncHandler as h } from '../utils/asyncHandler.js';
import * as v from '../validators/competitionValidators.js';

const r = Router();
const read = [requireAuth, requirePermission('competitions:read')];
const admin = [requireAuth, requirePermission('competitions:manage')];

// Coaches and players only see competitions their team takes part in (enforced in the service).
r.get('/competitions', read, validate({ query: v.query }), h(c.list));
r.get('/competitions/options', read, h(c.options));
r.get('/competitions/seasons', read, h(c.seasons));
r.get('/competitions/:id', read, idParam(), h(c.get));
r.get('/competitions/:id/standings', read, idParam(), h(c.standings));
r.get('/competitions/:id/teams', read, idParam(), h(c.teams));

r.post('/competitions', admin, validate({ body: v.create }), h(c.create));
r.patch('/competitions/:id', admin, idParam(), validate({ body: v.update }), h(c.update));
r.put('/competitions/:id', admin, idParam(), validate({ body: v.update }), h(c.update));
r.delete('/competitions/:id', admin, idParam(), h(c.remove));
r.post('/competitions/:id/teams', admin, idParam(), validate({ body: v.addTeam }), h(c.addTeam));
r.delete('/competitions/:id/teams/:teamId', admin, validate({ params: v.teamParams }), h(c.removeTeam));

export default r;
