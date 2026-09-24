/**
 * Process entry point. Listens on process.env.PORT (Railway provides it) and shuts down cleanly on
 * SIGTERM/SIGINT so in-flight requests finish and database connections are released.
 */
import { env } from './config/env.js';
import { pool } from './config/database.js';
import { app } from './app.js';
import { logger } from './utils/logger.js';

const PORT = process.env.PORT || env.port || 5000;

const server = app.listen(PORT, () => {
  logger.info({ port: Number(PORT), timezone: env.timezone }, `Sports Management API listening on :${PORT}`);
});
server.keepAliveTimeout = 65_000;
server.headersTimeout = 66_000;

let closing = false;
function shutdown(signal) {
  if (closing) return;
  closing = true;
  logger.info({ signal }, 'Shutting down');
  server.close(async () => {
    await pool.end().catch(() => {});
    logger.info('Shutdown complete');
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('unhandledRejection', (reason) => logger.error({ err: { message: reason?.message ?? String(reason) } }, 'Unhandled promise rejection'));
process.on('uncaughtException', (err) => {
  logger.fatal({ err: { message: err.message, stack: err.stack } }, 'Uncaught exception');
  shutdown('uncaughtException');
});
