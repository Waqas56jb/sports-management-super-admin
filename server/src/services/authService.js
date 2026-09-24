/**
 * Authentication: bcrypt password verification, JWT issuing with a server-side session row
 * (revocable on logout / refresh), password change and the reset-token flow.
 */
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { many, one, query, withTransaction } from '../config/database.js';
import { AppError, fieldError, unauthorized } from '../utils/errors.js';
import { logger } from '../utils/logger.js';
import { audit } from './shared.js';

const ISSUER = 'sports-management-api';
const RESET_TTL_MINUTES = 60;
// A real hash of a random password: login spends the same time whether or not the email exists.
const DUMMY_HASH = bcrypt.hashSync(crypto.randomBytes(12).toString('hex'), 10);

function durationMs(spec) {
  const m = String(spec).match(/^(\d+)\s*([smhd])$/);
  if (!m) return 7 * 86400000;
  return Number(m[1]) * { s: 1000, m: 60000, h: 3600000, d: 86400000 }[m[2]];
}

/** The public user object returned by login / me (never includes the password hash). */
export async function publicUser(userId, client) {
  const row = await one(
    `SELECT u.id, u.email, u.first_name, u.last_name, u.phone, u.avatar_url, u.role, u.status, u.language, u.theme, u.last_login_at, u.created_at,
            c.id AS coach_id, p.id AS player_id, p.team_id AS player_team_id,
            coalesce((SELECT array_agg(ct.team_id) FROM coach_teams ct JOIN teams t ON t.id = ct.team_id AND t.deleted_at IS NULL WHERE ct.coach_id = c.id), '{}'::uuid[]) AS coach_team_ids
     FROM users u
     LEFT JOIN coaches c ON c.user_id = u.id AND c.deleted_at IS NULL
     LEFT JOIN players p ON p.user_id = u.id AND p.deleted_at IS NULL
     WHERE u.id = $1 AND u.deleted_at IS NULL`,
    [userId],
    client,
  );
  if (!row) return null;
  return {
    id: row.id,
    name: `${row.first_name} ${row.last_name}`.trim(),
    first_name: row.first_name,
    last_name: row.last_name,
    email: row.email,
    phone: row.phone,
    role: row.role,
    status: row.status,
    avatar: row.avatar_url,
    language: row.language,
    theme: row.theme,
    coach_id: row.coach_id ?? null,
    player_id: row.player_id ?? null,
    team_ids: row.role === 'coach' ? row.coach_team_ids : row.player_team_id ? [row.player_team_id] : [],
    last_login_at: row.last_login_at,
    created_at: row.created_at,
  };
}

