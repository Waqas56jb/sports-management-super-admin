/**
 * Statistics: the match engine (keeps score, per-player lines, team stats and standings in sync
 * with line-ups and events) and the aggregate queries used by dashboards, profiles and reports.
 */
import { many, one, pool, query } from '../config/database.js';
import { GOAL_EVENT_TYPES, PLAYED_MATCH_STATUSES } from '../config/constants.js';
import { SqlBuilder } from '../utils/filters.js';
import { extendLine, matchPlayerLines, scoreFromEvents, sortStandings, summarizeCounts, summarizeLines, teamRecords } from '../utils/statistics.js';
import { assertTeamAccess, teamScope } from '../utils/permissions.js';
import { paginateArray } from '../utils/pagination.js';
import { playerSummaries, round1, round2, teamSummaries } from './shared.js';

// ------------------------------------------------------------------ match engine

async function loadLineups(client, match) {
  const rows = await many(
    `SELECT team_id, player_id, is_starting FROM match_lineups WHERE match_id = $1 ORDER BY is_starting DESC, sort_order, substitute_order NULLS LAST`,
    [match.id],
    client,
  );
  if (!rows.length) return null;
  const side = (teamId) => {
    const mine = rows.filter((r) => r.team_id === teamId);
    return mine.length ? { starting: mine.filter((r) => r.is_starting).map((r) => r.player_id), substitutes: mine.filter((r) => !r.is_starting).map((r) => r.player_id) } : null;
  };
  return { home: side(match.home_team_id), away: side(match.away_team_id) };
}

/**
 * Rebuilds everything derived from a match's line-ups and events, inside the caller's transaction:
 *   - score (when `score: 'events'`, or when goal events exist)
 *   - player_match_statistics (minutes, goals, assists, cards, rating, shots, passes…)
 *   - match_statistics cards / shot consistency
 *   - competition standings
 */
