import { Router } from 'express';
import * as c from '../controllers/attendanceController.js';
import { requireAuth } from '../middleware/auth.js';
import { requirePermission } from '../middleware/roles.js';
import { idParam, validate } from '../middleware/validate.js';
import { asyncHandler as h } from '../utils/asyncHandler.js';
import * as v from '../validators/attendanceValidators.js';

const r = Router();
// Players never reach these routes: they read their own lines through GET /player/attendance.
const read = [requireAuth, requirePermission('attendance:read')];
const write = [requireAuth, requirePermission('attendance:write')];

r.get('/attendance', read, validate({ query: v.query }), h(c.list));
r.get('/attendance/overview', read, validate({ query: v.query }), h(c.overview));
r.post('/attendance', write, validate({ body: v.create }), h(c.create));
r.patch('/attendance/:id', write, idParam(), validate({ body: v.update }), h(c.update));

export default r;
