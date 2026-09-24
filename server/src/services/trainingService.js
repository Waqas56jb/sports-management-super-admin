/**
 * Training sessions (admin: every team; coach: assigned teams; player: read-only own team),
 * attendance registers and the calendar feed.
 */
import { many, one, pool, query, withTransaction } from '../config/database.js';
import { TRAINING_LABELS } from '../config/constants.js';
import { forbidden, notFound, unprocessable } from '../utils/errors.js';
import { SqlBuilder } from '../utils/filters.js';
import { assertTeamAccess, isAdmin, isCoach, isPlayer, teamScope } from '../utils/permissions.js';
import { buildPagination, parsePagination } from '../utils/pagination.js';
import { todayISO } from '../utils/dates.js';
import { summarizeCounts, summarizeRecords } from '../utils/statistics.js';
import { audit, cleanSession, MATCH_SELECT, playerSummaries, SESSION_SELECT, teamJson } from './shared.js';
import { notifyAttendanceUpdate, notifyTrainingReminder } from './notificationService.js';
import { sessionWithMyAttendance } from './playerService.js';

async function loadSession(id, client = pool) {
  const s = await one(`${SESSION_SELECT} WHERE s.id = $1`, [id], client);
  if (!s) throw notFound('Training session');
  return s;
}

async function loadOwned(actor, id, client = pool) {
  const s = await loadSession(id, client);
  assertTeamAccess(actor, s.team_id);
  return s;
}

/** attendance_rate + attendance_recorded for a page of sessions (one query). */
async function withAttendance(sessions, client = pool) {
  if (!sessions.length) return sessions;
  const rows = await many(
    `SELECT a.training_session_id AS id,
            (count(*) FILTER (WHERE a.status = 'present'))::int AS present, (count(*) FILTER (WHERE a.status = 'absent'))::int AS absent,
            (count(*) FILTER (WHERE a.status = 'late'))::int AS late, (count(*) FILTER (WHERE a.status = 'excused'))::int AS excused,
            count(*)::int AS lines
     FROM training_attendance a WHERE a.training_session_id = ANY($1::uuid[]) GROUP BY a.training_session_id`,
    [sessions.map((s) => s.id)],
    client,
  );
  const by = Object.fromEntries(rows.map((r) => [r.id, r]));
  return sessions.map((s) => ({ ...s, attendance_rate: by[s.id] ? summarizeCounts(by[s.id]).rate : null, attendance_recorded: Boolean(by[s.id]?.lines) }));
}

// ------------------------------------------------------------------ reads

export async function list(actor, q = {}) {
  const p = parsePagination(q, { defaultLimit: 10 });
  const today = todayISO();
  const scope = teamScope(actor);
  const b = new SqlBuilder();
  if (scope) b.where('s.team_id = ANY(?::uuid[])', scope);
  b.whereIf(q.team_id, 's.team_id = ?', q.team_id);
  b.whereIf(q.type, 's.training_type = ?', q.type);
  b.whereIf(q.status, 's.status = ?', q.status);
  const when = isPlayer(actor) ? q.tab ?? 'upcoming' : q.when;
  if (when === 'cancelled') b.where("s.status = 'cancelled'");
  if (when === 'upcoming') b.where(isAdmin(actor) ? 's.date >= ?' : "s.status <> 'cancelled' AND s.date >= ?", today);
  if (when === 'completed') b.where(isAdmin(actor) ? 's.date < ?' : "s.status <> 'cancelled' AND s.date < ?", today);
  b.whereIf(q.date_from, 's.date >= ?', q.date_from);
  b.whereIf(q.date_to, 's.date <= ?', q.date_to);
  if (q.search) {
    const labels = Object.entries(TRAINING_LABELS).filter(([, names]) => names.some((n) => n.toLowerCase().includes(String(q.search).toLowerCase()))).map(([k]) => k);
    const inner = new SqlBuilder(b.params).search(q.search, ['st.name', 's.location', 's.description', ...(isPlayer(actor) ? [] : ['s.notes'])]);
    const searchSql = inner.parts[0];
    if (labels.length) b.parts.push(`(${searchSql} OR s.training_type = ANY(${b.bind(labels)}::text[]))`);
    else b.parts.push(searchSql);
  }
  const asc = q.sortOrder ? String(q.sortOrder).toLowerCase() === 'asc' : isAdmin(actor) ? when !== 'completed' : when === 'upcoming';
  const dir = asc ? 'ASC' : 'DESC';
  const params = [...b.params];
  const [rows, count] = await Promise.all([
    many(`${SESSION_SELECT} ${b.clause} ORDER BY s.date ${dir}, s.start_time ${dir}, s.id LIMIT $${params.length + 1} OFFSET $${params.length + 2}`, [...params, p.limit, p.offset]),
    one(`SELECT count(*)::int AS total FROM v_training_sessions s JOIN teams st ON st.id = s.team_id ${b.clause}`, params),
  ]);
  const data = isPlayer(actor) ? await sessionWithMyAttendance(rows, actor.playerId) : (await withAttendance(rows)).map(cleanSession);
  return { rows: data, pagination: buildPagination(count.total, p) };
}