export async function recomputeMatch(client, matchId, { score = 'auto' } = {}) {
  const match = await one(`SELECT * FROM v_matches WHERE id = $1`, [matchId], client);
  if (!match) return null;
  const events = await many(`SELECT * FROM match_events WHERE match_id = $1 ORDER BY minute, additional_minute NULLS FIRST, created_at`, [matchId], client);
  const played = PLAYED_MATCH_STATUSES.includes(match.status);
  const hasGoals = events.some((e) => GOAL_EVENT_TYPES.includes(e.event_type) || e.event_type === 'own_goal');

  if (played && (score === 'events' || (score === 'auto' && hasGoals))) {
    const s = scoreFromEvents(match, events);
    if (s.home !== match.home_score || s.away !== match.away_score) {
      await query(`UPDATE matches SET home_score = $2, away_score = $3 WHERE id = $1`, [matchId, s.home, s.away], client);
      match.home_score = s.home;
      match.away_score = s.away;
    }
  }

  await query(`DELETE FROM player_match_statistics WHERE match_id = $1`, [matchId], client);
  if (played) {
    const lineups = await loadLineups(client, match);
    const ids = new Set([...(lineups?.home?.starting ?? []), ...(lineups?.home?.substitutes ?? []), ...(lineups?.away?.starting ?? []), ...(lineups?.away?.substitutes ?? [])]);
    const posRows = ids.size ? await many(`SELECT id, position FROM players WHERE id = ANY($1::uuid[])`, [[...ids]], client) : [];
    const positions = Object.fromEntries(posRows.map((r) => [r.id, r.position]));
    const lines = Object.values(matchPlayerLines(match, lineups, events, positions)).map((l) => extendLine(l, positions[l.player_id], match.id));

    if (lines.length) {
      const cols = ['match_id', 'player_id', 'team_id', 'started', 'minutes_played', 'goals', 'assists', 'shots', 'shots_on_target', 'passes', 'completed_passes', 'pass_accuracy', 'key_passes', 'fouls', 'yellow_cards', 'red_cards', 'rating'];
      const params = [];
      const values = lines.map((l) => {
        const row = [matchId, l.player_id, l.team_id, l.started, l.minutes, l.goals, l.assists, l.shots, l.shots_on_target, l.passes, l.completed_passes, l.pass_accuracy, l.key_passes, l.fouls, l.yellow_cards, l.red_cards, l.rating];
        return `(${row.map((v) => { params.push(v); return `$${params.length}`; }).join(', ')})`;
      });
      await query(`INSERT INTO player_match_statistics (${cols.join(', ')}) VALUES ${values.join(', ')}`, params, client);
    }

    // Team statistics: make sure both rows exist and stay consistent with events and the score.
    for (const [teamId, scored] of [[match.home_team_id, match.home_score ?? 0], [match.away_team_id, match.away_score ?? 0]]) {
      const mine = events.filter((e) => e.team_id === teamId);
      const teamLines = lines.filter((l) => l.team_id === teamId);
      const passes = teamLines.reduce((s, l) => s + l.passes, 0);
      const completed = teamLines.reduce((s, l) => s + l.completed_passes, 0);
      await query(
        `INSERT INTO match_statistics AS ms (match_id, team_id, possession, yellow_cards, red_cards, shots_on_target, shots, passes, completed_passes)
         VALUES ($1, $2, 50, $3, $4, $5, $5, $6, $7)
         ON CONFLICT (match_id, team_id) DO UPDATE SET
           yellow_cards = EXCLUDED.yellow_cards, red_cards = EXCLUDED.red_cards,
           shots_on_target = GREATEST(ms.shots_on_target, EXCLUDED.shots_on_target),
           shots = GREATEST(ms.shots, GREATEST(ms.shots_on_target, EXCLUDED.shots_on_target)),
           passes = CASE WHEN ms.passes = 0 THEN EXCLUDED.passes ELSE ms.passes END,
           completed_passes = CASE WHEN ms.passes = 0 THEN EXCLUDED.completed_passes ELSE LEAST(ms.completed_passes, ms.passes) END`,
        [matchId, teamId, mine.filter((e) => e.event_type === 'yellow_card').length, mine.filter((e) => e.event_type === 'red_card').length, scored, passes, completed],
        client,
      );
    }
  }

  if (match.competition_id) await recomputeStandings(client, match.competition_id);
  return match;
}

/** Persists played/won/drawn/lost/goals/points/position for every team of a competition. */
export async function recomputeStandings(client, competitionId) {
  const teams = await many(
    `SELECT ct.team_id, t.name FROM competition_teams ct JOIN teams t ON t.id = ct.team_id WHERE ct.competition_id = $1`,
    [competitionId],
    client,
  );
  if (!teams.length) return [];
  const matches = await many(`SELECT * FROM v_matches WHERE competition_id = $1 AND status = 'completed'`, [competitionId], client);
  const records = teamRecords(teams.map((t) => t.team_id), matches);
  const names = Object.fromEntries(teams.map((t) => [t.team_id, t.name]));
  const table = sortStandings(Object.values(records), (id) => names[id]);
  // One statement for the whole table.
  const params = [competitionId];
  const values = table.map((r, i) => {
    params.push(r.team_id, r.played, r.won, r.drawn, r.lost, r.goals_for, r.goals_against, r.points, i + 1);
    const b = params.length - 9;
    return `($${b + 1}::uuid, $${b + 2}::int, $${b + 3}::int, $${b + 4}::int, $${b + 5}::int, $${b + 6}::int, $${b + 7}::int, $${b + 8}::int, $${b + 9}::int)`;
  });
  await query(
    `UPDATE competition_teams ct SET played = v.played, won = v.won, drawn = v.drawn, lost = v.lost, goals_for = v.gf, goals_against = v.ga, points = v.points, position = v.position
     FROM (VALUES ${values.join(', ')}) AS v(team_id, played, won, drawn, lost, gf, ga, points, position)
     WHERE ct.competition_id = $1 AND ct.team_id = v.team_id`,
    params,
    client,
  );
  return table;
}

