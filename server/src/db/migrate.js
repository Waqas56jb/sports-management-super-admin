/**
 * Migration runner: applies src/db/migrations/*.sql in order, each inside its own transaction,
 * and records it in schema_migrations (with a checksum, so an edited migration is detected).
 *
 *   npm run migrate            apply pending migrations
 *   npm run migrate:status     list applied / pending migrations
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool } from '../config/database.js';

const DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), 'migrations');

async function ensureTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version     text PRIMARY KEY,
      name        text NOT NULL,
      checksum    text NOT NULL,
      applied_at  timestamptz NOT NULL DEFAULT now()
    )`);
  await client.query('ALTER TABLE schema_migrations ENABLE ROW LEVEL SECURITY');
}

function readMigrations() {
  return fs
    .readdirSync(DIR)
    .filter((f) => /^\d{3}_.+\.sql$/.test(f))
    .sort()
    .map((file) => {
      const sql = fs.readFileSync(path.join(DIR, file), 'utf8');
      return { version: file.slice(0, 3), name: file, sql, checksum: crypto.createHash('sha256').update(sql).digest('hex').slice(0, 16) };
    });
}

export async function migrate({ log = console.log } = {}) {
  const client = await pool.connect();
  try {
    await ensureTable(client);
    // Serialise concurrent deploys (e.g. two Railway replicas starting together).
    await client.query('SELECT pg_advisory_lock(727274)');
    const { rows } = await client.query('SELECT version, checksum FROM schema_migrations');
    const applied = new Map(rows.map((r) => [r.version, r.checksum]));
    let count = 0;
    for (const m of readMigrations()) {
      if (applied.has(m.version)) {
        if (applied.get(m.version) !== m.checksum) log(`! ${m.name} changed after it was applied (checksum mismatch) — create a new migration instead.`);
        continue;
      }
      log(`→ applying ${m.name}`);
      await client.query('BEGIN');
      try {
        await client.query(m.sql);
        await client.query('INSERT INTO schema_migrations (version, name, checksum) VALUES ($1, $2, $3)', [m.version, m.name, m.checksum]);
        await client.query('COMMIT');
        count += 1;
      } catch (err) {
        await client.query('ROLLBACK');
        throw new Error(`Migration ${m.name} failed: ${err.message}`);
      }
    }
    log(count ? `✓ ${count} migration(s) applied` : '✓ database is up to date');
    return count;
  } finally {
    await client.query('SELECT pg_advisory_unlock(727274)').catch(() => {});
    client.release();
  }
}

async function status() {
  const client = await pool.connect();
  try {
    await ensureTable(client);
    const { rows } = await client.query('SELECT version, applied_at FROM schema_migrations');
    const applied = new Map(rows.map((r) => [r.version, r.applied_at]));
    for (const m of readMigrations()) {
      console.log(`${applied.has(m.version) ? '✓ applied ' : '· pending '} ${m.name}${applied.has(m.version) ? `  (${applied.get(m.version).toISOString()})` : ''}`);
    }
  } finally {
    client.release();
  }
}

const isCli = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCli) {
  (process.argv.includes('--status') ? status() : migrate())
    .then(() => pool.end())
    .catch(async (err) => {
      console.error(err.message);
      await pool.end();
      process.exit(1);
    });
}
