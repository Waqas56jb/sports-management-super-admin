/**
 * Rate limits: a general budget for the API and a much stricter one for credential endpoints
 * (login, forgot/reset password), keyed by IP + submitted email to slow down credential stuffing.
 */
import { ipKeyGenerator, rateLimit } from 'express-rate-limit';
import { env } from '../config/env.js';

const handler = (req, res, _next, options) =>
  res.status(options.statusCode).json({
    success: false,
    message: 'Too many requests. Please wait a moment and try again.',
    error: { code: 'RATE_LIMITED', i18nKey: 'errors.rateLimited' },
  });

export const apiLimiter = rateLimit({
  windowMs: env.rateLimit.windowMs,
  limit: env.rateLimit.max,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  handler,
});

export const authLimiter = rateLimit({
  windowMs: env.rateLimit.windowMs,
  limit: env.rateLimit.authMax,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  keyGenerator: (req) => `${ipKeyGenerator(req.ip ?? '')}|${String(req.body?.email ?? '').toLowerCase().slice(0, 120)}`,
  handler,
});
