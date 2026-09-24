/**
 * Coaches: admin management (accounts + head-coach assignment), the coach's own profile and the
 * coach dashboard. A coach may lead several teams (coach_teams); `team_id` is their primary team.
 */
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { env } from '../config/env.js';
import { many, one, pool, query, withTransaction } from '../config/database.js';
import { notFound } from '../utils/errors.js';
import { SqlBuilder } from '../utils/filters.js';
import { addDays, toISODate, todayISO } from '../utils/dates.js';
import { buildPagination, parsePagination } from '../utils/pagination.js';
import { perspective } from '../utils/statistics.js';
import { audit, cleanSession, MATCH_SELECT, SESSION_SELECT, splitName, teamJson, teamSummaries } from './shared.js';
import { attendanceGroups, attendanceTrend, computePlayerStats, computeTeamRecords, withPlayerAndTeam } from './statisticsService.js';
import { COACH_COLUMNS } from './teamService.js';
import { notifyTeamAssignment } from './notificationService.js';
import { resolveImageField } from './storageService.js';

const COACH_SORT = { name: 'vc.name', experience: 'vc.experience', license: 'vc.license', status: 'vc.status', created_at: 'vc.created_at', coach_code: 'vc.coach_code' };

async function loadCoach(id, client = pool) {
  const c = await one(
    `SELECT ${COACH_COLUMNS}, ${teamJson('t')} AS team FROM v_coaches vc LEFT JOIN teams t ON t.id = vc.team_id WHERE vc.id = $1`,
    [id],
    client,
  );
  if (!c) throw notFound('Coach');
  return c;
}

// ------------------------------------------------------------------ admin

