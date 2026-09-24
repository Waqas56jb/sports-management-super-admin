/**
 * The single PostgreSQL pool for Supabase. Every query in the app goes through `query()` or
 * `withTransaction()` so multi-step writes (goal → score → statistics → standings → notifications)
 * are atomic.
 */
import pg from 'pg';
import { env } from './env.js';
import { logger } from '../utils/logger.js';

// Return DATE columns as 'YYYY-MM-DD' strings (no time-zone shifting), numerics as numbers.
pg.types.setTypeParser(1082, (v) => v);
pg.types.setTypeParser(1700, (v) => (v === null ? null : Number(v)));
pg.types.setTypeParser(20, (v) => (v === null ? null : Number(v)));

export const pool = new pg.Pool({
  connectionString: env.database.url,
  max: env.database.poolMax,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 15_000,
  ssl: env.database.caCert ? { ca: env.database.caCert, rejectUnauthorized: true } : { rejectUnauthorized: false },
  application_name: 'sports-management-api',
});

pool.on('error', (err) => logger.error({ err: { message: err.message, code: err.code } }, 'PostgreSQL pool error'));

/** Runs a parameterised query. Never interpolate user input into `text`. */
export function query(text, params = [], client = pool) {
  return client.query(text, params);
}

export async function one(text, params = [], client = pool) {
  const { rows } = await client.query(text, params);
  return rows[0] ?? null;
}

export async function many(text, params = [], client = pool) {
  const { rows } = await client.query(text, params);
  return rows;
}

/** Executes `fn(client)` inside BEGIN/COMMIT, rolling back on any error. */
export async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

export async function checkDatabase() {
  const started = Date.now();
  await pool.query('select 1');
  return { ok: true, latencyMs: Date.now() - started };
}
