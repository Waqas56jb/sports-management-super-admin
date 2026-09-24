/**
 * Notifications: one central place creates them (respecting each user's preferences) and every
 * app reads its own inbox. Rows store a category (`type`), the UI sub-type, a translation template
 * with params, an English title/message and a generic reference that becomes a deep link per app.
 */
import { many, one, pool, query } from '../config/database.js';
import { DEFAULT_PREFERENCES, NOTIFICATION_SUBTYPES, NOTIFICATION_TYPES, PREFERENCE_SUBTYPES } from '../config/constants.js';
import { notFound } from '../utils/errors.js';
import { SqlBuilder } from '../utils/filters.js';
import { buildPagination, parsePagination } from '../utils/pagination.js';
import { hasTemplate, linkFor, renderTemplate } from '../utils/notificationTemplates.js';
import { formatLongDate } from '../utils/dates.js';

// ------------------------------------------------------------------ serialisation

export function serializeNotification(row, role) {
  return {
    id: row.id,
    user_id: row.user_id,
    type: row.subtype,
    category: row.type,
    template: row.template,
    params: row.params ?? {},
    title: row.title,
    message: row.message,
    reference_type: row.reference_type,
    reference_id: row.reference_id,
    link: linkFor(role, row.reference_type, row.reference_id, row.link_query),
    is_read: row.is_read,
    read_at: row.read_at,
    created_at: row.created_at,
  };
}

/** Player filter chips → notification categories. */
const PLAYER_CATEGORIES = {
  matches: ['match'],
  training: ['training', 'attendance'],
  team: ['team', 'announcement', 'competition'],
  system: ['system'],
};

// ------------------------------------------------------------------ inbox

export async function list(actor, q) {
  const p = parsePagination(q, { defaultLimit: 10 });
  const b = new SqlBuilder();
  b.where('n.user_id = ?', actor.userId);
  if (q.status === 'unread') b.where('n.is_read = false');
  if (q.status === 'read') b.where('n.is_read = true');
  // `type` may be a category (match, training…) or a UI sub-type (match_reminder…).
  if (q.type) b.where(NOTIFICATION_TYPES.includes(q.type) ? 'n.type = ?' : 'n.subtype = ?', q.type);
  if (q.category && PLAYER_CATEGORIES[q.category]) b.where('n.type = ANY(?::text[])', PLAYER_CATEGORIES[q.category]);
  b.search(q.search, ['n.title', 'n.message']);
  const params = [...b.params];
  const [rows, count] = await Promise.all([
    many(`SELECT n.* FROM notifications n ${b.clause} ORDER BY n.created_at DESC, n.id LIMIT $${params.length + 1} OFFSET $${params.length + 2}`, [...params, p.limit, p.offset]),
    one(`SELECT count(*)::int AS total FROM notifications n ${b.clause}`, params),
  ]);
  return { rows: rows.map((r) => serializeNotification(r, actor.role)), pagination: buildPagination(count.total, p) };
}

export async function unreadCount(actor) {
  const row = await one(`SELECT count(*)::int AS count FROM notifications WHERE user_id = $1 AND is_read = false`, [actor.userId]);
  return { count: row.count };
}

export async function setRead(actor, id, isRead = true) {
  const row = await one(
    `UPDATE notifications SET is_read = $3, read_at = CASE WHEN $3 THEN now() ELSE NULL END WHERE id = $1 AND user_id = $2 RETURNING *`,
    [id, actor.userId, isRead],
  );
  if (!row) throw notFound('Notification');
  return serializeNotification(row, actor.role);
}

export async function markAllRead(actor) {
  const res = await query(`UPDATE notifications SET is_read = true, read_at = now() WHERE user_id = $1 AND is_read = false`, [actor.userId]);
  return { updated: res.rowCount };
}

export async function remove(actor, id) {
  const res = await query(`DELETE FROM notifications WHERE id = $1 AND user_id = $2`, [id, actor.userId]);
  if (!res.rowCount) throw notFound('Notification');
  return { ok: true };
}

// ------------------------------------------------------------------ preferences

export async function getPreferences(userId, client = pool) {
  const row = await one(`SELECT * FROM notification_preferences WHERE user_id = $1`, [userId], client);
  return Object.fromEntries(Object.keys(DEFAULT_PREFERENCES).map((k) => [k, row ? row[k] : DEFAULT_PREFERENCES[k]]));
}

