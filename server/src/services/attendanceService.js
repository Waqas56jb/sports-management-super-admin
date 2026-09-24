/**
 * Attendance: aggregates and register history for admins and coaches (team-scoped), single-record
 * writes, and the player's own read-only attendance. Rate = (present + late) ÷ recorded sessions.
 */
import { many, one, withTransaction } from '../config/database.js';
import { conflict, notFound, unprocessable } from '../utils/errors.js';
import { SqlBuilder } from '../utils/filters.js';
import { assertTeamAccess, isCoach, teamScope } from '../utils/permissions.js';
import { buildPagination, paginateArray, parsePagination } from '../utils/pagination.js';
import { todayISO } from '../utils/dates.js';
import { summarizeRecords } from '../utils/statistics.js';
import { audit, cleanSession, playerSummaries, SESSION_SELECT, teamSummaries } from './shared.js';
import { attendanceGroups, attendanceTrend } from './statisticsService.js';
import { notifyAttendanceUpdate } from './notificationService.js';

const LIMITS = { day: 21, week: 12, month: 6 };

function scopeTeams(actor, teamId) {
  const scope = teamScope(actor);
  if (teamId) {
    if (scope && !scope.includes(teamId)) assertTeamAccess(actor, teamId);
    return [teamId];
  }
  return scope ?? undefined;
}

export async function overview(actor, q = {}) {
  const teamIds = scopeTeams(actor, q.team_id);
  const filters = { teamIds, playerId: q.player_id, sessionId: q.session_id, from: q.date_from, to: q.date_to };
  const coach = isCoach(actor);
  const granularity = coach ? (['day', 'week', 'month'].includes(q.granularity) ? q.granularity : 'week') : 'week';

  const [summary, byTeam, byPlayer, bySession, trend] = await Promise.all([
    attendanceGroups(filters),
    attendanceGroups({ ...filters, groupBy: 'team' }),
    attendanceGroups({ ...filters, groupBy: 'player' }),
    attendanceGroups({ ...filters, groupBy: 'session' }),
    attendanceTrend({ ...filters, granularity, keyName: coach ? 'key' : 'week', limit: coach ? LIMITS[granularity] : undefined }),
  ]);
  const [teams, players, sessions] = await Promise.all([
    teamSummaries(Object.keys(byTeam)),
    playerSummaries(Object.keys(byPlayer)),
    Object.keys(bySession).length ? many(`${SESSION_SELECT} WHERE s.id = ANY($1::uuid[])`, [Object.keys(bySession)]) : [],
  ]);
  const playerTeams = await teamSummaries([...new Set(Object.values(players).map((p) => p?.team_id).filter(Boolean))]);

  const result = {
    summary,
    byTeam: Object.entries(byTeam).map(([id, s]) => ({ team: teams[id] ?? null, ...s })),
    trend,
    players: Object.entries(byPlayer)
      .filter(([id]) => players[id])
      .map(([id, s]) => ({ player: players[id], team: playerTeams[players[id].team_id] ?? null, ...s }))
      .sort((a, b) => (a.rate ?? 101) - (b.rate ?? 101)),
    sessions: sessions
      .map((s) => ({ session: cleanSession(s), ...bySession[s.id] }))
      .sort((a, b) => b.session.date.localeCompare(a.session.date)),
  };

  if (coach) {
    const ids = teamIds ?? actor.teamIds;
    result.pending = (
      await many(
        `${SESSION_SELECT} WHERE s.team_id = ANY($1::uuid[]) AND s.status <> 'cancelled' AND s.date <= $2
           AND NOT EXISTS (SELECT 1 FROM training_attendance a WHERE a.training_session_id = s.id) ORDER BY s.date DESC`,
        [ids, todayISO()],
      )
    ).map(cleanSession);
  }
  return result;
}

export async function records(actor, q = {}) {
  const p = parsePagination(q, { defaultLimit: 10 });
  const teamIds = scopeTeams(actor, q.team_id);
  const b = new SqlBuilder();
  if (teamIds) b.where('s.team_id = ANY(?::uuid[])', teamIds);
  b.whereIf(q.player_id, 'a.player_id = ?', q.player_id);
  b.whereIf(q.session_id, 'a.training_session_id = ?', q.session_id);
  b.whereIf(q.status, 'a.status = ?', q.status);
  b.whereIf(q.date_from, 's.date >= ?', q.date_from);
  b.whereIf(q.date_to, 's.date <= ?', q.date_to);
  const params = [...b.params];
  const from = `FROM training_attendance a JOIN v_training_sessions s ON s.id = a.training_session_id`;
  const [rows, count] = await Promise.all([
    many(`SELECT a.id, a.training_session_id, a.player_id, a.status, a.notes, a.marked_by, a.marked_at ${from} ${b.clause}
          ORDER BY s.date DESC, s.start_time DESC, a.player_id LIMIT $${params.length + 1} OFFSET $${params.length + 2}`, [...params, p.limit, p.offset]),
    one(`SELECT count(*)::int AS total ${from} ${b.clause}`, params),
  ]);
  const [sessions, people] = await Promise.all([
    rows.length ? many(`${SESSION_SELECT} WHERE s.id = ANY($1::uuid[])`, [[...new Set(rows.map((r) => r.training_session_id))]]) : [],
    playerSummaries(rows.map((r) => r.player_id)),
  ]);
  const byId = Object.fromEntries(sessions.map((s) => [s.id, cleanSession(s)]));
  return {
    rows: rows.map((r) => ({ ...r, session: byId[r.training_session_id], player: people[r.player_id] ?? null })),
    pagination: buildPagination(count.total, p),
  };
}

