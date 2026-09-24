import { Router } from 'express';
import * as c from '../controllers/teamController.js';
import { requireAuth } from '../middleware/auth.js';
import { requirePermission } from '../middleware/roles.js';
import { idParam, validate } from '../middleware/validate.js';
import { asyncHandler as h } from '../utils/asyncHandler.js';
import { assignToTeam } from '../validators/coachValidators.js';
import { statisticsQuery } from '../validators/playerValidators.js';
import * as v from '../validators/teamValidators.js';

const r = Router();
const read = [requireAuth, requirePermission('teams:read')];
const admin = [requireAuth, requirePermission('teams:manage')];

// Reads are scoped in the service: coaches see assigned teams, players their own team.
r.get('/teams', read, validate({ query: v.query }), h(c.list));
r.get('/teams/options', read, h(c.options));
r.get('/teams/:id', read, idParam(), h(c.get));
r.get('/teams/:id/statistics', read, idParam(), validate({ query: statisticsQuery }), h(c.statistics));
r.get('/teams/:teamId/players', read, validate({ params: v.teamParams }), h(c.players));
r.get('/teams/:teamId/coaches', read, validate({ params: v.teamParams }), h(c.coaches));

r.post('/teams', admin, validate({ body: v.create }), h(c.create));
r.patch('/teams/:id', admin, idParam(), validate({ body: v.update }), h(c.update));
r.put('/teams/:id', admin, idParam(), validate({ body: v.update }), h(c.update));
r.delete('/teams/:id', admin, idParam(), h(c.remove));

r.post('/teams/:teamId/players', admin, validate({ params: v.teamParams, body: v.addPlayers }), h(c.addPlayers));
r.delete('/teams/:teamId/players/:playerId', admin, validate({ params: v.teamPlayerParams }), h(c.removePlayer));
r.post('/teams/:teamId/coaches', admin, validate({ params: v.teamParams, body: assignToTeam }), h(c.assignCoach));
r.delete('/teams/:teamId/coaches/:coachId', admin, validate({ params: v.teamCoachParams }), h(c.unassignCoach));

export default r;
