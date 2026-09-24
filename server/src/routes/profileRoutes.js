import { Router } from 'express';
import * as c from '../controllers/profileController.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler as h } from '../utils/asyncHandler.js';
import { changePassword } from '../validators/authValidators.js';
import * as v from '../validators/profileValidators.js';

const r = Router();

r.get('/profile', requireAuth, h(c.get));
r.patch('/profile', requireAuth, validate({ body: v.updateProfile }), h(c.update));
r.patch('/profile/password', requireAuth, validate({ body: changePassword }), h(c.changePassword));

r.get('/settings', requireAuth, h(c.getSettings));
r.patch('/settings', requireAuth, validate({ body: v.settings }), h(c.updateSettings));

export default r;
