/**
 * Users: admin account management, plus every user's own profile and settings.
 * Creating a coach / player account also creates the matching (empty) profile.
 */
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { env } from '../config/env.js';
import { many, one, query, withTransaction } from '../config/database.js';
import { AppError, notFound, unprocessable } from '../utils/errors.js';
import { SqlBuilder } from '../utils/filters.js';
import { buildPagination, parsePagination } from '../utils/pagination.js';
import { todayISO } from '../utils/dates.js';
import { audit, splitName } from './shared.js';
import { getPreferences, updatePreferences } from './notificationService.js';
import { resolveImageField } from './storageService.js';
import { publicUser } from './authService.js';

const USER_SORT = { name: "u.first_name || ' ' || u.last_name", email: 'u.email', role: 'u.role', status: 'u.status', created_at: 'u.created_at', last_login_at: 'u.last_login_at' };

const USER_SELECT = `
  SELECT u.id, trim(u.first_name || ' ' || u.last_name) AS name, u.first_name, u.last_name, u.email, u.phone, u.role, u.status,
         u.avatar_url AS avatar, u.language, u.theme, u.created_at, u.updated_at, u.last_login_at,
         CASE WHEN p.id IS NOT NULL THEN json_build_object('type', 'player', 'id', p.id)
              WHEN c.id IS NOT NULL THEN json_build_object('type', 'coach', 'id', c.id) END AS profile
  FROM users u
  LEFT JOIN players p ON p.user_id = u.id AND p.deleted_at IS NULL
  LEFT JOIN coaches c ON c.user_id = u.id AND c.deleted_at IS NULL`;

async function loadUser(id, client) {
  const u = await one(`${USER_SELECT} WHERE u.id = $1 AND u.deleted_at IS NULL`, [id], client);
  if (!u) throw notFound('User');
  return u;
}

export async function list(q = {}) {
  const p = parsePagination(q, { defaultLimit: 10 });
  const b = new SqlBuilder();
  b.where('u.deleted_at IS NULL');
  b.whereIf(q.role, 'u.role = ?', q.role);
  b.whereIf(q.status, 'u.status = ?', q.status);
  b.search(q.search, ['u.first_name', 'u.last_name', "u.first_name || ' ' || u.last_name", 'u.email']);
  const sort = USER_SORT[q.sortBy] ?? 'u.created_at';
  const dir = String(q.sortOrder ?? 'desc').toLowerCase() === 'asc' ? 'ASC' : 'DESC';
  const params = [...b.params];
  const [rows, count] = await Promise.all([
    many(`${USER_SELECT} ${b.clause} ORDER BY ${sort} ${dir} NULLS LAST, u.id LIMIT $${params.length + 1} OFFSET $${params.length + 2}`, [...params, p.limit, p.offset]),
    one(`SELECT count(*)::int AS total FROM users u ${b.clause}`, params),
  ]);
  return { rows, pagination: buildPagination(count.total, p) };
}

export async function counts() {
  return one(
    `SELECT count(*)::int AS total,
            (count(*) FILTER (WHERE role = 'admin'))::int AS admin,
            (count(*) FILTER (WHERE role = 'coach'))::int AS coach,
            (count(*) FILTER (WHERE role = 'player'))::int AS player,
            (count(*) FILTER (WHERE status = 'active'))::int AS active,
            (count(*) FILTER (WHERE status = 'inactive'))::int AS inactive,
            (count(*) FILTER (WHERE status = 'suspended'))::int AS suspended,
            (count(*) FILTER (WHERE status = 'pending'))::int AS pending
     FROM users WHERE deleted_at IS NULL`,
  );
}

export const get = (id) => loadUser(id);

async function nextCode(client, table, column, prefix) {
  const row = await one(`SELECT coalesce(max(substring(${column} FROM 2)::int), 0) + 1 AS n FROM ${table} WHERE ${column} ~ '^${prefix}[0-9]+$'`, [], client);
  return `${prefix}${String(row.n).padStart(3, '0')}`;
}