export async function counts(actor) {
  const scope = teamScope(actor);
  const row = await one(
    `SELECT (count(*) FILTER (WHERE status <> 'cancelled' AND date >= $2))::int AS upcoming,
            (count(*) FILTER (WHERE status <> 'cancelled' AND date < $2))::int AS completed,
            (count(*) FILTER (WHERE status = 'cancelled'))::int AS cancelled
     FROM v_training_sessions WHERE ($1::uuid[] IS NULL OR team_id = ANY($1::uuid[]))`,
    [scope, todayISO()],
  );
  return row;
}

/** Past, non-cancelled sessions for attendance filters. */
export async function options(actor, q = {}) {
  const scope = teamScope(actor);
  const b = new SqlBuilder();
  if (scope) b.where('s.team_id = ANY(?::uuid[])', scope);
  b.whereIf(q.team_id, 's.team_id = ?', q.team_id);
  b.where("s.status <> 'cancelled'");
  b.where('s.date <= ?', todayISO());
  return many(
    `SELECT s.id, s.date, s.start_time, s.training_type, ${teamJson('st')} AS team
     FROM v_training_sessions s JOIN teams st ON st.id = s.team_id ${b.clause} ORDER BY s.date DESC, s.start_time DESC LIMIT 60`,
    b.params,
  );
}

async function register(session, client = pool) {
  const [records, squad] = await Promise.all([
    many(`SELECT id, player_id, status, notes, marked_at FROM training_attendance WHERE training_session_id = $1`, [session.id], client),
    many(`SELECT id, status FROM players WHERE team_id = $1 AND deleted_at IS NULL AND status <> 'inactive'`, [session.team_id], client),
  ]);
  const people = await playerSummaries([...squad.map((p) => p.id), ...records.map((r) => r.player_id)], client);
  const recorded = Object.fromEntries(records.map((r) => [r.player_id, r]));
  const rows = squad.map((p) => ({ player: people[p.id], player_status: p.status, status: recorded[p.id]?.status ?? null, notes: recorded[p.id]?.notes ?? '', record_id: recorded[p.id]?.id ?? null }));
  // Players who attended but have since left the team still appear in the register.
  records.filter((r) => !squad.some((p) => p.id === r.player_id)).forEach((r) => rows.push({ player: people[r.player_id], status: r.status, notes: r.notes, record_id: r.id }));
  rows.sort((a, b) => (a.player?.jersey_number ?? 99) - (b.player?.jersey_number ?? 99));
  return { register: rows, summary: summarizeRecords(records) };
}

export async function get(actor, id) {
  const session = await loadOwned(actor, id);
  if (isPlayer(actor)) return (await sessionWithMyAttendance([session], actor.playerId))[0];
  const [withRate] = await withAttendance([session]);
  return { ...cleanSession(withRate), ...(await register(session)) };
}

export async function attendanceFor(actor, id) {
  const session = await loadOwned(actor, id);
  if (isPlayer(actor)) throw forbidden();
  return register(session);
}

// ------------------------------------------------------------------ writes

async function assertNoOverlap(client, values, exceptId) {
  const clash = await one(
    `SELECT id FROM training_sessions WHERE deleted_at IS NULL AND status <> 'cancelled' AND team_id = $1 AND date = $2
       AND start_time < $4::time AND $3::time < end_time AND ($5::uuid IS NULL OR id <> $5) LIMIT 1`,
    [values.team_id, values.date, values.start_time, values.end_time, exceptId ?? null],
    client,
  );
  if (clash) throw unprocessable('TRAINING_OVERLAP', 'This team already has a session at that time', { i18nKey: 'training.errors.overlap', fields: { start_time: 'training.errors.overlap' } });
}

