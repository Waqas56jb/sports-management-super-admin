import { Router } from 'express';
import * as c from '../controllers/userController.js';
import { requireAuth } from '../middleware/auth.js';
import { requirePermission } from '../middleware/roles.js';
import { idParam, validate } from '../middleware/validate.js';
import { asyncHandler as h } from '../utils/asyncHandler.js';
import * as v from '../validators/profileValidators.js';

const r = Router();
const admin = [requireAuth, requirePermission('users:manage')];

r.get('/users', admin, validate({ query: v.userQuery }), h(c.list));
r.get('/users/counts', admin, h(c.counts));
r.get('/users/:id', admin, idParam(), h(c.get));
r.post('/users', admin, validate({ body: v.userCreate }), h(c.create));
r.patch('/users/:id', admin, idParam(), validate({ body: v.userUpdate }), h(c.update));
r.put('/users/:id', admin, idParam(), validate({ body: v.userUpdate }), h(c.update));
r.patch('/users/:id/status', admin, idParam(), validate({ body: v.userStatus }), h(c.setStatus));
r.post('/users/:id/reset-password', admin, idParam(), validate({ body: v.userResetPassword }), h(c.resetPassword));
r.delete('/users/:id', admin, idParam(), h(c.remove));

export default r;