async function issueSession(client, user, { remember, portal, userAgent, ip }) {
  const ttl = durationMs(remember ? env.jwt.rememberExpiresIn : env.jwt.expiresIn);
  const expiresAt = new Date(Date.now() + ttl);
  const session = await one(
    `INSERT INTO user_sessions (user_id, portal, remember, user_agent, ip, expires_at) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
    [user.id, portal ?? null, Boolean(remember), userAgent?.slice(0, 300) ?? null, ip ?? null, expiresAt],
    client,
  );
  // Minimal claims: subject, role and the session id (jti) — nothing sensitive.
  const token = jwt.sign({ sub: user.id, role: user.role }, env.jwt.secret, {
    algorithm: 'HS256',
    expiresIn: Math.floor(ttl / 1000),
    issuer: ISSUER,
    jwtid: session.id,
  });
  return { token, expiresAt: expiresAt.toISOString(), sessionId: session.id };
}

const PORTAL_ERRORS = {
  admin: { code: 'NOT_ADMIN', i18nKey: 'auth.errors.notAdmin', message: 'This account cannot access the admin panel' },
  coach: { code: 'NOT_COACH', i18nKey: 'auth.errors.notCoach', message: 'This account cannot access the coach workspace' },
  player: { code: 'NOT_PLAYER', i18nKey: 'auth.errors.notPlayer', message: 'This account cannot access the player space' },
};

export async function login({ email, password, remember = false, portal }, meta = {}) {
  const normalized = email.trim().toLowerCase();
  const user = await one(
    `SELECT u.id, u.role, u.status, u.password_hash,
            c.status AS coach_status, c.id AS coach_id, p.id AS player_id
     FROM users u
     LEFT JOIN coaches c ON c.user_id = u.id AND c.deleted_at IS NULL
     LEFT JOIN players p ON p.user_id = u.id AND p.deleted_at IS NULL
     WHERE u.email = $1 AND u.deleted_at IS NULL`,
    [normalized],
  );
  const valid = await bcrypt.compare(password, user?.password_hash ?? DUMMY_HASH);
  if (!user || !valid) {
    throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password', { i18nKey: 'auth.errors.invalidCredentials' });
  }
  if (portal && user.role !== portal) {
    const e = PORTAL_ERRORS[portal];
    throw new AppError(403, e.code, e.message, { i18nKey: e.i18nKey });
  }
  const profileInactive = (user.role === 'coach' && (!user.coach_id || user.coach_status !== 'active')) || (user.role === 'player' && !user.player_id);
  if (user.status !== 'active' || profileInactive) {
    throw new AppError(403, 'ACCOUNT_INACTIVE', 'This account is not active', { i18nKey: 'auth.errors.inactive' });
  }

  return withTransaction(async (client) => {
    const session = await issueSession(client, user, { remember, portal, ...meta });
    await query(`UPDATE users SET last_login_at = now() WHERE id = $1`, [user.id], client);
    return { user: await publicUser(user.id, client), token: session.token, expiresAt: session.expiresAt };
  });
}

export async function logout(actor) {
  await query(`UPDATE user_sessions SET revoked_at = now() WHERE id = $1 AND revoked_at IS NULL`, [actor.sessionId]);
}

/** Exchanges a valid session for a fresh token and revokes the old one (rotation). */
export async function refresh(actor, meta = {}) {
  return withTransaction(async (client) => {
    await query(`UPDATE user_sessions SET revoked_at = now() WHERE id = $1`, [actor.sessionId], client);
    const session = await issueSession(client, { id: actor.userId, role: actor.role }, { remember: actor.remember, portal: actor.role, ...meta });
    return { user: await publicUser(actor.userId, client), token: session.token, expiresAt: session.expiresAt };
  });
}

export async function changePassword(actor, { currentPassword, newPassword }) {
  const row = await one(`SELECT password_hash FROM users WHERE id = $1`, [actor.userId]);
  if (!row || !(await bcrypt.compare(currentPassword, row.password_hash))) {
    throw fieldError(400, 'WRONG_PASSWORD', 'The current password is incorrect', 'currentPassword', 'settings.security.wrongPassword');
  }
  if (currentPassword === newPassword) {
    throw fieldError(400, 'SAME_PASSWORD', 'Choose a password different from the current one', 'newPassword', 'settings.security.sameAsCurrent');
  }
  const hash = await bcrypt.hash(newPassword, env.bcryptRounds);
  await withTransaction(async (client) => {
    await query(`UPDATE users SET password_hash = $2, password_changed_at = now(), updated_by = $1 WHERE id = $1`, [actor.userId, hash], client);
    // Sign out every other device; the current session stays valid.
    await query(`UPDATE user_sessions SET revoked_at = now() WHERE user_id = $1 AND id <> $2 AND revoked_at IS NULL`, [actor.userId, actor.sessionId], client);
    await audit(client, actor, 'password.changed', 'user', actor.userId);
  });
  return { ok: true };
}

const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

/**
 * Creates a reset token. The response is identical whether or not the email exists, so the
 * endpoint cannot be used to discover accounts. The link is delivered by the notification
 * channel configured for the deployment (logged in development).
 */
export async function requestPasswordReset({ email }) {
  const user = await one(`SELECT id, role, first_name FROM users WHERE email = $1 AND deleted_at IS NULL AND status = 'active'`, [email.trim().toLowerCase()]);
  if (user) {
    const token = crypto.randomBytes(32).toString('base64url');
    await query(
      `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, now() + ($3 || ' minutes')::interval)`,
      [user.id, hashToken(token), String(RESET_TTL_MINUTES)],
    );
    const base = env.frontends[user.role] || '';
    const link = `${base}/${user.role}/reset-password?token=${token}`;
    if (!env.isProduction) logger.info({ userId: user.id, link }, 'Password reset link (development only)');
    else logger.info({ userId: user.id }, 'Password reset requested');
    // Admins see reset requests in their inbox.
    const admins = await many(`SELECT id FROM users WHERE role = 'admin' AND status = 'active' AND deleted_at IS NULL`);
    const name = user.first_name;
    for (const a of admins) {
      await query(
        `INSERT INTO notifications (user_id, type, subtype, title, message, template, params, reference_type)
         VALUES ($1, 'system', 'account_update', 'Password reset', $2, 'password_reset', $3, 'users')`,
        [a.id, `A password reset was requested for ${name}.`, JSON.stringify({ name })],
      );
    }
  }
  return { ok: true };
}

export async function resetPassword({ token, password }) {
  const row = await one(
    `SELECT id, user_id FROM password_reset_tokens WHERE token_hash = $1 AND used_at IS NULL AND expires_at > now()`,
    [hashToken(token)],
  );
  if (!row) throw new AppError(400, 'RESET_TOKEN_INVALID', 'This reset link is invalid or has expired', { i18nKey: 'auth.errors.resetInvalid' });
  const hash = await bcrypt.hash(password, env.bcryptRounds);
  await withTransaction(async (client) => {
    await query(`UPDATE users SET password_hash = $2, password_changed_at = now() WHERE id = $1`, [row.user_id, hash], client);
    await query(`UPDATE password_reset_tokens SET used_at = now() WHERE user_id = $1 AND used_at IS NULL`, [row.user_id], client);
    await query(`UPDATE user_sessions SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL`, [row.user_id], client);
    await audit(client, { userId: row.user_id, role: null }, 'password.reset', 'user', row.user_id);
  });
  return { ok: true };
}

/** Admin action: set a temporary password (or send a reset link) for another account. */
export async function adminResetPassword(actor, userId, { mode, password }) {
  const user = await one(`SELECT id, email FROM users WHERE id = $1 AND deleted_at IS NULL`, [userId]);
  if (!user) throw new AppError(404, 'USER_NOT_FOUND', 'User not found', { i18nKey: 'errors.notFound' });
  if (mode === 'temporary') {
    const hash = await bcrypt.hash(password, env.bcryptRounds);
    await withTransaction(async (client) => {
      await query(`UPDATE users SET password_hash = $2, password_changed_at = now(), updated_by = $3 WHERE id = $1`, [userId, hash, actor.userId], client);
      await query(`UPDATE user_sessions SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL`, [userId], client);
      await audit(client, actor, 'password.set_temporary', 'user', userId);
    });
  } else {
    await requestPasswordReset({ email: user.email });
  }
  return { ok: true };
}

export const assertAuthenticated = (actor) => {
  if (!actor) throw unauthorized();
};