export async function create(actor, data) {
  const id = await withTransaction(async (client) => {
    const password = data.password ?? crypto.randomBytes(24).toString('hex');
    const hash = await bcrypt.hash(password, env.bcryptRounds);
    const { first_name, last_name } = splitName(data.name);
    const u = await one(
      `INSERT INTO users (email, password_hash, first_name, last_name, phone, role, status, created_by, updated_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8) RETURNING id`,
      [data.email, hash, first_name, last_name, data.phone ?? '', data.role, data.status ?? 'active', actor.userId],
      client,
    );
    if (data.role === 'coach') {
      await query(
        `INSERT INTO coaches (user_id, coach_code, phone, status, created_by, updated_by) VALUES ($1, $2, $3, $4, $5, $5)`,
        [u.id, await nextCode(client, 'coaches', 'coach_code', 'C'), data.phone ?? '', data.status === 'active' ? 'active' : 'inactive', actor.userId],
        client,
      );
    }
    if (data.role === 'player') {
      await query(
        `INSERT INTO players (user_id, player_code, status, registration_date, created_by, updated_by) VALUES ($1, $2, $3, $4, $5, $5)`,
        [u.id, await nextCode(client, 'players', 'player_code', 'P'), data.status ?? 'active', todayISO(), actor.userId],
        client,
      );
    }
    await audit(client, actor, 'user.created', 'user', u.id, { email: data.email, role: data.role });
    return u.id;
  });
  return loadUser(id);
}

/** Linked profiles follow the account (name, email, status). The role of a profiled account is fixed. */
export async function update(actor, id, data) {
  const user = await loadUser(id);
  if (data.role && data.role !== user.role && user.profile) throw unprocessable('ROLE_LOCKED', 'The role of an account with a player/coach profile cannot change', { i18nKey: 'users.errors.roleLocked', fields: { role: 'users.errors.roleLocked' } });
  if (user.id === actor.userId && data.role && data.role !== 'admin') throw unprocessable('CANNOT_DEMOTE_SELF', 'You cannot remove your own admin role', { i18nKey: 'users.errors.lastAdmin', fields: { role: 'users.errors.lastAdmin' } });
  await withTransaction(async (client) => {
    const cols = {};
    if (data.name !== undefined) Object.assign(cols, splitName(data.name));
    if (data.email !== undefined) cols.email = data.email;
    if (data.phone !== undefined) cols.phone = data.phone;
    if (data.role !== undefined) cols.role = data.role;
    if (data.status !== undefined) cols.status = data.status;
    const keys = Object.keys(cols);
    if (keys.length) await query(`UPDATE users SET ${keys.map((k, i) => `${k} = $${i + 2}`).join(', ')}, updated_by = $${keys.length + 2} WHERE id = $1`, [id, ...keys.map((k) => cols[k]), actor.userId], client);
    if (data.status !== undefined) await syncProfileStatus(client, user, data.status);
    if (data.status && data.status !== 'active') await query(`UPDATE user_sessions SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL`, [id], client);
    await audit(client, actor, 'user.updated', 'user', id, data);
  });
  return loadUser(id);
}

async function syncProfileStatus(client, user, status) {
  if (user.profile?.type === 'player') await query(`UPDATE players SET status = $2 WHERE id = $1`, [user.profile.id, status], client);
  if (user.profile?.type === 'coach') await query(`UPDATE coaches SET status = $2 WHERE id = $1`, [user.profile.id, status === 'active' ? 'active' : 'inactive'], client);
}

export async function setStatus(actor, id, status) {
  const user = await loadUser(id);
  if (id === actor.userId && status !== 'active') throw unprocessable('CANNOT_DISABLE_SELF', 'You cannot deactivate your own account', { i18nKey: 'users.errors.cannotDeleteSelf' });
  await withTransaction(async (client) => {
    await query(`UPDATE users SET status = $2, updated_by = $3 WHERE id = $1`, [id, status, actor.userId], client);
    await syncProfileStatus(client, user, status);
    if (status !== 'active') await query(`UPDATE user_sessions SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL`, [id], client);
    await audit(client, actor, 'user.status', 'user', id, { from: user.status, to: status });
  });
  return loadUser(id);
}