export async function list(q = {}) {
  const p = parsePagination(q, { defaultLimit: 10 });
  const b = new SqlBuilder();
  b.whereIf(q.status, 'vc.status = ?', q.status);
  if (q.team_id === 'none') b.where('vc.team_id IS NULL');
  else b.whereIf(q.team_id, '? = ANY(vc.team_ids)', q.team_id);
  b.search(q.search, ['vc.name', 'vc.email', 'vc.license', 'vc.coach_code']);
  const sort = COACH_SORT[q.sortBy] ?? 'vc.name';
  const dir = String(q.sortOrder).toLowerCase() === 'desc' ? 'DESC' : 'ASC';
  const params = [...b.params];
  const [rows, count] = await Promise.all([
    many(
      `SELECT ${COACH_COLUMNS}, ${teamJson('t')} AS team,
              (SELECT count(*)::int FROM players p WHERE p.team_id = vc.team_id AND p.deleted_at IS NULL) AS players_count
       FROM v_coaches vc LEFT JOIN teams t ON t.id = vc.team_id
       ${b.clause} ORDER BY ${sort} ${dir} NULLS LAST, vc.name LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, p.limit, p.offset],
    ),
    one(`SELECT count(*)::int AS total FROM v_coaches vc ${b.clause}`, params),
  ]);
  return { rows, pagination: buildPagination(count.total, p) };
}

export const options = () => many(`SELECT vc.id, vc.name, vc.team_id, vc.team_ids, vc.status, vc.photo FROM v_coaches vc ORDER BY vc.name`);

export async function get(id) {
  const coach = await loadCoach(id);
  const today = todayISO();
  const [sessions, upcoming, attendance, records, players] = await Promise.all([
    one(`SELECT count(*)::int AS total, (count(*) FILTER (WHERE date < $2))::int AS completed FROM v_training_sessions WHERE coach_id = $1`, [id, today]),
    many(`${SESSION_SELECT} WHERE s.coach_id = $1 AND s.date >= $2 ORDER BY s.date, s.start_time LIMIT 5`, [id, today]),
    coach.team_id ? attendanceGroups({ teamId: coach.team_id }) : null,
    coach.team_id ? computeTeamRecords() : [],
    coach.team_id ? one(`SELECT count(*)::int AS n FROM players WHERE team_id = $1 AND deleted_at IS NULL`, [coach.team_id]) : { n: 0 },
  ]);
  return {
    ...coach,
    players_count: players.n,
    sessions_total: sessions.total,
    sessions_completed: sessions.completed,
    upcoming_sessions: upcoming.map(cleanSession),
    attendance,
    record: coach.team_id ? records.find((r) => r.team_id === coach.team_id) ?? null : null,
  };
}

async function nextCoachCode(client) {
  const row = await one(`SELECT coalesce(max(substring(coach_code FROM 2)::int), 0) + 1 AS n FROM coaches WHERE coach_code ~ '^C[0-9]+$'`, [], client);
  return `C${String(row.n).padStart(3, '0')}`;
}

/** Makes `teamId` the coach's primary (head-coach) team, replacing their previous primary team. */
async function setPrimaryTeam(client, actor, coach, teamId) {
  if ((coach.team_id ?? null) === (teamId ?? null)) return;
  if (coach.team_id) await query(`DELETE FROM coach_teams WHERE coach_id = $1 AND team_id = $2`, [coach.id, coach.team_id], client);
  if (teamId) {
    await query(`DELETE FROM coach_teams WHERE team_id = $1 AND (role = 'head_coach' OR coach_id = $2)`, [teamId, coach.id], client);
    await query(`INSERT INTO coach_teams (coach_id, team_id, role, created_by) VALUES ($1, $2, 'head_coach', $3)`, [coach.id, teamId, actor.userId], client);
  }
  await notifyTeamAssignment(client, { userId: coach.user_id, role: 'coach', teamId, name: coach.name, isCoach: true });
  await audit(client, actor, 'coach.team_changed', 'coach', coach.id, { from: coach.team_id ?? null, to: teamId ?? null });
}

export async function create(actor, data) {
  const id = await withTransaction(async (client) => {
    const photo = await resolveImageField(data.photo, 'coaches');
    const hash = await bcrypt.hash(crypto.randomBytes(24).toString('hex'), env.bcryptRounds);
    const { first_name, last_name } = splitName(data.name);
    const user = await one(
      `INSERT INTO users (email, password_hash, first_name, last_name, phone, avatar_url, role, status, created_by, updated_by)
       VALUES ($1, $2, $3, $4, $5, $6, 'coach', $7, $8, $8) RETURNING id`,
      [data.email, hash, first_name, last_name, data.phone ?? '', photo ?? null, data.status === 'inactive' ? 'inactive' : 'active', actor.userId],
      client,
    );
    const coach = await one(
      `INSERT INTO coaches (user_id, coach_code, license, experience_years, specialization, phone, gender, status, created_by, updated_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $9) RETURNING id`,
      [user.id, await nextCoachCode(client), data.license ?? '', data.experience ?? 0, data.specialization ?? '', data.phone ?? '', data.gender ?? 'male', data.status ?? 'active', actor.userId],
      client,
    );
    if (data.team_id) await setPrimaryTeam(client, actor, { id: coach.id, user_id: user.id, name: data.name, team_id: null }, data.team_id);
    await audit(client, actor, 'coach.created', 'coach', coach.id, { name: data.name });
    return coach.id;
  });
  return loadCoach(id);
}

export async function update(actor, id, data) {
  const coach = await loadCoach(id);
  await withTransaction(async (client) => {
    const photo = await resolveImageField(data.photo, 'coaches');
    const user = {};
    if (data.name !== undefined) Object.assign(user, splitName(data.name));
    if (data.email !== undefined) user.email = data.email;
    if (data.phone !== undefined) user.phone = data.phone;
    if (photo !== undefined) user.avatar_url = photo;
    if (data.status !== undefined) user.status = data.status;
    const uKeys = Object.keys(user);
    if (uKeys.length) await query(`UPDATE users SET ${uKeys.map((k, i) => `${k} = $${i + 2}`).join(', ')}, updated_by = $${uKeys.length + 2} WHERE id = $1`, [coach.user_id, ...uKeys.map((k) => user[k]), actor.userId], client);
    const map = { license: 'license', experience: 'experience_years', specialization: 'specialization', phone: 'phone', gender: 'gender', status: 'status' };
    const cols = Object.keys(map).filter((k) => data[k] !== undefined);
    if (cols.length) await query(`UPDATE coaches SET ${cols.map((k, i) => `${map[k]} = $${i + 2}`).join(', ')}, updated_by = $${cols.length + 2} WHERE id = $1`, [id, ...cols.map((k) => data[k]), actor.userId], client);
    if (data.team_id !== undefined) await setPrimaryTeam(client, actor, { ...coach, name: data.name ?? coach.name }, data.team_id || null);
    await audit(client, actor, 'coach.updated', 'coach', id, { ...data, photo: data.photo === undefined ? undefined : '[image]' });
  });
  return loadCoach(id);
}

export async function remove(actor, id) {
  const coach = await loadCoach(id);
  await withTransaction(async (client) => {
    await query(`DELETE FROM coach_teams WHERE coach_id = $1`, [id], client);
    await query(`UPDATE coaches SET deleted_at = now(), status = 'inactive', updated_by = $2 WHERE id = $1`, [id, actor.userId], client);
    await query(`UPDATE users SET deleted_at = now(), status = 'inactive', updated_by = $2 WHERE id = $1`, [coach.user_id, actor.userId], client);
    await query(`UPDATE user_sessions SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL`, [coach.user_id], client);
    await audit(client, actor, 'coach.deleted', 'coach', id, { name: coach.name });
  });
  return { ok: true };
}

// ------------------------------------------------------------------ coach's own profile

export async function myProfile(actor) {
  const c = await loadCoach(actor.coachId);
  const teams = c.team_ids.length
    ? await many(
        `SELECT t.id, t.name, t.short_name, t.color, t.logo, t.category, t.age_group,
                (SELECT count(*)::int FROM players p WHERE p.team_id = t.id AND p.deleted_at IS NULL) AS players_count
         FROM v_teams t WHERE t.id = ANY($1::uuid[]) ORDER BY t.name`,
        [c.team_ids],
      )
    : [];
  return {
    id: c.id,
    user_id: c.user_id,
    coach_code: c.coach_code,
    name: c.name,
    email: c.email,
    phone: c.phone,
    photo: c.photo,
    gender: c.gender,
    license: c.license,
    experience: c.experience,
    specialization: c.specialization,
    status: c.status,
    account_status: c.account_status,
    member_since: c.created_at,
    last_login_at: c.last_login_at,
    teams,
  };
}

/** Coaches may change their name, phone, photo and email — not their licence, status or teams. */
export async function updateMyProfile(actor, data) {
  await withTransaction(async (client) => {
    const photo = await resolveImageField(data.photo, 'coaches');
    const user = {};
    if (data.name !== undefined) Object.assign(user, splitName(data.name));
    if (data.email !== undefined) user.email = data.email;
    if (data.phone !== undefined) user.phone = data.phone;
    if (photo !== undefined) user.avatar_url = photo;
    const keys = Object.keys(user);
    if (keys.length) await query(`UPDATE users SET ${keys.map((k, i) => `${k} = $${i + 2}`).join(', ')}, updated_by = $1 WHERE id = $1`, [actor.userId, ...keys.map((k) => user[k])], client);
    if (data.phone !== undefined) await query(`UPDATE coaches SET phone = $2 WHERE id = $1`, [actor.coachId, data.phone], client);
    await audit(client, actor, 'coach.profile_updated', 'coach', actor.coachId, { fields: keys });
  });
  return myProfile(actor);
}

// ------------------------------------------------------------------ dashboard

export async function dashboard(actor) {
  const teamIds = actor.teamIds;
  const today = todayISO();
  const weekAhead = toISODate(addDays(new Date(), 7));
  const from = toISODate(addDays(new Date(), -56));
  const league = await one(`SELECT id, name, season FROM v_competitions WHERE status = 'active' AND type = 'league' ORDER BY start_date DESC LIMIT 1`);
  const seasonScope = league ? { competitionId: league.id } : {};
  const coach = await loadCoach(actor.coachId);

  const [teams, counts, todaySessions, todayMatches, liveOrNext, recent, stats, records, attendanceSummary, attendanceByTeam, trend, trainingCounts, pending, nextSessions] = await Promise.all([
    teamSummaries(teamIds),
    one(
      `SELECT (SELECT count(*)::int FROM players WHERE team_id = ANY($1::uuid[]) AND deleted_at IS NULL) AS players,
              (SELECT count(*)::int FROM players WHERE team_id = ANY($1::uuid[]) AND deleted_at IS NULL AND status = 'active') AS active_players,
              (SELECT count(*)::int FROM v_matches WHERE (home_team_id = ANY($1::uuid[]) OR away_team_id = ANY($1::uuid[])) AND status = 'scheduled' AND date >= $2) AS upcoming_matches,
              (SELECT count(*)::int FROM v_matches WHERE (home_team_id = ANY($1::uuid[]) OR away_team_id = ANY($1::uuid[])) AND status = 'live') AS live_matches,
              (SELECT count(*)::int FROM v_training_sessions WHERE team_id = ANY($1::uuid[]) AND status <> 'cancelled' AND date >= $2) AS upcoming_training,
              (SELECT count(*)::int FROM v_training_sessions WHERE team_id = ANY($1::uuid[]) AND status <> 'cancelled' AND date BETWEEN $2 AND $3) AS training_this_week,
              (SELECT count(*)::int FROM v_competitions WHERE status = 'active' AND team_ids && $1::uuid[]) AS active_competitions`,
      [teamIds, today, weekAhead],
    ),
    many(`${SESSION_SELECT} WHERE s.team_id = ANY($1::uuid[]) AND s.date = $2 AND s.status <> 'cancelled'`, [teamIds, today]),
    many(`${MATCH_SELECT} WHERE (m.home_team_id = ANY($1::uuid[]) OR m.away_team_id = ANY($1::uuid[])) AND m.date = $2 AND m.status <> 'cancelled'`, [teamIds, today]),
    many(`${MATCH_SELECT} WHERE (m.home_team_id = ANY($1::uuid[]) OR m.away_team_id = ANY($1::uuid[])) AND (m.status = 'live' OR (m.status = 'scheduled' AND m.date >= $2)) ORDER BY (m.status = 'live') DESC, m.date, m.time LIMIT 1`, [teamIds, today]),
    many(`${MATCH_SELECT} WHERE (m.home_team_id = ANY($1::uuid[]) OR m.away_team_id = ANY($1::uuid[])) AND m.status = 'completed' ORDER BY m.date DESC, m.time DESC LIMIT 5`, [teamIds]),
    computePlayerStats({ ...seasonScope, teamIds }),
    computeTeamRecords(seasonScope),
    attendanceGroups({ teamIds, from, to: today }),
    attendanceGroups({ groupBy: 'team', teamIds, from, to: today }),
    attendanceTrend({ granularity: 'week', keyName: 'week', teamIds, from, to: today }),
    one(
      `SELECT (count(*) FILTER (WHERE status <> 'cancelled' AND date < $2))::int AS completed,
              (count(*) FILTER (WHERE status <> 'cancelled' AND date >= $2))::int AS upcoming,
              (count(*) FILTER (WHERE status = 'cancelled'))::int AS cancelled
       FROM v_training_sessions WHERE team_id = ANY($1::uuid[])`,
      [teamIds, today],
    ),
    many(`${SESSION_SELECT} WHERE s.team_id = ANY($1::uuid[]) AND s.status <> 'cancelled' AND s.date < $2 AND NOT EXISTS (SELECT 1 FROM training_attendance a WHERE a.training_session_id = s.id) ORDER BY s.date DESC`, [teamIds, today]),
    many(`${SESSION_SELECT} WHERE s.team_id = ANY($1::uuid[]) AND s.status <> 'cancelled' AND s.date >= $2 ORDER BY s.date, s.start_time LIMIT 4`, [teamIds, today]),
  ]);

  const topPlayers = await withPlayerAndTeam(
    stats
      .filter((s) => s.matches_played > 0)
      .sort((a, b) => (b.rating ?? 0) + b.goals * 0.4 + b.assists * 0.25 - ((a.rating ?? 0) + a.goals * 0.4 + a.assists * 0.25))
      .slice(0, 6),
  );

  return {
    coach: { id: coach.id, name: coach.name, photo: coach.photo },
    teams: teamIds.map((id) => teams[id]).filter(Boolean),
    season: league,
    counts: { teams: teamIds.length, ...counts, attendance_rate: attendanceSummary.rate },
    todaySchedule: [
      ...todaySessions.map((s) => ({ kind: 'training', time: s.start_time, end: s.end_time, item: cleanSession(s) })),
      ...todayMatches.map((m) => ({ kind: 'match', time: m.time, item: m })),
    ].sort((a, b) => a.time.localeCompare(b.time)),
    nextMatch: liveOrNext[0] ?? null,
    recentResults: recent.map((m) => {
      const teamId = teamIds.includes(m.home_team_id) ? m.home_team_id : m.away_team_id;
      const p = perspective(m, teamId);
      return { ...m, my_team: teams[teamId], opponent: p.home ? m.away_team : m.home_team, ...p };
    }),
    attendance: {
      summary: attendanceSummary,
      byTeam: teamIds.map((id) => ({ team: teams[id], ...(attendanceByTeam[id] ?? { present: 0, absent: 0, late: 0, excused: 0, total: 0, rate: null }) })),
    },
    attendanceTrend: trend.map(({ overall: _o, ...row }) => row),
    topPlayers,
    teamResults: records.filter((r) => teamIds.includes(r.team_id)).map((r) => ({ ...r, team: teams[r.team_id] })),
    training: {
      ...trainingCounts,
      attendance_rate: attendanceSummary.rate,
      pending: pending.map(cleanSession),
      next: nextSessions.map(cleanSession),
    },
  };
}

