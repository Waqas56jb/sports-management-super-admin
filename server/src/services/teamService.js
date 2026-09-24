/**
 * Teams: admin CRUD and assignments, the coach's assigned teams, the player's own team.
 * Coach-team links live in coach_teams (head / assistant); player membership history in team_players.
 */
import { many, one, pool, query, withTransaction } from '../config/database.js';
import { conflict, forbidden, notFound, unprocessable } from '../utils/errors.js';
import { SqlBuilder } from '../utils/filters.js';
import { assertTeamAccess, isAdmin, isCoach, teamScope } from '../utils/permissions.js';
import { todayISO } from '../utils/dates.js';
import { buildPagination, parsePagination } from '../utils/pagination.js';
import {
  audit,
  cleanSession,
  coachJson,
  getEnrichedMatches,
  MATCH_SELECT,
  playerSummaries,
  SESSION_SELECT,
  teamJson,
} from './shared.js';
import { attendanceGroups, computePlayerStats, computeTeamRecords, playerMatchHistory, standings } from './statisticsService.js';
import { notifyTeamAssignment } from './notificationService.js';
import { summarizeLines } from '../utils/statistics.js';

export const COACH_COLUMNS = `vc.id, vc.user_id, vc.coach_code, vc.name, vc.photo, vc.email, vc.phone, vc.gender, vc.license, vc.experience,
  vc.specialization, vc.team_id, vc.team_ids, vc.status, vc.account_status, vc.last_login_at, vc.created_at`;

const TEAM_SORT = { name: 't.name', short_name: 't.short_name', founded: 't.founded', created_at: 't.created_at', status: 't.status', category: 't.category' };

async function loadTeam(id, client = pool) {
  const team = await one(`SELECT * FROM v_teams WHERE id = $1`, [id], client);
  if (!team) throw notFound('Team');
  return team;
}

/** Next live/scheduled match and next session per team (one query each). */
async function nextFixtures(teamIds, client) {
  const today = todayISO();
  const [matches, sessions] = await Promise.all([
    many(
      `SELECT DISTINCT ON (x.team_id) x.team_id, x.id FROM (
         SELECT m.home_team_id AS team_id, m.id, m.date, m.time FROM v_matches m WHERE (m.status = 'live' OR (m.status = 'scheduled' AND m.date >= $2))
         UNION ALL
         SELECT m.away_team_id, m.id, m.date, m.time FROM v_matches m WHERE (m.status = 'live' OR (m.status = 'scheduled' AND m.date >= $2))
       ) x WHERE x.team_id = ANY($1::uuid[]) ORDER BY x.team_id, x.date, x.time`,
      [teamIds, today],
      client,
    ),
    many(
      `SELECT DISTINCT ON (s.team_id) s.team_id, s.id FROM v_training_sessions s
       WHERE s.team_id = ANY($1::uuid[]) AND s.status <> 'cancelled' AND s.date >= $2 ORDER BY s.team_id, s.date, s.start_time`,
      [teamIds, today],
      client,
    ),
  ]);
  const [mRows, sRows] = await Promise.all([
    matches.length ? getEnrichedMatches(`WHERE m.id = ANY($1::uuid[])`, [matches.map((m) => m.id)], client, { details: false }) : [],
    sessions.length ? many(`${SESSION_SELECT} WHERE s.id = ANY($1::uuid[])`, [sessions.map((s) => s.id)], client) : [],
  ]);
  return {
    match: Object.fromEntries(matches.map((m) => [m.team_id, mRows.find((r) => r.id === m.id) ?? null])),
    session: Object.fromEntries(sessions.map((s) => [s.team_id, sRows.map(cleanSession).find((r) => r.id === s.id) ?? null])),
  };
}

// ------------------------------------------------------------------ lists