async function loadRecord(actor, id, client) {
  const r = await one(
    `SELECT a.*, s.team_id, s.date, s.status AS session_status FROM training_attendance a JOIN v_training_sessions s ON s.id = a.training_session_id WHERE a.id = $1`,
    [id],
    client,
  );
  if (!r) throw notFound('Attendance record');
  assertTeamAccess(actor, r.team_id);
  return r;
}

/** POST /attendance — one register line. A second line for the same player and session is rejected (409). */
export async function create(actor, { training_session_id: sessionId, player_id: playerId, status, notes = '' }) {
  const id = await withTransaction(async (client) => {
    const session = await one(`SELECT id, team_id, date, status FROM v_training_sessions WHERE id = $1`, [sessionId], client);
    if (!session) throw notFound('Training session');
    assertTeamAccess(actor, session.team_id);
    if (session.status === 'cancelled') throw unprocessable('SESSION_CANCELLED', 'Attendance cannot be taken for a cancelled session', { i18nKey: 'training.errors.cancelled' });
    if (session.date > todayISO()) throw unprocessable('SESSION_IN_FUTURE', 'Attendance can only be recorded from the day of the session', { i18nKey: 'training.errors.future' });
    const player = await one(`SELECT id FROM players WHERE id = $1 AND team_id = $2 AND deleted_at IS NULL`, [playerId, session.team_id], client);
    if (!player) throw unprocessable('PLAYER_NOT_IN_TEAM', 'The player does not belong to the session’s team', { fields: { player_id: 'errors.forbidden' } });
    const exists = await one(`SELECT id FROM training_attendance WHERE training_session_id = $1 AND player_id = $2`, [sessionId, playerId], client);
    if (exists) throw conflict('DUPLICATE_ATTENDANCE', 'Attendance for this player and session already exists', { fields: { player_id: 'errors.generic' } });
    const row = await one(
      `INSERT INTO training_attendance (training_session_id, player_id, status, notes, marked_by) VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [sessionId, playerId, status, notes, actor.userId],
      client,
    );
    await notifyAttendanceUpdate(client, session, [playerId]);
    await audit(client, actor, 'attendance.created', 'attendance', row.id, { session_id: sessionId, player_id: playerId, status });
    return row.id;
  });
  return one(`SELECT * FROM training_attendance WHERE id = $1`, [id]);
}

export async function update(actor, id, { status, notes }) {
  return withTransaction(async (client) => {
    const r = await loadRecord(actor, id, client);
    const row = await one(
      `UPDATE training_attendance SET status = coalesce($2, status), notes = coalesce($3, notes), marked_by = $4, marked_at = now() WHERE id = $1 RETURNING *`,
      [id, status ?? null, notes ?? null, actor.userId],
      client,
    );
    if (status && status !== r.status) await notifyAttendanceUpdate(client, r, [r.player_id]);
    await audit(client, actor, 'attendance.updated', 'attendance', id, { from: r.status, to: row.status, notes: row.notes });
    return row;
  });
}

// ------------------------------------------------------------------ player (read-only)

/**
 * The player's own register lines. "pending" = a past session of the team with no register yet;
 * sessions before the player joined (register exists without them) are skipped.
 */
export async function mine(actor, q = {}) {
  const today = todayISO();
  const b = new SqlBuilder();
  b.where('s.team_id = ?', actor.teamId);
  b.where("s.status <> 'cancelled'");
  b.where('s.date <= ?', today);
  b.whereIf(q.date_from, 's.date >= ?', q.date_from);
  b.whereIf(q.date_to, 's.date <= ?', q.date_to);
  b.whereIf(q.type, 's.training_type = ?', q.type);
  const rows = await many(
    `${SESSION_SELECT.replace('SELECT s.*', `SELECT s.*, a.id AS att_id, a.status AS att_status, a.notes AS att_notes,
        EXISTS (SELECT 1 FROM training_attendance x WHERE x.training_session_id = s.id) AS has_register`)}
     LEFT JOIN training_attendance a ON a.training_session_id = s.id AND a.player_id = ${b.bind(actor.playerId)}
     ${b.clause} ORDER BY s.date DESC, s.start_time DESC`,
    b.params,
  );
  const all = rows
    .filter((r) => r.att_id || !r.has_register)
    .map((r) => {
      const { att_id: attId, att_status: st, att_notes: notes, has_register: _h, notes: _coach, ...session } = r;
      return { id: attId ?? `pending-${r.id}`, status: st ?? 'pending', notes: notes ?? '', session };
    });
  const recorded = all.filter((r) => r.status !== 'pending');
  const summary = { ...summarizeRecords(recorded), pending: all.length - recorded.length, sessions: all.length };

  const months = {};
  recorded.forEach((r) => {
    (months[r.session.date.slice(0, 7)] ??= []).push(r);
  });
  const monthly = Object.keys(months).sort().map((m) => ({ month: `${m}-01`, ...summarizeRecords(months[m]) }));

  let attended = 0;
  const trend = [...recorded].reverse().map((r, i) => {
    if (r.status === 'present' || r.status === 'late') attended += 1;
    return { date: r.session.date, rate: Math.round((attended / (i + 1)) * 1000) / 10 };
  });

  const history = q.status ? all.filter((r) => r.status === q.status) : all;
  const page = paginateArray(history, { ...q, pageSize: q.limit ?? q.pageSize ?? 10 });
  return {
    summary,
    monthly,
    trend,
    history: { data: page.rows, total: page.pagination.total, page: page.pagination.page, pageSize: page.pagination.limit, pages: page.pagination.totalPages },
  };
}

