/**
 * Regenerates src/db/schema.sql from the migrations (a single readable snapshot of the schema).
 * The migrations remain the source of truth: `npm run migrate` applies them in order.
 *
 *   npm run schema:build
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.dirname(fileURLToPath(import.meta.url));
const files = fs.readdirSync(path.join(dir, 'migrations')).filter((f) => /^\d{3}_.+\.sql$/.test(f)).sort();
const header = `-- SportHub — Sports Management System: full PostgreSQL schema (Supabase).
-- GENERATED from src/db/migrations by \`npm run schema:build\`. Do not edit by hand;
-- add a new migration instead and run \`npm run migrate\`.
`;
const body = files.map((f) => `\n-- ============================================================ ${f}\n${fs.readFileSync(path.join(dir, 'migrations', f), 'utf8').trim()}\n`).join('');
fs.writeFileSync(path.join(dir, 'schema.sql'), header + body);
console.log(`schema.sql written from ${files.length} migrations`);
