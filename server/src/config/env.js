/**
 * Validated runtime configuration. The process refuses to start with a missing or weak
 * secret instead of failing later on the first request.
 */
import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config({ quiet: true });

const bool = (v) => v === true || v === 'true' || v === '1';
const list = (v) =>
  String(v ?? '')
    .split(',')
    .map((s) => s.trim().replace(/\/$/, ''))
    .filter(Boolean);

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(5000),
  APP_TIMEZONE: z.string().default('Africa/Djibouti'),

  SUPABASE_URL: z.url().optional().or(z.literal('')),
  SUPABASE_ANON_KEY: z.string().optional().default(''),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional().default(''),

  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required (Supabase connection string)'),
  DATABASE_CA_CERT: z.string().optional().default(''),
  DATABASE_POOL_MAX: z.coerce.number().int().min(1).max(50).default(10),

  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_EXPIRES_IN: z.string().default('7d'),
  JWT_REMEMBER_EXPIRES_IN: z.string().default('30d'),
  BCRYPT_ROUNDS: z.coerce.number().int().min(8).max(15).default(11),

  CORS_ORIGINS: z.string().optional().default(''),
  ADMIN_FRONTEND_URL: z.string().optional().default(''),
  COACH_FRONTEND_URL: z.string().optional().default(''),
  PLAYER_FRONTEND_URL: z.string().optional().default(''),

  STORAGE_BUCKET: z.string().default('uploads'),
  UPLOAD_MAX_MB: z.coerce.number().positive().max(20).default(5),

  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(900000),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(1000),
  AUTH_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(20),
  TRUST_PROXY: z.string().optional().default('1'),
  LOG_LEVEL: z.string().optional(),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  const problems = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
  // eslint-disable-next-line no-console
  console.error(`Invalid environment configuration:\n${problems}`);
  process.exit(1);
}

const e = parsed.data;

// Local calendar of the federation: "today", match days and training days are computed in this zone.
process.env.TZ = e.APP_TIMEZONE;
const frontends = [e.ADMIN_FRONTEND_URL, e.COACH_FRONTEND_URL, e.PLAYER_FRONTEND_URL].map((u) => u.replace(/\/$/, '')).filter(Boolean);

export const env = Object.freeze({
  nodeEnv: e.NODE_ENV,
  isProduction: e.NODE_ENV === 'production',
  isTest: e.NODE_ENV === 'test',
  port: e.PORT,
  timezone: e.APP_TIMEZONE,
  supabase: { url: e.SUPABASE_URL || '', anonKey: e.SUPABASE_ANON_KEY, serviceRoleKey: e.SUPABASE_SERVICE_ROLE_KEY },
  database: { url: e.DATABASE_URL, caCert: e.DATABASE_CA_CERT.replace(/\\n/g, '\n'), poolMax: e.DATABASE_POOL_MAX },
  jwt: { secret: e.JWT_SECRET, expiresIn: e.JWT_EXPIRES_IN, rememberExpiresIn: e.JWT_REMEMBER_EXPIRES_IN },
  bcryptRounds: e.BCRYPT_ROUNDS,
  corsOrigins: [...new Set([...list(e.CORS_ORIGINS), ...frontends])],
  frontends: { admin: e.ADMIN_FRONTEND_URL, coach: e.COACH_FRONTEND_URL, player: e.PLAYER_FRONTEND_URL },
  storage: { bucket: e.STORAGE_BUCKET, maxBytes: Math.round(e.UPLOAD_MAX_MB * 1024 * 1024) },
  rateLimit: { windowMs: e.RATE_LIMIT_WINDOW_MS, max: e.RATE_LIMIT_MAX, authMax: e.AUTH_RATE_LIMIT_MAX },
  trustProxy: /^\d+$/.test(e.TRUST_PROXY) ? Number(e.TRUST_PROXY) : bool(e.TRUST_PROXY),
  logLevel: e.LOG_LEVEL || (e.NODE_ENV === 'production' ? 'info' : e.NODE_ENV === 'test' ? 'silent' : 'debug'),
});
