/**
 * /training (spec) and /training-sessions (alias used by the admin app) + /calendar.
 * Players read training through /player/training; here they are read-only as well.
 */
import { Router } from 'express';
import * as c from '../controllers/trainingController.js';
import { requireAuth } from '../middleware/auth.js';
import { requirePermission } from '../middleware/roles.js';
import { idParam, validate } from '../middleware/validate.js';
import { asyncHandler as h } from '../utils/asyncHandler.js';
import * as v from '../validators/trainingValidators.js';

const r = Router();
const read = [requireAuth, requirePermission('training:read')];
const write = [requireAuth, requirePermission('training:write')];
const register = [requireAuth, requirePermission('attendance:write')];
const P = (path) => [`/training${path}`, `/training-sessions${path}`];

r.get(P(''), read, validate({ query: v.query }), h(c.list));
r.get(P('/options'), write, validate({ query: v.query }), h(c.options));
r.get(P('/counts'), read, h(c.counts));
r.get(P('/:id'), read, idParam(), h(c.get));
r.post(P(''), write, validate({ body: v.create }), h(c.create));
r.patch(P('/:id'), write, idParam(), validate({ body: v.update }), h(c.update));
r.put(P('/:id'), write, idParam(), validate({ body: v.update }), h(c.update));
r.post(P('/:id/cancel'), write, idParam(), validate({ body: v.cancel }), h(c.cancel));
r.post(P('/:id/restore'), write, idParam(), h(c.restore));
r.delete(P('/:id'), requireAuth, requirePermission('training:delete'), idParam(), h(c.remove));

r.get(P('/:id/attendance'), register, idParam(), h(c.attendance));
r.put(P('/:id/attendance'), register, idParam(), validate({ body: v.register }), h(c.saveAttendance));
r.post(P('/:id/attendance/bulk'), register, idParam(), validate({ body: v.register }), h(c.bulkAttendance));

r.get('/calendar', requireAuth, requirePermission('calendar:read'), validate({ query: v.calendarQuery }), h(c.calendar));

export default r;