export async function list(actor, q = {}) {
  const scope = teamScope(actor);
  const b = new SqlBuilder();
  if (scope) b.where('t.id = ANY(?::uuid[])', scope);
  b.whereIf(q.status, 't.status = ?', q.status);
  b.whereIf(q.category, 't.category = ?', q.category);
  b.search(q.search, ['t.name', 't.short_name', 't.city']);
  const p = parsePagination(q, { defaultLimit: isAdmin(actor) ? 100 : 100 });
  const sort = TEAM_SORT[q.sortBy] ?? 't.name';
  const dir = String(q.sortOrder).toLowerCase() === 'desc' ? 'DESC' : 'ASC';
  const params = [...b.params];
  const [rows, count] = await Promise.all([
    many(
      `SELECT t.*, ${coachJson('co', 'cu')} AS coach,
              (SELECT count(*)::int FROM players p WHERE p.team_id = t.id AND p.deleted_at IS NULL) AS players_count,
              (SELECT count(*)::int FROM players p WHERE p.team_id = t.id AND p.deleted_at IS NULL AND p.status = 'active') AS active_players
       FROM v_teams t LEFT JOIN coaches co ON co.id = t.coach_id LEFT JOIN users cu ON cu.id = co.user_id
       ${b.clause} ORDER BY ${sort} ${dir}, t.name LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, p.limit, p.offset],
    ),
    one(`SELECT count(*)::int AS total FROM v_teams t ${b.clause}`, params),
  ]);
  const ids = rows.map((r) => r.id);
  const [records, attendance, next] = await Promise.all([
    computeTeamRecords(),
    attendanceGroups({ groupBy: 'team', teamIds: ids }),
    isCoach(actor) && ids.length ? nextFixtures(ids, pool) : null,
  ]);
  const byTeam = Object.fromEntries(records.map((r) => [r.team_id, r]));
  const data = rows.map((t) => ({
    ...t,
    record: byTeam[t.id] ?? null,
    attendance_rate: attendance[t.id]?.rate ?? null,
    ...(next ? { next_match: next.match[t.id] ?? null, next_session: next.session[t.id] ?? null } : {}),
  }));
  return { rows: data, pagination: buildPagination(count.total, p) };
}

export async function options(actor) {
  const scope = teamScope(actor);
  return many(
    `SELECT t.id, t.name, t.short_name, t.color, t.logo, t.status FROM v_teams t ${scope ? 'WHERE t.id = ANY($1::uuid[])' : ''} ORDER BY t.name`,
    scope ? [scope] : [],
  );
}

// ------------------------------------------------------------------ detail

export async function get(actor, id) {
  const team = await loadTeam(id);
  assertTeamAccess(actor, id);
  const today = todayISO();
  const coachView = isCoach(actor);

  const [coach, rosterRows, stats, records, attendance, perPlayerAttendance, recent, upcoming, upcomingSessions, recentSessions] = await Promise.all([
    team.coach_id ? one(`SELECT ${COACH_COLUMNS} FROM v_coaches vc WHERE vc.id = $1`, [team.coach_id]) : null,
    many(`SELECT * FROM v_players WHERE team_id = $1 ORDER BY jersey_number NULLS LAST, name`, [id]),
    computePlayerStats({ teamIds: [id] }),
    computeTeamRecords(),
    attendanceGroups({ teamId: id }),
    attendanceGroups({ groupBy: 'player', teamId: id }),
    getEnrichedMatches(`WHERE (m.home_team_id = $1 OR m.away_team_id = $1) AND m.status = 'completed'`, [id], pool, { order: 'm.date DESC, m.time DESC', details: false }),
    getEnrichedMatches(`WHERE (m.home_team_id = $1 OR m.away_team_id = $1) AND m.status IN ('scheduled', 'live')`, [id], pool, { order: 'm.date, m.time LIMIT 6', details: false }),
    many(`${SESSION_SELECT} WHERE s.team_id = $1 AND s.date >= $2 ORDER BY s.date, s.start_time LIMIT 6`, [id, today]),
    many(`${SESSION_SELECT} WHERE s.team_id = $1 AND s.date < $2 ORDER BY s.date DESC, s.start_time DESC LIMIT 6`, [id, today]),
  ]);
  const statById = Object.fromEntries(stats.map((s) => [s.player_id, s]));
  const roster = rosterRows.map((p) => ({ ...p, statistics: statById[p.id] ?? null, ...(coachView ? { attendance_rate: perPlayerAttendance[p.id]?.rate ?? null } : {}) }));

  const result = {
    ...team,
    coach,
    roster,
    record: records.find((r) => r.team_id === id) ?? null,
    attendance,
    recent_matches: recent.slice(0, coachView ? 8 : 5),
    upcoming_matches: upcoming.slice(0, coachView ? 6 : 5),
    upcoming_sessions: upcomingSessions.slice(0, coachView ? 6 : 5).map(cleanSession),
    recent_sessions: recentSessions.slice(0, coachView ? 6 : 5).map(cleanSession),
  };

  if (coachView) {
    const scorers = roster.filter((p) => p.statistics?.goals).sort((a, b) => b.statistics.goals - a.statistics.goals).slice(0, 5);
    const summaries = await playerSummaries(scorers.map((p) => p.id));
    result.top_scorers = scorers.map((p) => ({ player: summaries[p.id], goals: p.statistics.goals, assists: p.statistics.assists }));
    const byCompetition = {};
    recent.forEach((m) => {
      const key = m.competition_id ?? 'friendly';
      const home = m.home_team_id === id;
      const row = (byCompetition[key] ??= { competition: m.competition ? { id: m.competition.id, name: m.competition.name, season: m.competition.season } : null, played: 0, won: 0, drawn: 0, lost: 0, goals_for: 0, goals_against: 0 });
      const gf = home ? m.home_score : m.away_score;
      const ga = home ? m.away_score : m.home_score;
      row.played += 1;
      row.goals_for += gf;
      row.goals_against += ga;
      row[gf > ga ? 'won' : gf < ga ? 'lost' : 'drawn'] += 1;
    });
    result.by_competition = Object.values(byCompetition);
  }
  return result;
}

/** GET /teams/:id/statistics — record, goals and attendance for one team. */
export async function statistics(actor, id, q = {}) {
  await loadTeam(id);
  assertTeamAccess(actor, id);
  const filters = { competitionId: q.competition_id, season: q.season, from: q.date_from, to: q.date_to };
  const [records, attendance] = await Promise.all([computeTeamRecords(filters), attendanceGroups({ teamId: id, from: q.date_from, to: q.date_to })]);
  const r = records.find((x) => x.team_id === id);
  return {
    team_id: id,
    matches: r.played,
    wins: r.won,
    draws: r.drawn,
    losses: r.lost,
    goals: r.goals_for,
    goals_conceded: r.goals_against,
    goal_difference: r.goal_difference,
    points: r.points,
    average_goals: r.played ? Math.round((r.goals_for / r.played) * 100) / 100 : 0,
    form: r.form,
    attendance,
  };
}

// ------------------------------------------------------------------ admin writes

const WRITABLE = ['name', 'short_name', 'description', 'city', 'country', 'category', 'age_group', 'gender', 'home_ground', 'founded', 'status'];

async function setHeadCoach(client, actor, teamId, coachId) {
  const current = await one(`SELECT coach_id FROM coach_teams WHERE team_id = $1 AND role = 'head_coach'`, [teamId], client);
  if ((current?.coach_id ?? null) === (coachId ?? null)) return false;
  await query(`DELETE FROM coach_teams WHERE team_id = $1 AND role = 'head_coach'`, [teamId], client);
  if (coachId) {
    const coach = await one(`SELECT vc.id, vc.user_id, vc.name FROM v_coaches vc WHERE vc.id = $1`, [coachId], client);
    if (!coach) throw unprocessable('COACH_NOT_FOUND', 'Coach not found', { i18nKey: 'errors.notFound', fields: { coach_id: 'errors.notFound' } });
    // A coach who was assistant of this team becomes its head coach.
    await query(`DELETE FROM coach_teams WHERE team_id = $1 AND coach_id = $2`, [teamId, coachId], client);
    await query(`INSERT INTO coach_teams (coach_id, team_id, role, created_by) VALUES ($1, $2, 'head_coach', $3)`, [coachId, teamId, actor.userId], client);
    await notifyTeamAssignment(client, { userId: coach.user_id, role: 'coach', teamId, name: coach.name, isCoach: true });
  }
  await audit(client, actor, 'team.head_coach', 'team', teamId, { from: current?.coach_id ?? null, to: coachId ?? null });
  return true;
}

async function nextColor(client) {
  const used = new Set((await many(`SELECT color FROM teams WHERE deleted_at IS NULL`, [], client)).map((r) => r.color));
  return [0, 1, 2, 3, 4, 5].find((c) => !used.has(c)) ?? used.size % 6;
}

export async function create(actor, data) {
  const id = await withTransaction(async (client) => {
    const cols = WRITABLE.filter((k) => data[k] !== undefined);
    const values = cols.map((k) => (k === 'short_name' ? data[k].toUpperCase() : data[k]));
    const row = await one(
      `INSERT INTO teams (${[...cols, 'color', 'logo_url', 'created_by', 'updated_by'].join(', ')})
       VALUES (${[...cols, 'color', 'logo_url', 'created_by', 'updated_by'].map((_, i) => `$${i + 1}`).join(', ')}) RETURNING id`,
      [...values, await nextColor(client), data.logo ?? null, actor.userId, actor.userId],
      client,
    );
    if (data.coach_id) await setHeadCoach(client, actor, row.id, data.coach_id);
    await audit(client, actor, 'team.created', 'team', row.id, { name: data.name });
    return row.id;
  });
  return loadTeam(id);
}

export async function update(actor, id, data) {
  await loadTeam(id);
  await withTransaction(async (client) => {
    const cols = WRITABLE.filter((k) => data[k] !== undefined);
    if (data.logo !== undefined) cols.push('logo_url');
    if (cols.length) {
      const values = cols.map((k) => (k === 'logo_url' ? data.logo : k === 'short_name' ? data[k].toUpperCase() : data[k]));
      await query(`UPDATE teams SET ${cols.map((k, i) => `${k} = $${i + 2}`).join(', ')}, updated_by = $${cols.length + 2} WHERE id = $1`, [id, ...values, actor.userId], client);
    }
    if (data.coach_id !== undefined) await setHeadCoach(client, actor, id, data.coach_id || null);
    await audit(client, actor, 'team.updated', 'team', id, data);
  });
  return loadTeam(id);
}

/** Teams with fixtures keep their history: deactivate them instead of deleting. */
export async function remove(actor, id) {
  await loadTeam(id);
  const used = await one(`SELECT count(*)::int AS n FROM matches WHERE (home_team_id = $1 OR away_team_id = $1) AND deleted_at IS NULL`, [id]);
  if (used.n) throw conflict('TEAM_HAS_MATCHES', 'This team has fixtures — deactivate it instead of deleting it', { i18nKey: 'teams.errors.hasMatches' });
  await withTransaction(async (client) => {
    const today = todayISO();
    await query(`UPDATE team_players SET left_at = $2, status = 'left' WHERE team_id = $1 AND left_at IS NULL`, [id, today], client);
    await query(`UPDATE players SET team_id = NULL WHERE team_id = $1`, [id], client);
    await query(`DELETE FROM coach_teams WHERE team_id = $1`, [id], client);
    await query(`DELETE FROM competition_teams WHERE team_id = $1`, [id], client);
    await query(`UPDATE training_sessions SET deleted_at = now() WHERE team_id = $1 AND deleted_at IS NULL`, [id], client);
    await query(`UPDATE teams SET deleted_at = now(), status = 'inactive', updated_by = $2 WHERE id = $1`, [id, actor.userId], client);
    await audit(client, actor, 'team.deleted', 'team', id);
  });
  return { ok: true };
}

// ------------------------------------------------------------------ roster assignments

/** Moves a player into a team (closing any previous membership). Keeps team_players and players.team_id in sync. */
export async function assignPlayerToTeam(client, actor, playerId, teamId) {
  const player = await one(`SELECT p.id, p.team_id, p.jersey_number, p.user_id, trim(u.first_name || ' ' || u.last_name) AS name FROM players p JOIN users u ON u.id = p.user_id WHERE p.id = $1 AND p.deleted_at IS NULL FOR UPDATE OF p`, [playerId], client);
  if (!player) throw notFound('Player');
  if ((player.team_id ?? null) === (teamId ?? null)) return false;
  const today = todayISO();
  await query(`UPDATE team_players SET left_at = GREATEST($2::date, joined_at), status = 'left' WHERE player_id = $1 AND left_at IS NULL`, [playerId, today], client);
  let jersey = player.jersey_number;
  if (teamId) {
    // Keep the shirt number unless someone in the new team already wears it.
    const clash = jersey ? await one(`SELECT 1 FROM players WHERE team_id = $1 AND jersey_number = $2 AND deleted_at IS NULL AND id <> $3`, [teamId, jersey, playerId], client) : null;
    if (clash) jersey = null;
    await query(`INSERT INTO team_players (team_id, player_id, joined_at, status, created_by) VALUES ($1, $2, $3, 'active', $4)`, [teamId, playerId, today, actor.userId], client);
  }
  await query(`UPDATE players SET team_id = $2, jersey_number = $3, updated_by = $4 WHERE id = $1`, [playerId, teamId, jersey, actor.userId], client);
  await notifyTeamAssignment(client, { userId: player.user_id, role: 'player', teamId, name: player.name, isCoach: false });
  await audit(client, actor, 'player.team_changed', 'player', playerId, { from: player.team_id, to: teamId });
  return true;
}

export async function addPlayers(actor, teamId, playerIds) {
  await loadTeam(teamId);
  await withTransaction(async (client) => {
    for (const pid of playerIds) await assignPlayerToTeam(client, actor, pid, teamId);
  });
  return { ok: true };
}

export async function removePlayer(actor, teamId, playerId) {
  const player = await one(`SELECT id FROM players WHERE id = $1 AND team_id = $2 AND deleted_at IS NULL`, [playerId, teamId]);
  if (!player) throw notFound('Player');
  await withTransaction((client) => assignPlayerToTeam(client, actor, playerId, null));
  return { ok: true };
}

export async function roster(actor, teamId) {
  await loadTeam(teamId);
  assertTeamAccess(actor, teamId);
  if (actor.role === 'player') return publicRoster(actor, {});
  return many(`SELECT * FROM v_players WHERE team_id = $1 ORDER BY jersey_number NULLS LAST, name`, [teamId]);
}

export async function coaches(actor, teamId) {
  await loadTeam(teamId);
  assertTeamAccess(actor, teamId);
  return many(
    `SELECT ${COACH_COLUMNS}, ct.role AS team_role FROM coach_teams ct JOIN v_coaches vc ON vc.id = ct.coach_id
     WHERE ct.team_id = $1 ORDER BY (ct.role <> 'head_coach'), vc.name`,
    [teamId],
  );
}

export async function assignCoach(actor, teamId, { coach_id: coachId, role = 'head_coach' }) {
  await loadTeam(teamId);
  await withTransaction(async (client) => {
    if (role === 'head_coach') return setHeadCoach(client, actor, teamId, coachId);
    const coach = await one(`SELECT id, user_id, name FROM v_coaches WHERE id = $1`, [coachId], client);
    if (!coach) throw notFound('Coach');
    await query(
      `INSERT INTO coach_teams (coach_id, team_id, role, created_by) VALUES ($1, $2, 'assistant_coach', $3)
       ON CONFLICT (coach_id, team_id) DO UPDATE SET role = 'assistant_coach'`,
      [coachId, teamId, actor.userId],
      client,
    );
    await notifyTeamAssignment(client, { userId: coach.user_id, role: 'coach', teamId, name: coach.name, isCoach: true });
    await audit(client, actor, 'team.assistant_coach', 'team', teamId, { coach_id: coachId });
    return true;
  });
  return coaches(actor, teamId);
}

export async function unassignCoach(actor, teamId, coachId) {
  const res = await withTransaction(async (client) => {
    const r = await query(`DELETE FROM coach_teams WHERE team_id = $1 AND coach_id = $2`, [teamId, coachId], client);
    if (r.rowCount) await audit(client, actor, 'team.coach_removed', 'team', teamId, { coach_id: coachId });
    return r.rowCount;
  });
  if (!res) throw notFound('Coach assignment');
  return { ok: true };
}

// ------------------------------------------------------------------ player space

export async function myTeam(actor) {
  if (!actor.teamId) throw notFound('Team', 'NO_TEAM');
  const id = actor.teamId;
  const today = todayISO();
  const [team, league] = await Promise.all([
    loadTeam(id),
    one(`SELECT id, name, season FROM v_competitions WHERE status = 'active' AND type = 'league' AND $1 = ANY(team_ids) ORDER BY start_date DESC LIMIT 1`, [id]),
  ]);
  const [coach, assistant, table, seasonRecords, allTime, attendance, count, next, recent] = await Promise.all([
    team.coach_id ? one(`SELECT id, name, photo, license FROM v_coaches WHERE id = $1`, [team.coach_id]) : null,
    team.assistant_coach_id ? one(`SELECT id, name, photo, license FROM v_coaches WHERE id = $1`, [team.assistant_coach_id]) : null,
    league ? standings(league.id) : [],
    league ? computeTeamRecords({ competitionId: league.id }) : [],
    computeTeamRecords(),
    attendanceGroups({ teamId: id }),
    one(`SELECT count(*)::int AS n FROM players WHERE team_id = $1 AND deleted_at IS NULL`, [id]),
    many(`${MATCH_SELECT} WHERE (m.home_team_id = $1 OR m.away_team_id = $1) AND (m.status = 'live' OR (m.status = 'scheduled' AND m.date >= $2)) ORDER BY m.date, m.time LIMIT 1`, [id, today]),
    many(`${MATCH_SELECT} WHERE (m.home_team_id = $1 OR m.away_team_id = $1) AND m.status = 'completed' ORDER BY m.date DESC, m.time DESC LIMIT 5`, [id]),
  ]);
  const position = table.findIndex((r) => r.team_id === id) + 1;
  return {
    ...team,
    coach,
    assistant_coach: assistant,
    competition: league ? { id: league.id, name: league.name, season: league.season, position: position || null, teams: table.length } : null,
    record: seasonRecords.find((r) => r.team_id === id) ?? null,
    all_time: allTime.find((r) => r.team_id === id) ?? null,
    attendance,
    players_count: count.n,
    next_match: next[0] ?? null,
    recent_results: recent,
  };
}

/** Teammates — public fields only (no contact details, dates of birth or emergency contacts). */
export async function publicRoster(actor, q = {}) {
  const b = new SqlBuilder();
  b.where('vp.team_id = ?', actor.teamId);
  b.whereIf(q.position, 'vp.position = ?', q.position);
  b.search(q.search, ['vp.name', 'vp.jersey_number']);
  const rows = await many(
    `SELECT vp.id, vp.name, vp.photo, vp.jersey_number, vp.position, vp.status, ${teamJson('t')} AS team
     FROM v_players vp JOIN teams t ON t.id = vp.team_id ${b.clause} ORDER BY vp.jersey_number NULLS LAST, vp.name`,
    b.params,
  );
  return rows.map((r) => ({ ...r, is_me: r.id === actor.playerId }));
}

export async function teammate(actor, id) {
  const p = await one(
    `SELECT vp.id, vp.name, vp.photo, vp.jersey_number, vp.position, vp.secondary_position, vp.preferred_foot, vp.nationality, vp.status, vp.team_id, ${teamJson('t')} AS team
     FROM v_players vp LEFT JOIN teams t ON t.id = vp.team_id WHERE vp.id = $1`,
    [id],
  );
  if (!p) throw notFound('Player');
  if (!actor.teamId || p.team_id !== actor.teamId) throw forbidden('This player is not in your team');
  const league = await one(`SELECT id FROM v_competitions WHERE status = 'active' AND type = 'league' ORDER BY start_date DESC LIMIT 1`);
  const season = summarizeLines((await playerMatchHistory(id, league ? { competitionId: league.id } : {})).map((h) => h.line));
  const { team_id: _t, ...rest } = p;
  return { ...rest, season: { matches_played: season.matches_played, goals: season.goals, assists: season.assists } };
}