const COLUMN = { team_id: 'team_id', title: 'title', training_type: 'type', date: 'date', start_time: 'start_time', end_time: 'end_time', location: 'location', description: 'description', objectives: 'objectives', notes: 'notes', status: 'status' };

export async function create(actor, data) {
  assertTeamAccess(actor, data.team_id);
  const id = await withTransaction(async (client) => {
    if (data.end_time <= data.start_time) throw unprocessable('INVALID_TIME_RANGE', 'End time must be after start time', { i18nKey: 'validation.endAfterStart', fields: { end_time: 'validation.endAfterStart' } });
    await assertNoOverlap(client, data);
    const team = await one(`SELECT id, coach_id, home_ground FROM v_teams WHERE id = $1`, [data.team_id], client);
    if (!team) throw notFound('Team');
    const coachId = isCoach(actor) ? actor.coachId : team.coach_id;
    const cols = Object.keys(COLUMN).filter((k) => data[k] !== undefined && k !== 'status');
    const row = await one(
      `INSERT INTO training_sessions (${cols.map((k) => COLUMN[k]).join(', ')}, coach_id, created_by, updated_by)
       VALUES (${cols.map((_, i) => `$${i + 1}`).join(', ')}, $${cols.length + 1}, $${cols.length + 2}, $${cols.length + 2}) RETURNING id`,
      [...cols.map((k) => data[k]), coachId, actor.userId],
      client,
    );
    const session = await loadSession(row.id, client);
    await notifyTrainingReminder(client, session, 'created', { actorUserId: actor.userId });
    await audit(client, actor, 'training.created', 'training', row.id, data);
    return row.id;
  });
  return cleanSession(await loadSession(id));
}

export async function update(actor, id, data) {
  await withTransaction(async (client) => {
    const current = await loadOwned(actor, id, client);
    if (data.team_id) assertTeamAccess(actor, data.team_id);
    const next = { ...current, ...data, team_id: data.team_id ?? current.team_id };
    if (next.end_time <= next.start_time) throw unprocessable('INVALID_TIME_RANGE', 'End time must be after start time', { i18nKey: 'validation.endAfterStart', fields: { end_time: 'validation.endAfterStart' } });
    if (current.status !== 'cancelled') await assertNoOverlap(client, next, id);
    const cols = Object.keys(COLUMN).filter((k) => data[k] !== undefined && k !== 'status');
    if (data.team_id && data.team_id !== current.team_id) {
      await query(`DELETE FROM training_attendance WHERE training_session_id = $1`, [id], client);
      const team = await one(`SELECT coach_id FROM v_teams WHERE id = $1`, [data.team_id], client);
      await query(`UPDATE training_sessions SET coach_id = $2 WHERE id = $1`, [id, isCoach(actor) ? actor.coachId : team?.coach_id ?? null], client);
    }
    if (cols.length) await query(`UPDATE training_sessions SET ${cols.map((k, i) => `${COLUMN[k]} = $${i + 2}`).join(', ')}, updated_by = $${cols.length + 2} WHERE id = $1`, [id, ...cols.map((k) => data[k]), actor.userId], client);
    const changedSchedule = ['date', 'start_time', 'end_time', 'location', 'team_id'].some((k) => data[k] !== undefined && data[k] !== current[k]);
    if (changedSchedule && current.status !== 'cancelled') await notifyTrainingReminder(client, await loadSession(id, client), 'updated', { actorUserId: actor.userId });
    await audit(client, actor, 'training.updated', 'training', id, data);
  });
  return cleanSession(await loadSession(id));
}

export async function cancel(actor, id, reason = '') {
  await withTransaction(async (client) => {
    const s = await loadOwned(actor, id, client);
    if (s.status === 'cancelled') return;
    await query(`UPDATE training_sessions SET status = 'cancelled', cancellation_reason = $2, cancellation_key = NULL, updated_by = $3 WHERE id = $1`, [id, reason.trim(), actor.userId], client);
    await notifyTrainingReminder(client, s, 'cancelled', { actorUserId: actor.userId });
    await audit(client, actor, 'training.cancelled', 'training', id, { reason });
  });
  return cleanSession(await loadSession(id));
}

export async function restore(actor, id) {
  await withTransaction(async (client) => {
    const s = await loadOwned(actor, id, client);
    if (s.status !== 'cancelled') return;
    await assertNoOverlap(client, s, id);
    await query(`UPDATE training_sessions SET status = 'scheduled', cancellation_reason = '', cancellation_key = NULL, updated_by = $2 WHERE id = $1`, [id, actor.userId], client);
    await notifyTrainingReminder(client, s, 'restored', { actorUserId: actor.userId });
    await audit(client, actor, 'training.restored', 'training', id);
  });
  return cleanSession(await loadSession(id));
}