// ------------------------------------------------------------------ match scope filters

/**
 * WHERE fragment for played matches in a scope. Supports competition, season, date range,
 * team, match type (league | cup | tournament | friendly) and whether live matches count.
 */
function matchScope(b, { competitionId, season, from, to, teamId, teamIds, matchType, includeLive = true } = {}, alias = 'm', compAlias = 'mcx') {
  b.where(`${alias}.status = ANY(?::text[])`, includeLive ? ['completed', 'live'] : ['completed']);
  if (competitionId === 'friendly') b.where(`${alias}.competition_id IS NULL`);
  else b.whereIf(competitionId, `${alias}.competition_id = ?`, competitionId);
  b.whereIf(season, `${compAlias}.season = ?`, season);
  b.whereIf(from, `${alias}.date >= ?`, from);
  b.whereIf(to, `${alias}.date <= ?`, to);
  b.whereIf(teamId, `(${alias}.home_team_id = ? OR ${alias}.away_team_id = ?)`, teamId, teamId);
  if (teamIds) b.where(`(${alias}.home_team_id = ANY(?::uuid[]) OR ${alias}.away_team_id = ANY(?::uuid[]))`, teamIds, teamIds);
  if (matchType === 'friendly') b.where(`${alias}.competition_id IS NULL`);
  else b.whereIf(matchType, `${compAlias}.type = ?`, matchType);
  return b;
}

export async function scopedMatches(filters = {}, client = pool) {
  const b = matchScope(new SqlBuilder(), filters);
  return many(`SELECT m.* FROM v_matches m LEFT JOIN competitions mcx ON mcx.id = m.competition_id ${b.clause} ORDER BY m.date, m.time`, b.params, client);
}

// ------------------------------------------------------------------ player aggregates

const AGG_COLUMNS = `
  count(*)::int AS matches_played,
  (count(*) FILTER (WHERE pms.started))::int AS starts,
  coalesce(sum(pms.minutes_played), 0)::int AS minutes_played,
  coalesce(sum(pms.goals), 0)::int AS goals,
  coalesce(sum(pms.assists), 0)::int AS assists,
  coalesce(sum(pms.shots), 0)::int AS shots,
  coalesce(sum(pms.shots_on_target), 0)::int AS shots_on_target,
  coalesce(sum(pms.passes), 0)::int AS passes,
  coalesce(sum(pms.completed_passes), 0)::int AS completed_passes,
  coalesce(sum(pms.key_passes), 0)::int AS key_passes,
  coalesce(sum(pms.fouls), 0)::int AS fouls,
  coalesce(sum(pms.yellow_cards), 0)::int AS yellow_cards,
  coalesce(sum(pms.red_cards), 0)::int AS red_cards,
  round(avg(pms.rating), 1)::float AS rating`;

/** { player_id → totals } for played matches in scope. */
export async function playerAggregates(filters = {}, client = pool) {
  const b = matchScope(new SqlBuilder(), filters);
  if (filters.playerIds) b.where('pms.player_id = ANY(?::uuid[])', filters.playerIds);
  const rows = await many(
    `SELECT pms.player_id, ${AGG_COLUMNS}
     FROM player_match_statistics pms
     JOIN v_matches m ON m.id = pms.match_id
     LEFT JOIN competitions mcx ON mcx.id = m.competition_id
     ${b.clause}
     GROUP BY pms.player_id`,
    b.params,
    client,
  );
  return Object.fromEntries(rows.map((r) => [r.player_id, r]));
}

const emptyTotals = () => ({ matches_played: 0, starts: 0, minutes_played: 0, goals: 0, assists: 0, shots: 0, shots_on_target: 0, passes: 0, completed_passes: 0, key_passes: 0, fouls: 0, yellow_cards: 0, red_cards: 0, rating: null });

/**
 * Season statistics for players (every current player appears, zeros when they did not play),
 * including their attendance rate — the shape the admin/coach statistics tables use.
 */
