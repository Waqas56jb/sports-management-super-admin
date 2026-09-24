import { Router } from 'express';
import * as c from '../controllers/authController.js';
import { requireAuth } from '../middleware/auth.js';
import { authLimiter } from '../middleware/rateLimiter.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler as h } from '../utils/asyncHandler.js';
import * as v from '../validators/authValidators.js';
import { updateProfile } from '../validators/profileValidators.js';

const r = Router();

r.post('/auth/login', authLimiter, validate({ body: v.login }), h(c.login));
r.post('/auth/forgot-password', authLimiter, validate({ body: v.forgotPassword }), h(c.forgotPassword));
r.post('/auth/reset-password', authLimiter, validate({ body: v.resetPassword }), h(c.resetPassword));

r.post('/auth/logout', requireAuth, h(c.logout));
r.post('/auth/refresh', requireAuth, h(c.refresh));
r.get('/auth/me', requireAuth, h(c.me));
r.put('/auth/me', requireAuth, validate({ body: updateProfile }), h(c.updateMe));
r.patch('/auth/me', requireAuth, validate({ body: updateProfile }), h(c.updateMe));
r.post('/auth/change-password', requireAuth, validate({ body: v.changePassword }), h(c.changePassword));

export default r;
