/**
 * Structured access log: method, route, status, duration, user id and error code.
 * Bodies and headers are never logged (passwords and tokens stay out of the logs).
 */
import crypto from 'node:crypto';
import { pinoHttp } from 'pino-http';
import { logger } from '../utils/logger.js';

export const requestLogger = pinoHttp({
  logger,
  genReqId: (req, res) => {
    const incoming = req.headers['x-request-id'];
    const id = typeof incoming === 'string' && /^[\w-]{8,64}$/.test(incoming) ? incoming : crypto.randomUUID();
    res.setHeader('X-Request-Id', id);
    return id;
  },
  autoLogging: { ignore: (req) => req.url === '/health' },
  customLogLevel: (_req, res, err) => (err || res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info'),
  customSuccessMessage: (req, res) => `${req.method} ${req.originalUrl?.split('?')[0] ?? req.url} ${res.statusCode}`,
  customErrorMessage: (req, res) => `${req.method} ${req.originalUrl?.split('?')[0] ?? req.url} ${res.statusCode}`,
  customProps: (req) => ({ userId: req.actor?.userId, role: req.actor?.role }),
  serializers: {
    req: (req) => ({ id: req.id, method: req.method, url: req.url?.split('?')[0] }),
    res: (res) => ({ statusCode: res.statusCode }),
  },
  wrapSerializers: false,
});