export async function computePlayerStats(filters = {}, client = pool) {
  const b = new SqlBuilder();
  if (filters.teamIds) b.where('vp.team_id = ANY(?::uuid[])', filters.teamIds);
  if (filters.playerIds) b.where('vp.id = ANY(?::uuid[])', filters.playerIds);
  const players = await many(`SELECT vp.id, vp.team_id FROM v_players vp ${b.clause}`, b.params, client);
  const ids = players.map((p) => p.id);
  const [agg, attendance] = await Promise.all([
    playerAggregates({ ...filters, teamIds: undefined, teamId: undefined, playerIds: ids }, client),
    attendanceGroups({ groupBy: 'player', from: filters.from, to: filters.to, playerIds: ids }, client),
  ]);
  return players.map((p) => ({
    player_id: p.id,
    team_id: p.team_id,
    ...emptyTotals(),
    ...(agg[p.id] ?? {}),
    attendance_rate: attendance[p.id]?.rate ?? null,
  }));
}

/** Match-by-match lines for one player (oldest first), with the enriched match. */
export async function playerMatchHistory(playerId, filters = {}, client = pool) {
  const b = matchScope(new SqlBuilder(), filters);
  b.where('pms.player_id = ?', playerId);
  const rows = await many(
    `SELECT pms.*, m.id AS m_id, m.date, m.time, m.status, m.home_team_id, m.away_team_id, m.home_score, m.away_score, m.competition_id
     FROM player_match_statistics pms
     JOIN v_matches m ON m.id = pms.match_id
     LEFT JOIN competitions mcx ON mcx.id = m.competition_id
     ${b.clause}
     ORDER BY m.date, m.time`,
    b.params,
    client,
  );
  return rows.map((r) => ({
    match: { id: r.m_id, date: r.date, time: r.time, status: r.status, home_team_id: r.home_team_id, away_team_id: r.away_team_id, home_score: r.home_score, away_score: r.away_score, competition_id: r.competition_id },
    line: toLine(r),
  }));
}

/** DB row → the "line" object the apps expect. */
export const toLine = (r) => ({
  player_id: r.player_id,
  team_id: r.team_id,
  started: r.started,
  minutes: r.minutes_played,
  goals: r.goals,
  assists: r.assists,
  yellow_cards: r.yellow_cards,
  red_cards: r.red_cards,
  rating: r.rating,
  shots: r.shots,
  shots_on_target: r.shots_on_target,
  passes: r.passes,
  completed_passes: r.completed_passes,
  key_passes: r.key_passes,
  fouls: r.fouls,
});

/** { player_id → line } for one match. */
export async function matchLines(matchId, client = pool) {
  const rows = await many(`SELECT * FROM player_match_statistics WHERE match_id = $1`, [matchId], client);
  return Object.fromEntries(rows.map((r) => [r.player_id, toLine(r)]));
}

// ------------------------------------------------------------------ team records

/** Played/won/drawn/lost/goals/points/form per team for completed matches in scope. */
export async function computeTeamRecords(filters = {}, client = pool) {
  const [teams, matches] = await Promise.all([
    many(`SELECT id FROM v_teams`, [], client),
    scopedMatches({ ...filters, teamId: undefined, teamIds: undefined, includeLive: false }, client),
  ]);
  return Object.values(teamRecords(teams.map((t) => t.id), matches));
}

/** League table with team summaries and form, calculated from completed matches only. */
export async function standings(competitionId, client = pool) {
  const comp = await one(`SELECT id, team_ids FROM v_competitions WHERE id = $1`, [competitionId], client);
  if (!comp) return [];
  const matches = await scopedMatches({ competitionId, includeLive: false }, client);
  const records = teamRecords(comp.team_ids, matches);
  const teams = await teamSummaries(comp.team_ids, client);
  return sortStandings(Object.values(records), (id) => teams[id]?.name).map((r, i) => ({ ...r, position: i + 1, team: teams[r.team_id] }));
}

// ------------------------------------------------------------------ attendance aggregates