/** Soft delete (admin): the session disappears from schedules; its register is kept for history. */
export async function remove(actor, id) {
  await withTransaction(async (client) => {
    await loadSession(id, client);
    await query(`UPDATE training_sessions SET deleted_at = now(), updated_by = $2 WHERE id = $1`, [id, actor.userId], client);
    await audit(client, actor, 'training.deleted', 'training', id);
  });
  return { ok: true };
}

// ------------------------------------------------------------------ attendance register

async function assertRegisterOpen(session) {
  if (session.status === 'cancelled') throw unprocessable('SESSION_CANCELLED', 'Attendance cannot be taken for a cancelled session', { i18nKey: 'training.errors.cancelled' });
  if (session.date > todayISO()) throw unprocessable('SESSION_IN_FUTURE', 'Attendance can only be recorded from the day of the session', { i18nKey: 'training.errors.future' });
}

async function assertPlayersEligible(client, session, playerIds) {
  if (!playerIds.length) return;
  const rows = await many(
    `SELECT p.id FROM players p WHERE p.id = ANY($1::uuid[]) AND p.deleted_at IS NULL
       AND (p.team_id = $2 OR EXISTS (SELECT 1 FROM training_attendance a WHERE a.training_session_id = $3 AND a.player_id = p.id))`,
    [playerIds, session.team_id, session.id],
    client,
  );
  if (rows.length !== new Set(playerIds).size) {
    throw unprocessable('PLAYER_NOT_IN_TEAM', 'Every player must belong to the session’s team', { i18nKey: 'errors.forbidden', fields: { records: 'errors.forbidden' } });
  }
}

/**
 * Replaces the register (PUT): records without a status are removed. Each written line keeps who
 * marked it and when. Players whose status changed are notified.
 */
export async function saveRegister(actor, id, records, { replace = true } = {}) {
  await withTransaction(async (client) => {
    const session = await loadOwned(actor, id, client);
    await assertRegisterOpen(session);
    const withStatus = records.filter((r) => r.status);
    await assertPlayersEligible(client, session, withStatus.map((r) => r.player_id));
    const before = Object.fromEntries((await many(`SELECT player_id, status, notes FROM training_attendance WHERE training_session_id = $1`, [id], client)).map((r) => [r.player_id, r]));
    if (replace) {
      const keep = withStatus.map((r) => r.player_id);
      await query(`DELETE FROM training_attendance WHERE training_session_id = $1 AND NOT (player_id = ANY($2::uuid[]))`, [id, keep], client);
    }
    if (withStatus.length) {
      // One statement for the whole register; marked_by / marked_at only move for lines that changed.
      const params = [id, actor.userId];
      const values = withStatus.map((r) => {
        params.push(r.player_id, r.status, r.notes ?? '');
        return `($1, $${params.length - 2}::uuid, $${params.length - 1}, $${params.length}, $2, now())`;
      });
      await query(
        `INSERT INTO training_attendance (training_session_id, player_id, status, notes, marked_by, marked_at) VALUES ${values.join(', ')}
         ON CONFLICT (training_session_id, player_id) DO UPDATE
           SET status = EXCLUDED.status, notes = EXCLUDED.notes,
               marked_by = CASE WHEN training_attendance.status IS DISTINCT FROM EXCLUDED.status OR training_attendance.notes IS DISTINCT FROM EXCLUDED.notes THEN EXCLUDED.marked_by ELSE training_attendance.marked_by END,
               marked_at = CASE WHEN training_attendance.status IS DISTINCT FROM EXCLUDED.status OR training_attendance.notes IS DISTINCT FROM EXCLUDED.notes THEN now() ELSE training_attendance.marked_at END`,
        params,
        client,
      );
    }
    const changed = withStatus.filter((r) => before[r.player_id]?.status !== r.status).map((r) => r.player_id);
    await notifyAttendanceUpdate(client, session, changed);
    await audit(client, actor, replace ? 'attendance.register_saved' : 'attendance.bulk_upsert', 'training', id, { records: withStatus.length, changed: changed.length });
  });
  return { ok: true, ...(await register(await loadSession(id))) };
}

// ------------------------------------------------------------------ calendar

