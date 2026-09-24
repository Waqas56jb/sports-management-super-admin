/**
 * Express application: security headers, CORS allow-list, logging, rate limiting, JSON parsing,
 * the /api/v1 routers and the central error handler. server.js starts it; tests import it directly.
 */
import compression from 'compression';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { env } from './config/env.js';
import { API_PREFIX, SERVICE_NAME } from './config/constants.js';
import { checkDatabase } from './config/database.js';
import { errorHandler } from './middleware/errorHandler.js';
import { notFound } from './middleware/notFound.js';
import { apiLimiter } from './middleware/rateLimiter.js';
import { requestLogger } from './middleware/requestLogger.js';
import attendanceRoutes from './routes/attendanceRoutes.js';
import authRoutes from './routes/authRoutes.js';
import coachRoutes from './routes/coachRoutes.js';
import competitionRoutes from './routes/competitionRoutes.js';
import matchRoutes from './routes/matchRoutes.js';
import notificationRoutes from './routes/notificationRoutes.js';
import playerRoutes from './routes/playerRoutes.js';
import profileRoutes from './routes/profileRoutes.js';
import reportRoutes from './routes/reportRoutes.js';
import statisticsRoutes from './routes/statisticsRoutes.js';
import teamRoutes from './routes/teamRoutes.js';
import trainingRoutes from './routes/trainingRoutes.js';
import uploadRoutes from './routes/uploadRoutes.js';
import userRoutes from './routes/userRoutes.js';

// ------------------------------------------------------------------ health (cheap, cached DB probe)
let dbStatus = { status: 'unknown', checkedAt: 0, latencyMs: null };
async function databaseHealth() {
  if (Date.now() - dbStatus.checkedAt < 30_000) return dbStatus;
  try {
    const r = await Promise.race([checkDatabase(), new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 3000))]);
    dbStatus = { status: 'ok', checkedAt: Date.now(), latencyMs: r.latencyMs };
  } catch {
    dbStatus = { status: 'unavailable', checkedAt: Date.now(), latencyMs: null };
  }
  return dbStatus;
}

async function health(_req, res) {
  const db = await databaseHealth();
  res.status(200).json({
    success: true,
    message: 'Sports Management API is healthy',
    status: 'ok',
    service: SERVICE_NAME,
    environment: env.nodeEnv,
    version: process.env.npm_package_version ?? '1.0.0',
    uptime: Math.round(process.uptime()),
    database: db.status,
    timestamp: new Date().toISOString(),
  });
}

// ------------------------------------------------------------------ input hygiene

const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
/** Drops prototype-pollution keys and NUL characters from JSON bodies before validation. */
function sanitize(value, depth = 0) {
  if (depth > 20) return undefined;
  if (typeof value === 'string') return value.replace(/\u0000/g, '');
  if (Array.isArray(value)) return value.map((v) => sanitize(v, depth + 1));
  if (value && typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) if (!FORBIDDEN_KEYS.has(k)) out[k] = sanitize(v, depth + 1);
    return out;
  }
  return value;
}

// ------------------------------------------------------------------ app

export function createApp() {
  const app = express();
  app.set('trust proxy', env.trustProxy);
  app.disable('x-powered-by');

  app.use(helmet({ crossOriginResourcePolicy: { policy: 'same-site' } }));
  const allowAll = !env.isProduction && env.corsOrigins.length === 0;
  app.use(
    cors({
      origin(origin, cb) {
        if (!origin || allowAll || env.corsOrigins.includes(origin.replace(/\/$/, ''))) return cb(null, true);
        return cb(new Error(`Not allowed by CORS: ${origin}`));
      },
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Authorization', 'Content-Type', 'Accept', 'X-Request-Id'],
      exposedHeaders: ['X-Request-Id', 'RateLimit', 'RateLimit-Policy', 'Retry-After'],
      maxAge: 600,
    }),
  );
  app.use(compression());
  app.use(requestLogger);

  app.get('/health', health);
  app.get(`${API_PREFIX}/health`, health);
  app.get('/', (_req, res) => res.json({ success: true, message: 'Sports Management API', data: { service: SERVICE_NAME, docs: 'See docs/API.md', health: '/health', api: API_PREFIX } }));

  app.use(express.json({ limit: '8mb' }));
  app.use((req, _res, next) => {
    if (req.body && typeof req.body === 'object') req.body = sanitize(req.body);
    next();
  });

  const api = express.Router();
  api.use(apiLimiter);
  for (const routes of [authRoutes, profileRoutes, userRoutes, playerRoutes, coachRoutes, teamRoutes, competitionRoutes, matchRoutes, trainingRoutes, attendanceRoutes, statisticsRoutes, notificationRoutes, reportRoutes, uploadRoutes]) {
    api.use(routes);
  }
  app.use(API_PREFIX, api);

  app.use(notFound);
  app.use(errorHandler);
  return app;
}

export const app = createApp();