const GROUPS = {
  none: null,
  player: 'a.player_id',
  team: 's.team_id',
  session: 's.id',
  day: "to_char(s.date, 'YYYY-MM-DD')",
  week: "to_char(date_trunc('week', s.date), 'YYYY-MM-DD')",
  month: "to_char(date_trunc('month', s.date), 'YYYY-MM-DD')",
};

/**
 * Attendance counts grouped by player / team / session / day / week / month (or overall with
 * groupBy 'none'). Optional second grouping by team for per-team trend lines.
 * Returns { key → summary } (or a single summary for 'none').
 */
export async function attendanceGroups({ groupBy = 'none', byTeam = false, from, to, teamIds, teamId, playerIds, playerId, sessionId, status } = {}, client = pool) {
  const b = new SqlBuilder();
  b.whereIf(from, 's.date >= ?', from);
  b.whereIf(to, 's.date <= ?', to);
  if (teamIds) b.where('s.team_id = ANY(?::uuid[])', teamIds);
  b.whereIf(teamId, 's.team_id = ?', teamId);
  if (playerIds) b.where('a.player_id = ANY(?::uuid[])', playerIds);
  b.whereIf(playerId, 'a.player_id = ?', playerId);
  b.whereIf(sessionId, 's.id = ?', sessionId);
  b.whereIf(status, 'a.status = ?', status);
  const key = GROUPS[groupBy];
  const keys = [key && `${key} AS key`, byTeam && 's.team_id AS team_id'].filter(Boolean);
  const rows = await many(
    `SELECT ${keys.length ? `${keys.join(', ')},` : ''}
            (count(*) FILTER (WHERE a.status = 'present'))::int AS present,
            (count(*) FILTER (WHERE a.status = 'absent'))::int AS absent,
            (count(*) FILTER (WHERE a.status = 'late'))::int AS late,
            (count(*) FILTER (WHERE a.status = 'excused'))::int AS excused
     FROM training_attendance a
     JOIN training_sessions s ON s.id = a.training_session_id AND s.deleted_at IS NULL
     ${b.clause}
     ${keys.length ? `GROUP BY ${[key, byTeam && 's.team_id'].filter(Boolean).join(', ')}` : ''}`,
    b.params,
    client,
  );
  if (!key && !byTeam) return summarizeCounts(rows[0]);
  if (byTeam && key) {
    const out = {};
    rows.forEach((r) => {
      (out[r.key] ??= {})[r.team_id] = summarizeCounts(r);
    });
    return out;
  }
  return Object.fromEntries(rows.map((r) => [byTeam ? r.team_id : r.key, summarizeCounts(r)]));
}

/** Trend rows: [{ key, overall, <teamId>: rate … }] sorted by key. */
export async function attendanceTrend({ granularity = 'week', keyName = 'week', limit, ...filters } = {}, client = pool) {
  const [overall, perTeam] = await Promise.all([
    attendanceGroups({ ...filters, groupBy: granularity }, client),
    attendanceGroups({ ...filters, groupBy: granularity, byTeam: true }, client),
  ]);
  let keys = Object.keys(overall).sort();
  if (limit) keys = keys.slice(-limit);
  return keys.map((k) => ({ [keyName]: k, overall: overall[k].rate, ...Object.fromEntries(Object.entries(perTeam[k] ?? {}).map(([tid, s]) => [tid, s.rate])) }));
}

// ------------------------------------------------------------------ list helpers used by several apps

/** Adds player + team summaries to computed stat rows. */
export async function withPlayerAndTeam(rows, client = pool) {
  const [players, teams] = await Promise.all([playerSummaries(rows.map((r) => r.player_id), client), teamSummaries([...new Set(rows.map((r) => r.team_id).filter(Boolean))], client)]);
  return rows.map((r) => ({ ...r, player: players[r.player_id] ?? null, team: teams[r.team_id] ?? null }));
}

