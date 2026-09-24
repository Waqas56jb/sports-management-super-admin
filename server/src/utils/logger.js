/**
 * Structured JSON logging (pino). Secrets are redacted wherever they could appear:
 * auth headers, cookies, passwords, tokens and keys.
 */
import pino from 'pino';
import { env } from '../config/env.js';

const REDACT = [
  'req.headers.authorization',
  'req.headers.cookie',
  'headers.authorization',
  '*.password',
  '*.currentPassword',
  '*.newPassword',
  '*.password_hash',
  '*.token',
  '*.refreshToken',
  '*.serviceRoleKey',
  '*.secret',
];

const pretty = !env.isProduction && !env.isTest && process.stdout.isTTY;

export const logger = pino({
  level: env.logLevel,
  base: { service: 'sports-management-api', env: env.nodeEnv },
  redact: { paths: REDACT, censor: '[redacted]' },
  timestamp: pino.stdTimeFunctions.isoTime,
  ...(pretty ? { transport: { target: 'pino-pretty', options: { translateTime: 'SYS:HH:MM:ss', ignore: 'pid,hostname,service,env' } } } : {}),
});