export async function updatePreferences(userId, patch, client = pool) {
  const next = { ...(await getPreferences(userId, client)), ...patch };
  const keys = Object.keys(DEFAULT_PREFERENCES);
  await query(
    `INSERT INTO notification_preferences (user_id, ${keys.join(', ')}) VALUES ($1, ${keys.map((_, i) => `$${i + 2}`).join(', ')})
     ON CONFLICT (user_id) DO UPDATE SET ${keys.map((k) => `${k} = EXCLUDED.${k}`).join(', ')}`,
    [userId, ...keys.map((k) => Boolean(next[k]))],
    client,
  );
  return next;
}

// ------------------------------------------------------------------ creation (central)

/** Users who opted out of a sub-type. */
async function mutedUsers(client, userIds, subtype) {
  const pref = Object.entries(PREFERENCE_SUBTYPES).find(([, list]) => list.includes(subtype))?.[0];
  if (!pref || !userIds.length) return new Set();
  const defaultOn = DEFAULT_PREFERENCES[pref];
  const rows = await many(`SELECT user_id, ${pref} AS enabled FROM notification_preferences WHERE user_id = ANY($1::uuid[])`, [userIds], client);
  const explicit = Object.fromEntries(rows.map((r) => [r.user_id, r.enabled]));
  return new Set(userIds.filter((id) => !(explicit[id] ?? defaultOn)));
}

/**
 * notify(client, recipients, spec)
 *   recipients: [{ id, role }]
 *   spec: { subtype, templates: { admin|coach|player: { template, params } }, fallback: { title, message },
 *           referenceType, referenceId, linkQuery, respectPreferences = true }
 */
export async function notify(client, recipients, spec) {
  const unique = [...new Map(recipients.filter(Boolean).map((r) => [r.id, r])).values()];
  if (!unique.length) return 0;
  const muted = spec.respectPreferences === false ? new Set() : await mutedUsers(client, unique.map((r) => r.id), spec.subtype);
  const rows = unique
    .filter((r) => !muted.has(r.id))
    .map((r) => {
      const t = spec.templates?.[r.role];
      const useTemplate = t && hasTemplate(r.role, t.template);
      const text = useTemplate ? renderTemplate(r.role, t.template, t.params) : spec.fallback;
      return {
        user_id: r.id,
        type: NOTIFICATION_SUBTYPES[spec.subtype] ?? 'system',
        subtype: spec.subtype,
        title: text?.title ?? 'Notification',
        message: text?.message ?? '',
        template: useTemplate ? t.template : null,
        params: JSON.stringify(useTemplate ? t.params ?? {} : {}),
        reference_type: spec.referenceType ?? null,
        reference_id: spec.referenceId ?? null,
        link_query: spec.linkQuery ?? null,
      };
    });
  if (!rows.length) return 0;
  const cols = Object.keys(rows[0]);
  const params = [];
  const values = rows.map((row) => `(${cols.map((c) => { params.push(row[c]); return `$${params.length}`; }).join(', ')})`);
  await query(`INSERT INTO notifications (${cols.join(', ')}) VALUES ${values.join(', ')}`, params, client);
  return rows.length;
}

// ------------------------------------------------------------------ recipients

export const admins = (client) => many(`SELECT id, role FROM users WHERE role = 'admin' AND status = 'active' AND deleted_at IS NULL`, [], client);

/** Active players and coaches (head + assistant) of the given teams. */
export async function teamMembers(client, teamIds, { players = true, coaches = true } = {}) {
  const ids = teamIds.filter(Boolean);
  if (!ids.length) return [];
  const [p, c] = await Promise.all([
    players ? many(`SELECT u.id, u.role FROM v_players vp JOIN users u ON u.id = vp.user_id WHERE vp.team_id = ANY($1::uuid[]) AND vp.status = 'active' AND u.status = 'active'`, [ids], client) : [],
    coaches ? many(`SELECT DISTINCT u.id, u.role FROM coach_teams ct JOIN coaches co ON co.id = ct.coach_id AND co.deleted_at IS NULL AND co.status = 'active' JOIN users u ON u.id = co.user_id AND u.status = 'active' AND u.deleted_at IS NULL WHERE ct.team_id = ANY($1::uuid[])`, [ids], client) : [],
  ]);
  return [...p, ...c];
}

// ------------------------------------------------------------------ named generators

const teamNames = async (client, ids) => Object.fromEntries((await many(`SELECT id, name FROM teams WHERE id = ANY($1::uuid[])`, [ids], client)).map((t) => [t.id, t.name]));

