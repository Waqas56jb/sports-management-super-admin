/**
 * requireAuth: verifies the Bearer JWT, checks the server-side session (logout / refresh revoke
 * it), and loads the actor (role, coach teams, player team) from the database for this request.
 */
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { one } from '../config/database.js';
import { unauthorized, forbidden } from '../utils/errors.js';

const ACTOR_SQL = `
  SELECT s.id AS session_id, s.expires_at, s.revoked_at, s.remember,
         u.id AS user_id, u.role, u.status, u.email, u.first_name, u.last_name, u.phone, u.avatar_url, u.language, u.theme,
         c.id AS coach_id, c.status AS coach_status,
         coalesce((SELECT array_agg(ct.team_id) FROM coach_teams ct JOIN teams t ON t.id = ct.team_id AND t.deleted_at IS NULL
                   WHERE ct.coach_id = c.id), '{}'::uuid[]) AS coach_team_ids,
         p.id AS player_id, p.team_id AS player_team_id, p.status AS player_status
  FROM user_sessions s
  JOIN users u ON u.id = s.user_id AND u.deleted_at IS NULL
  LEFT JOIN coaches c ON c.user_id = u.id AND c.deleted_at IS NULL
  LEFT JOIN players p ON p.user_id = u.id AND p.deleted_at IS NULL
  WHERE s.id = $1 AND s.user_id = $2`;

export function buildActor(row) {
  return {
    userId: row.user_id,
    sessionId: row.session_id,
    role: row.role,
    status: row.status,
    email: row.email,
    name: `${row.first_name} ${row.last_name}`.trim(),
    firstName: row.first_name,
    lastName: row.last_name,
    phone: row.phone,
    avatar: row.avatar_url,
    language: row.language,
    theme: row.theme,
    remember: row.remember,
    coachId: row.coach_id,
    teamIds: row.role === 'coach' ? row.coach_team_ids : row.player_team_id ? [row.player_team_id] : [],
    playerId: row.player_id,
    teamId: row.player_team_id ?? null,
  };
}

function readToken(req) {
  const header = req.headers.authorization ?? '';
  const [scheme, token] = header.split(' ');
  return scheme?.toLowerCase() === 'bearer' && token ? token : null;
}

export async function authenticate(req) {
  const token = readToken(req);
  if (!token) throw unauthorized('TOKEN_MISSING', 'Authentication token is missing');
  let payload;
  try {
    payload = jwt.verify(token, env.jwt.secret, { algorithms: ['HS256'], issuer: 'sports-management-api' });
  } catch (err) {
    throw unauthorized(err.name === 'TokenExpiredError' ? 'TOKEN_EXPIRED' : 'TOKEN_INVALID', err.name === 'TokenExpiredError' ? 'Session expired' : 'Invalid token');
  }
  const row = await one(ACTOR_SQL, [payload.jti, payload.sub]);
  if (!row || row.revoked_at || new Date(row.expires_at) < new Date()) throw unauthorized('SESSION_REVOKED', 'Session is no longer valid');
  if (row.status !== 'active') throw unauthorized('ACCOUNT_INACTIVE', 'Account is not active', { i18nKey: 'auth.errors.inactive' });
  if (row.role === 'coach' && (!row.coach_id || row.coach_status !== 'active')) throw unauthorized('ACCOUNT_INACTIVE', 'Coach profile is not active', { i18nKey: 'auth.errors.inactive' });
  if (row.role === 'player' && !row.player_id) throw unauthorized('ACCOUNT_INACTIVE', 'Player profile missing', { i18nKey: 'auth.errors.inactive' });
  return buildActor(row);
}

export async function requireAuth(req, _res, next) {
  try {
    req.actor = await authenticate(req);
    next();
  } catch (err) {
    next(err);
  }
}

/** Only for routes that behave differently for signed-in users; never fails. */
export async function optionalAuth(req, _res, next) {
  try {
    if (readToken(req)) req.actor = await authenticate(req);
  } catch {
    req.actor = undefined;
  }
  next();
}

export function requireActive(req, _res, next) {
  if (!req.actor) return next(unauthorized());
  if (req.actor.status !== 'active') return next(forbidden('Account is not active'));
  return next();
}