export function statTotals(rows, { ratingDecimals = 1 } = {}) {
  const played = rows.filter((r) => r.matches_played > 0);
  const rated = played.filter((r) => r.rating !== null);
  const withAttendance = rows.filter((r) => r.attendance_rate !== null);
  const sum = (k) => rows.reduce((s, r) => s + (r[k] ?? 0), 0);
  const avg = rated.length ? rated.reduce((s, r) => s + r.rating, 0) / rated.length : null;
  return {
    players: played.length,
    goals: sum('goals'),
    assists: sum('assists'),
    minutes_played: sum('minutes_played'),
    yellow_cards: sum('yellow_cards'),
    red_cards: sum('red_cards'),
    appearances: sum('matches_played'),
    avg_rating: avg === null ? null : ratingDecimals === 2 ? round2(avg) : round1(avg),
    avg_attendance: withAttendance.length ? withAttendance.reduce((s, r) => s + r.attendance_rate, 0) / withAttendance.length : null,
  };
}

export const SORTABLE_STATS = ['goals', 'assists', 'minutes_played', 'matches_played', 'starts', 'yellow_cards', 'red_cards', 'rating', 'attendance_rate', 'shots', 'passes'];

/** In-memory sort for computed rows (whitelisted keys only). */
export function sortRows(rows, key, dir = 'desc', nameOf = (r) => r.player?.name ?? '') {
  const k = SORTABLE_STATS.includes(key) || key === 'name' ? key : 'goals';
  const f = String(dir).toLowerCase() === 'asc' ? 1 : -1;
  return [...rows].sort((a, b) => {
    const av = k === 'name' ? nameOf(a) : a[k];
    const bv = k === 'name' ? nameOf(b) : b[k];
    if (av === bv) return nameOf(a).localeCompare(nameOf(b));
    if (av === null || av === undefined) return 1;
    if (bv === null || bv === undefined) return -1;
    return (typeof av === 'number' ? av - bv : String(av).localeCompare(String(bv))) * f;
  });
}

// ------------------------------------------------------------------ statistics endpoints

/**
 * GET /statistics/players — per-player season table (scoped to the coach's teams), with totals.
 * Sorting and pagination run on the computed rows (sort keys come from an allow-list).
 */