/** Soft delete. The last administrator and your own account cannot be removed. */
export async function remove(actor, id) {
  if (id === actor.userId) throw unprocessable('CANNOT_DELETE_SELF', 'You cannot delete your own account', { i18nKey: 'users.errors.cannotDeleteSelf' });
  const user = await loadUser(id);
  if (user.role === 'admin') {
    const admins = await one(`SELECT count(*)::int AS n FROM users WHERE role = 'admin' AND deleted_at IS NULL`);
    if (admins.n <= 1) throw unprocessable('LAST_ADMIN', 'The last administrator cannot be removed', { i18nKey: 'users.errors.lastAdmin' });
  }
  await withTransaction(async (client) => {
    if (user.profile?.type === 'player') {
      await query(`UPDATE team_players SET left_at = GREATEST($2::date, joined_at), status = 'left' WHERE player_id = $1 AND left_at IS NULL`, [user.profile.id, todayISO()], client);
      await query(`UPDATE players SET deleted_at = now(), status = 'inactive' WHERE id = $1`, [user.profile.id], client);
    }
    if (user.profile?.type === 'coach') {
      await query(`DELETE FROM coach_teams WHERE coach_id = $1`, [user.profile.id], client);
      await query(`UPDATE coaches SET deleted_at = now(), status = 'inactive' WHERE id = $1`, [user.profile.id], client);
    }
    await query(`UPDATE users SET deleted_at = now(), status = 'inactive', updated_by = $2 WHERE id = $1`, [id, actor.userId], client);
    await query(`UPDATE user_sessions SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL`, [id], client);
    await audit(client, actor, 'user.deleted', 'user', id, { email: user.email, role: user.role });
  });
  return { ok: true };
}

// ------------------------------------------------------------------ own profile & settings

export const profile = (actor) => publicUser(actor.userId);

/**
 * Generic own-profile update (name, email, phone, avatar). Players use /player/profile for their
 * extended fields; their name stays managed by the federation.
 */
export async function updateProfile(actor, data) {
  if (actor.role === 'player' && data.name !== undefined) {
    throw new AppError(403, 'FIELD_NOT_EDITABLE', 'Players cannot change their registered name', { i18nKey: 'errors.forbidden', fields: { name: 'errors.forbidden' } });
  }
  await withTransaction(async (client) => {
    const avatar = await resolveImageField(data.avatar ?? data.photo, actor.role === 'admin' ? 'users' : `${actor.role}s`);
    const cols = {};
    if (data.name !== undefined) Object.assign(cols, splitName(data.name));
    if (data.email !== undefined) cols.email = data.email;
    if (data.phone !== undefined) cols.phone = data.phone;
    if (avatar !== undefined) cols.avatar_url = avatar;
    const keys = Object.keys(cols);
    if (keys.length) await query(`UPDATE users SET ${keys.map((k, i) => `${k} = $${i + 2}`).join(', ')}, updated_by = $1 WHERE id = $1`, [actor.userId, ...keys.map((k) => cols[k])], client);
    if (data.phone !== undefined && actor.coachId) await query(`UPDATE coaches SET phone = $2 WHERE id = $1`, [actor.coachId, data.phone], client);
    await audit(client, actor, 'profile.updated', 'user', actor.userId, { fields: keys });
  });
  return publicUser(actor.userId);
}

export async function getSettings(actor) {
  const [u, prefs] = await Promise.all([one(`SELECT language, theme FROM users WHERE id = $1`, [actor.userId]), getPreferences(actor.userId)]);
  return { language: u.language, theme: u.theme, notifications: prefs };
}

export async function updateSettings(actor, { language, theme, notifications }) {
  await withTransaction(async (client) => {
    const cols = {};
    if (language) cols.language = language;
    if (theme) cols.theme = theme;
    const keys = Object.keys(cols);
    if (keys.length) await query(`UPDATE users SET ${keys.map((k, i) => `${k} = $${i + 2}`).join(', ')} WHERE id = $1`, [actor.userId, ...keys.map((k) => cols[k])], client);
    if (notifications) await updatePreferences(actor.userId, notifications, client);
  });
  return getSettings(actor);
}