export async function calendar(actor, q = {}) {
  const scope = teamScope(actor);
  const teamIds = q.team_id ? [q.team_id] : scope;
  if (q.team_id && scope && !scope.includes(q.team_id)) throw forbidden('This team is not assigned to you');
  const from = q.date_from ?? null;
  const to = q.date_to ?? null;
  const types = q.type ? String(q.type).split(',') : ['training', 'match', 'competition', 'event'];
  const role = actor.role;
  const [sessions, matches, competitions, events] = await Promise.all([
    types.includes('training')
      ? many(`SELECT s.id, s.date, s.start_time, s.end_time, s.training_type, s.status, s.location, ${teamJson('st')} AS team FROM v_training_sessions s JOIN teams st ON st.id = s.team_id WHERE ($1::uuid[] IS NULL OR s.team_id = ANY($1::uuid[])) AND ($2::date IS NULL OR s.date >= $2) AND ($3::date IS NULL OR s.date <= $3)`, [teamIds, from, to])
      : [],
    types.includes('match')
      ? many(`${MATCH_SELECT} WHERE ($1::uuid[] IS NULL OR m.home_team_id = ANY($1::uuid[]) OR m.away_team_id = ANY($1::uuid[])) AND ($2::date IS NULL OR m.date >= $2) AND ($3::date IS NULL OR m.date <= $3)`, [teamIds, from, to])
      : [],
    types.includes('competition')
      ? many(`SELECT c.id, c.name, c.season, c.start_date, c.end_date FROM v_competitions c WHERE ($1::uuid[] IS NULL OR c.team_ids && $1::uuid[]) AND ($3::date IS NULL OR c.start_date <= $3) AND ($2::date IS NULL OR c.end_date >= $2)`, [teamIds, from, to])
      : [],
    types.includes('event') && !isAdmin(actor)
      ? many(`SELECT id, team_id, kind, title, date, to_char(start_time, 'HH24:MI') AS start, to_char(end_time, 'HH24:MI') AS "end", location FROM team_events WHERE ($1::uuid[] IS NULL OR team_id = ANY($1::uuid[])) AND ($2::date IS NULL OR date >= $2) AND ($3::date IS NULL OR date <= $3)`, [teamIds, from, to])
      : [],
  ]);
  const inRange = (d) => (!from || d >= from) && (!to || d <= to);
  const out = [];
  sessions.forEach((s) => out.push({ id: s.id, kind: 'training', type: 'training', title: `${s.team?.name ?? ''} — ${TRAINING_LABELS[s.training_type]?.[0] ?? s.training_type}`, date: s.date, start: s.start_time, end: s.end_time, team: s.team, training_type: s.training_type, cancelled: s.status === 'cancelled', location: s.location, referenceId: s.id, link: `/${role}/training/${s.id}` }));
  matches.forEach((m) => out.push({ id: m.id, kind: 'match', type: 'match', title: `${m.home_team.name} vs ${m.away_team.name}`, date: m.date, start: m.time, status: m.status, cancelled: m.status === 'cancelled', home: m.home_team, away: m.away_team, score: m.home_score === null ? null : `${m.home_score}–${m.away_score}`, location: m.location, referenceId: m.id, link: `/${role}/matches/${m.id}` }));
  events.forEach((e) => out.push({ id: e.id, kind: 'event', type: 'event', title: e.title || e.kind, date: e.date, start: e.start, end: e.end, event_kind: e.kind, location: e.location, referenceId: e.id, link: `/${role}/calendar?view=day` }));
  competitions.forEach((c) => {
    if (inRange(c.start_date)) out.push({ id: `${c.id}-start`, kind: 'competition', type: 'competition', title: `${c.name} ${c.season}`, date: c.start_date, name: c.name, season: c.season, edge: 'start', referenceId: c.id, link: `/${role}/competitions/${c.id}` });
    if (inRange(c.end_date)) out.push({ id: `${c.id}-end`, kind: 'competition', type: 'competition', title: `${c.name} ${c.season}`, date: c.end_date, name: c.name, season: c.season, edge: 'end', referenceId: c.id, link: `/${role}/competitions/${c.id}` });
  });
  for (const e of out) {
    e.start_at = e.start ? `${e.date}T${e.start}` : e.date;
    e.end_at = e.end ? `${e.date}T${e.end}` : null;
  }
  return out.sort((a, b) => `${a.date}${a.start ?? '00:00'}`.localeCompare(`${b.date}${b.start ?? '00:00'}`));
}