export async function playerStatsTable(actor, q = {}) {
  const scope = teamScope(actor);
  if (q.team_id) assertTeamAccess(actor, q.team_id);
  const teamIds = q.team_id ? [q.team_id] : scope ?? undefined;
  let rows = await computePlayerStats({ competitionId: q.competition_id, season: q.season, from: q.date_from, to: q.date_to, matchType: q.match_type, teamIds, playerIds: q.player_id ? [q.player_id] : undefined });
  rows = await withPlayerAndTeam(rows);
  if (q.position) rows = rows.filter((r) => r.player?.position === q.position);
  if (q.search) {
    const needle = String(q.search).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
    rows = rows.filter((r) => (r.player?.name ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().includes(needle));
  }
  const coach = actor.role === 'coach';
  const played = rows.filter((r) => r.matches_played > 0);
  const listed = q.player_id || q.onlyPlayed === 'false' ? rows : played;
  const totals = statTotals(coach ? rows : listed, { ratingDecimals: coach ? 2 : 1 });
  if (coach) totals.players = played.length;
  const sorted = sortRows(listed, q.sortBy ?? 'goals', q.sortOrder ?? 'desc');
  const page = paginateArray(sorted, q);
  return { rows: page.rows, pagination: page.pagination, meta: { totals, all: sorted.slice(0, 200) } };
}

/** GET /statistics/teams — W/D/L, goals, points, form (+ attendance for coaches). */
export async function teamStatsTable(actor, q = {}) {
  if (q.team_id) assertTeamAccess(actor, q.team_id);
  const scope = q.team_id ? [q.team_id] : teamScope(actor);
  const records = await computeTeamRecords({ competitionId: q.competition_id, season: q.season, from: q.date_from, to: q.date_to });
  const rows = records.filter((r) => !scope || scope.includes(r.team_id));
  const [teams, attendance] = await Promise.all([
    teamSummaries(rows.map((r) => r.team_id)),
    attendanceGroups({ groupBy: 'team', teamIds: rows.map((r) => r.team_id), from: q.date_from, to: q.date_to }),
  ]);
  return rows.map((r) => ({ ...r, team: teams[r.team_id], ...(actor.role !== 'admin' ? { attendance_rate: attendance[r.team_id]?.rate ?? null } : {}) }));
}

/** GET /statistics/trend — match-by-match series for the coach's teams (last 14 matches). */
export async function trendSeries(actor, q = {}) {
  if (q.team_id) assertTeamAccess(actor, q.team_id);
  const ids = q.team_id ? [q.team_id] : teamScope(actor) ?? (await many(`SELECT id FROM v_teams`)).map((t) => t.id);
  const matches = (await scopedMatches({ competitionId: q.competition_id, season: q.season, from: q.date_from, to: q.date_to, teamIds: ids, includeLive: false })).slice(-14);
  if (!matches.length) return [];
  const [lines, teams] = await Promise.all([
    many(`SELECT match_id, team_id, player_id, goals, rating FROM player_match_statistics WHERE match_id = ANY($1::uuid[])`, [matches.map((m) => m.id)]),
    teamSummaries([...new Set(matches.flatMap((m) => [m.home_team_id, m.away_team_id]))]),
  ]);
  return matches.map((m) => {
    const teamHere = ids.includes(m.home_team_id) ? m.home_team_id : m.away_team_id;
    const home = m.home_team_id === teamHere;
    const mine = lines.filter((l) => l.match_id === m.id && l.team_id === teamHere && (!q.player_id || l.player_id === q.player_id));
    const gf = home ? m.home_score : m.away_score;
    const ga = home ? m.away_score : m.home_score;
    return {
      match_id: m.id,
      date: m.date,
      team: teams[teamHere],
      opponent: teams[home ? m.away_team_id : m.home_team_id],
      goals_for: gf,
      goals_against: ga,
      result: gf > ga ? 'W' : gf < ga ? 'L' : 'D',
      rating: mine.length ? round2(mine.reduce((s, l) => s + Number(l.rating), 0) / mine.length) : null,
      player_goals: mine.reduce((s, l) => s + l.goals, 0),
    };
  });
}

/** GET /player/statistics — the signed-in player's own statistics. */
export async function myStatistics(actor, q = {}) {
  const history = await playerMatchHistory(actor.playerId, { season: q.season, competitionId: q.competition_id, from: q.date_from, to: q.date_to, matchType: q.match_type, includeLive: false });
  const matches = history.length ? await many(`SELECT m.id, m.home_team_id, m.away_team_id FROM v_matches m WHERE m.id = ANY($1::uuid[])`, [history.map((h) => h.match.id)]) : [];
  const teams = await teamSummaries([...new Set(matches.flatMap((m) => [m.home_team_id, m.away_team_id]))]);
  const perMatch = history.map(({ match, line }) => ({
    match_id: match.id,
    date: match.date,
    opponent: teams[match.home_team_id === line.team_id ? match.away_team_id : match.home_team_id] ?? null,
    goals: line.goals,
    assists: line.assists,
    minutes: line.minutes,
    rating: line.rating,
    shots: line.shots,
    pass_accuracy: line.passes ? Math.round((line.completed_passes / line.passes) * 100) : null,
  }));
  const months = {};
  history.forEach(({ match, line }) => {
    (months[match.date.slice(0, 7)] ??= []).push(line);
  });
  const monthly = Object.keys(months)
    .sort()
    .map((m) => {
      const s = summarizeLines(months[m]);
      return { month: `${m}-01`, goals: s.goals, assists: s.assists, minutes: s.minutes_played, rating: s.average_rating, matches: s.matches_played };
    });
  return {
    totals: summarizeLines(history.map((h) => h.line)),
    attendance: await attendanceGroups({ playerId: actor.playerId, from: q.date_from, to: q.date_to }),
    perMatch,
    monthly,
  };
}