/** kind: 'scheduled' | 'rescheduled' | 'live' | 'result' | 'cancelled' | 'lineup' */
export async function notifyMatchReminder(client, match, kind, { includeAdmins = true, lineupTeamId } = {}) {
  const names = await teamNames(client, [match.home_team_id, match.away_team_id]);
  const home = names[match.home_team_id];
  const away = names[match.away_team_id];
  const score = match.home_score === null || match.home_score === undefined ? '' : `${match.home_score}–${match.away_score}`;
  const members = await teamMembers(client, lineupTeamId ? [lineupTeamId] : [match.home_team_id, match.away_team_id], { coaches: kind !== 'lineup' });
  const recipients = [...members, ...(includeAdmins ? await admins(client) : [])];
  const spec = {
    scheduled: { subtype: 'match_scheduled', admin: ['match_scheduled', { home, away, date: match.date }], coach: ['match_scheduled', { home, away, date: match.date }], player: ['match_upcoming', { home, away, date: match.date, time: match.time }], fallback: [`Match scheduled`, `${home} vs ${away} on ${formatLongDate(match.date)} at ${match.time}.`] },
    rescheduled: { subtype: 'match_scheduled', admin: ['match_scheduled', { home, away, date: match.date }], coach: ['match_scheduled', { home, away, date: match.date }], player: ['match_upcoming', { home, away, date: match.date, time: match.time }], fallback: [`Match rescheduled`, `${home} vs ${away} now takes place on ${formatLongDate(match.date)} at ${match.time}.`] },
    live: { subtype: 'match_reminder', admin: ['match_live', { home, away }], coach: ['match_live', { home, away }], player: ['match_live', { home, away }], fallback: ['Match in progress', `${home} vs ${away} has kicked off.`] },
    result: { subtype: 'match_result', admin: ['match_result', { home, away, score }], coach: ['match_result', { home, away, score }], player: ['match_result', { home, away, score }], fallback: ['Full time', `Final score: ${home} ${score} ${away}.`] },
    cancelled: { subtype: 'match_scheduled', admin: ['match_cancelled', { home, away }], fallback: ['Match cancelled', `${home} vs ${away} on ${formatLongDate(match.date)} has been cancelled.`] },
    lineup: { subtype: 'lineup_announced', admin: ['lineup_announced', { team: names[lineupTeamId], home, away }], player: ['lineup_published', { home, away }], fallback: ['Line-up published', `The line-up for ${home} vs ${away} has been published.`] },
  }[kind];
  const templates = Object.fromEntries(['admin', 'coach', 'player'].filter((r) => spec[r]).map((r) => [r, { template: spec[r][0], params: spec[r][1] }]));
  return notify(client, recipients, {
    subtype: spec.subtype,
    templates,
    fallback: { title: spec.fallback[0], message: spec.fallback[1] },
    referenceType: kind === 'lineup' ? 'match_lineup' : 'match',
    referenceId: match.id,
  });
}

/** kind: 'created' | 'updated' | 'cancelled' | 'restored' */
export async function notifyTrainingReminder(client, session, kind, { actorUserId } = {}) {
  const team = (await teamNames(client, [session.team_id]))[session.team_id];
  const members = (await teamMembers(client, [session.team_id])).filter((m) => m.id !== actorUserId);
  const recipients = kind === 'created' ? [...members, ...(await admins(client))].filter((m) => m.id !== actorUserId) : members;
  const date = session.date;
  const time = session.start_time;
  const cancelled = kind === 'cancelled';
  const fallbackTitle = { created: 'New training session', updated: 'Training session updated', cancelled: 'Training cancelled', restored: 'Training session reinstated' }[kind];
  return notify(client, recipients, {
    subtype: 'training_reminder',
    templates: {
      admin: { template: 'training_created', params: { team, date } },
      coach: cancelled ? { template: 'training_cancelled', params: { team, date } } : { template: 'training_reminder', params: { team, date, time } },
      player: cancelled ? { template: 'training_cancelled', params: { date } } : kind === 'updated' ? null : { template: 'training_reminder', params: { date, time } },
    },
    fallback: { title: fallbackTitle, message: `${team}: ${formatLongDate(date)}, ${time}–${session.end_time}${session.location ? ` · ${session.location}` : ''}.` },
    referenceType: 'training',
    referenceId: session.id,
  });
}

