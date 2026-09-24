/**
 * Test helpers. The suite runs against the database in DATABASE_URL (seeded with `npm run seed`)
 * through the real Express app — no mocks. Records a test creates are removed at the end.
 */
import supertest from 'supertest';
import { app } from '../src/app.js';
import { many, one, pool } from '../src/config/database.js';

export const request = supertest(app);
export const API = '/api/v1';

export const ACCOUNTS = {
  admin: { email: 'admin@gmail.com', password: process.env.SEED_ADMIN_PASSWORD || 'admin@123!' },
  coach: { email: 'coach@gmail.com', password: process.env.SEED_COACH_PASSWORD || 'coach@123!' },
  player: { email: 'player@gmail.com', password: process.env.SEED_PLAYER_PASSWORD || 'player@123!' },
};

const tokens = {};
export async function tokenFor(role) {
  if (!tokens[role]) {
    const res = await request.post(`${API}/auth/login`).send(ACCOUNTS[role]);
    if (res.status !== 200) throw new Error(`Cannot log in as ${role}: ${res.status} ${JSON.stringify(res.body)}`);
    tokens[role] = res.body.data.token;
  }
  return tokens[role];
}

/** Authenticated request helpers: as('coach').get('/coach/teams') */
export function as(role) {
  const wrap = (method) => async (path, body) => {
    const token = await tokenFor(role);
    const req = request[method](`${API}${path}`).set('Authorization', `Bearer ${token}`);
    return body === undefined ? req : req.send(body);
  };
  return { get: wrap('get'), post: wrap('post'), put: wrap('put'), patch: wrap('patch'), delete: wrap('delete') };
}

/** Seed fixtures looked up from the database (not hard-coded ids). */
export async function fixtures() {
  const teams = await many(`SELECT id, name FROM teams WHERE deleted_at IS NULL`);
  const byName = Object.fromEntries(teams.map((t) => [t.name, t.id]));
  const demoPlayer = await one(`SELECT p.id, p.team_id FROM players p JOIN users u ON u.id = p.user_id WHERE u.email = 'player@gmail.com'`);
  const otherPlayer = await one(`SELECT p.id FROM players p WHERE p.team_id = $1 AND p.deleted_at IS NULL LIMIT 1`, [byName['City Sports Club']]);
  const teammate = await one(`SELECT p.id FROM players p WHERE p.team_id = $1 AND p.id <> $2 AND p.deleted_at IS NULL LIMIT 1`, [demoPlayer.team_id, demoPlayer.id]);
  return {
    djiboutiFc: byName['Djibouti FC'],
    citySports: byName['City Sports Club'],
    youngStars: byName['Young Stars FC'],
    horizon: byName['Horizon United'],
    demoPlayer,
    otherPlayer,
    teammate,
  };
}

export async function closeDb() {
  await pool.end();
}

export { many, one };