export async function notifyAttendanceUpdate(client, session, playerIds) {
  if (!playerIds.length) return 0;
  const recipients = await many(`SELECT u.id, u.role FROM players p JOIN users u ON u.id = p.user_id WHERE p.id = ANY($1::uuid[]) AND u.status = 'active' AND u.deleted_at IS NULL`, [playerIds], client);
  return notify(client, recipients, {
    subtype: 'attendance_update',
    templates: { player: { template: 'attendance_updated', params: {} } },
    fallback: { title: 'Attendance updated', message: `Attendance for the session on ${formatLongDate(session.date)} was recorded.` },
    referenceType: 'attendance',
  });
}

/** Free-text announcement from an administrator to a list of users. */
export async function notifyTeamAnnouncement(client, recipients, { title, message }) {
  return notify(client, recipients, {
    subtype: 'team_announcement',
    templates: {},
    fallback: { title, message },
    respectPreferences: false,
  });
}

export async function notifyCompetitionUpdate(client, competition, kind, teamIds = []) {
  const members = await teamMembers(client, teamIds);
  const recipients = kind === 'created' ? [...(await admins(client)), ...members] : members;
  return notify(client, recipients, {
    subtype: 'competition_update',
    templates: {
      admin: { template: 'competition_created', params: { name: competition.name, season: competition.season } },
      coach: { template: 'competition_fixtures', params: { name: competition.name, season: competition.season } },
      player: { template: 'competition_schedule', params: { name: competition.name, season: competition.season } },
    },
    fallback: { title: 'Competition update', message: `${competition.name} ${competition.season} has been updated.` },
    referenceType: 'competition',
    referenceId: competition.id,
  });
}

/** Team assignment changes: the affected user, and the admins for coach assignments. */
export async function notifyTeamAssignment(client, { userId, role, teamId, name, isCoach }) {
  const team = teamId ? (await teamNames(client, [teamId]))[teamId] : null;
  const recipients = [{ id: userId, role }, ...(isCoach && teamId ? await admins(client) : [])];
  return notify(client, recipients, {
    subtype: isCoach ? 'account_update' : 'player_update',
    templates: isCoach && teamId ? { admin: { template: 'coach_assigned', params: { name, team } } } : {},
    fallback: team ? { title: 'Team assignment', message: `${name} is now assigned to ${team}.` } : { title: 'Team assignment', message: `${name} is no longer assigned to a team.` },
    referenceType: isCoach ? (role === 'admin' ? 'coach' : 'team') : 'team',
    referenceId: teamId ?? null,
    respectPreferences: false,
  });
}

export async function notifyAdmins(client, { subtype, template, params, fallback, referenceType, referenceId }) {
  return notify(client, await admins(client), {
    subtype,
    templates: { admin: { template, params } },
    fallback,
    referenceType,
    referenceId,
  });
}

// ------------------------------------------------------------------ announcements

export async function listAnnouncements() {
  return many(
    `SELECT a.id, a.title, a.message, a.audience, a.team_id, a.recipients, a.created_at,
            CASE WHEN t.id IS NULL THEN NULL ELSE json_build_object('id', t.id, 'name', t.name) END AS team
     FROM announcements a LEFT JOIN teams t ON t.id = a.team_id
     ORDER BY a.created_at DESC LIMIT 100`,
  );
}

export async function sendAnnouncement(client, actor, { title, message, audience, team_id: teamId }) {
  let recipients = [];
  if (audience === 'all') recipients = await many(`SELECT id, role FROM users WHERE status = 'active' AND deleted_at IS NULL`, [], client);
  if (audience === 'coaches') recipients = await many(`SELECT id, role FROM users WHERE role = 'coach' AND status = 'active' AND deleted_at IS NULL`, [], client);
  if (audience === 'players') recipients = await many(`SELECT id, role FROM users WHERE role = 'player' AND status = 'active' AND deleted_at IS NULL`, [], client);
  if (audience === 'team') {
    const team = await one(`SELECT id FROM teams WHERE id = $1 AND deleted_at IS NULL`, [teamId], client);
    if (!team) throw notFound('Team');
    recipients = await teamMembers(client, [teamId]);
  }
  await notifyTeamAnnouncement(client, recipients, { title, message });
  return one(
    `INSERT INTO announcements (title, message, audience, team_id, recipients, created_by) VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id, title, message, audience, team_id, recipients, created_at`,
    [title, message, audience, audience === 'team' ? teamId : null, recipients.length, actor.userId],
    client,
  );
}
