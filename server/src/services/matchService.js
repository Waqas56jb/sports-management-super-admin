/**
 * Matches: fixtures (admin), live operation (status, line-ups, events, team statistics — admin and
 * the coaches of the two teams) and read-only views for players.
 *
 * Every write runs in one transaction together with services/statisticsService.recomputeMatch, so
 * the score, player statistics, team statistics and standings can never disagree with the events.
 *
 * Substitution events are stored as player_id = player coming ON, related_player_id = player going
 * OFF. API responses also expose explicit player_in_id / player_out_id; the legacy player_id /
 * related_player_id pair in responses keeps the apps' orientation (player_id = player going off).
 */
import { many, one, pool, query, withTransaction } from '../config/database.js';
import { FORMATIONS, GOAL_EVENT_TYPES } from '../config/constants.js';
import { AppError, forbidden, notFound, unprocessable } from '../utils/errors.js';
import { SqlBuilder } from '../utils/filters.js';
import { assertMatchAccess, canAccessTeam, isAdmin, isCoach, isPlayer, teamScope } from '../utils/permissions.js';
import { buildPagination, parsePagination } from '../utils/pagination.js';
import { audit, attachMatchDetails, getEnrichedMatch, MATCH_SELECT, playerSummaries } from './shared.js';
import { matchLines, recomputeMatch, recomputeStandings } from './statisticsService.js';
import { notify, notifyMatchReminder } from './notificationService.js';

const TAB_STATUS = { upcoming: ['scheduled', 'live'], completed: ['completed'], cancelled: ['cancelled', 'postponed'] };
const MATCH_SORT = { date: 'm.date', time: 'm.time', status: 'm.status', round: 'm.round', location: 'm.location', created_at: 'm.created_at' };

// ------------------------------------------------------------------ helpers

async function loadMatch(id, client = pool) {
  const m = await one(`SELECT * FROM v_matches WHERE id = $1`, [id], client);
  if (!m) throw notFound('Match');
  return m;
}

async function loadOwned(actor, id, client = pool) {
  const m = await loadMatch(id, client);
  assertMatchAccess(actor, m);
  return m;
}

const sideOf = (match, teamId) => (teamId === match.home_team_id ? 'home' : teamId === match.away_team_id ? 'away' : null);

/** DB event → API event (with both orientations for substitutions). */
function serializeEvent(e, people) {
  const sub = e.event_type === 'substitution';
  const playerId = sub ? e.related_player_id : e.player_id;
  const relatedId = sub ? e.player_id : e.related_player_id;
  return {
    id: e.id,
    match_id: e.match_id,
    team_id: e.team_id,
    event_type: e.event_type,
    minute: e.minute,
    additional_minute: e.additional_minute,
    description: e.description,
    player_id: playerId,
    related_player_id: relatedId,
    ...(sub ? { player_in_id: e.player_id, player_out_id: e.related_player_id } : {}),
    player: people(playerId),
    related_player: people(relatedId),
    created_at: e.created_at,
  };
}

async function eventsOf(matchId, client = pool) {
  return many(`SELECT * FROM match_events WHERE match_id = $1 ORDER BY minute, additional_minute NULLS FIRST, created_at`, [matchId], client);
}

// ------------------------------------------------------------------ reads

export async function list(actor, q = {}) {
  const p = parsePagination(q, { defaultLimit: 10 });
  const scope = teamScope(actor);
  const b = new SqlBuilder();
  if (scope) b.where('(m.home_team_id = ANY(?::uuid[]) OR m.away_team_id = ANY(?::uuid[]))', scope, scope);
  if (isPlayer(actor)) b.where('m.status = ANY(?::text[])', TAB_STATUS[q.tab] ?? TAB_STATUS.upcoming);
  b.whereIf(q.status, 'm.status = ?', q.status);
  if (q.competition_id === 'friendly') b.where('m.competition_id IS NULL');
  else b.whereIf(q.competition_id, 'm.competition_id = ?', q.competition_id);
  b.whereIf(q.team_id, '(m.home_team_id = ? OR m.away_team_id = ?)', q.team_id, q.team_id);
  if (q.when === 'upcoming') b.where("m.status IN ('scheduled', 'live')");
  if (q.when === 'completed' || q.when === 'past') b.where("m.status IN ('completed', 'cancelled', 'postponed')");
  b.whereIf(q.date_from, 'm.date >= ?', q.date_from);
  b.whereIf(q.date_to, 'm.date <= ?', q.date_to);
  b.search(q.search, ['ht.name', 'awt.name', 'ht.short_name', 'awt.short_name', 'm.location', 'm.referee']);

  const ascending = isPlayer(actor) ? (q.tab ?? 'upcoming') === 'upcoming' : isCoach(actor) && !q.sortOrder ? ['scheduled', 'live'].includes(q.status) : q.sortOrder ? String(q.sortOrder).toLowerCase() === 'asc' : q.when === 'upcoming';
  const dir = ascending ? 'ASC' : 'DESC';
  const sort = MATCH_SORT[q.sortBy] ?? 'm.date';
  const order = sort === 'm.date' ? `m.date ${dir}, m.time ${dir}` : `${sort} ${dir}, m.date ${dir}`;
  const params = [...b.params];
  const from = `FROM v_matches m JOIN teams ht ON ht.id = m.home_team_id JOIN teams awt ON awt.id = m.away_team_id`;
  const [rows, count] = await Promise.all([
    many(`${MATCH_SELECT} ${b.clause} ORDER BY ${order}, m.id LIMIT $${params.length + 1} OFFSET $${params.length + 2}`, [...params, p.limit, p.offset]),
    one(`SELECT count(*)::int AS total ${from} ${b.clause}`, params),
  ]);
  await attachMatchDetails(rows, pool);
  return { rows, pagination: buildPagination(count.total, p) };
}

export async function counts(actor) {
  const scope = teamScope(actor);
  const rows = await many(
    `SELECT status, count(*)::int AS n FROM v_matches m ${scope ? 'WHERE m.home_team_id = ANY($1::uuid[]) OR m.away_team_id = ANY($1::uuid[])' : ''} GROUP BY status`,
    scope ? [scope] : [],
  );
  const by = Object.fromEntries(rows.map((r) => [r.status, r.n]));
  if (isPlayer(actor)) return Object.fromEntries(Object.entries(TAB_STATUS).map(([tab, st]) => [tab, st.reduce((s, x) => s + (by[x] ?? 0), 0)]));
  return { scheduled: by.scheduled ?? 0, live: by.live ?? 0, completed: by.completed ?? 0, cancelled: by.cancelled ?? 0, postponed: by.postponed ?? 0 };
}

export async function get(actor, id) {
  const match = await getEnrichedMatch(id);
  assertMatchAccess(actor, match);
  const [events, lines, squadRows] = await Promise.all([
    eventsOf(id),
    matchLines(id),
    many(`SELECT vp.id, vp.name, vp.photo, vp.position, vp.jersey_number, vp.team_id, vp.status FROM v_players vp WHERE vp.team_id IN ($1, $2) ORDER BY vp.jersey_number NULLS LAST, vp.name`, [match.home_team_id, match.away_team_id]),
  ]);
  const lineupIds = [...(match.lineups?.home?.starting ?? []), ...(match.lineups?.home?.substitutes ?? []), ...(match.lineups?.away?.starting ?? []), ...(match.lineups?.away?.substitutes ?? [])];
  const people = await playerSummaries([...lineupIds, ...events.flatMap((e) => [e.player_id, e.related_player_id])]);

  if (isPlayer(actor)) {
    const lp = (pid) => (people[pid] ? { id: pid, name: people[pid].name, photo: people[pid].photo, jersey_number: people[pid].jersey_number, position: people[pid].position, is_me: pid === actor.playerId } : null);
    const lineups = {};
    for (const side of ['home', 'away']) {
      const l = match.lineups?.[side];
      lineups[side] = l ? { formation: l.formation, starting: l.starting.map(lp).filter(Boolean), substitutes: l.substitutes.map(lp).filter(Boolean) } : null;
    }
    const mySide = match.home_team_id === actor.teamId ? 'home' : 'away';
    const mine = lineups[mySide];
    const selected = mine && [...mine.starting, ...mine.substitutes].some((x) => x.is_me);
    return {
      ...match,
      team_stats: match.team_stats,
      events: events.map((e) => serializeEvent(e, lp)),
      lineups,
      my_side: mySide,
      my_selection: !mine ? null : selected ? (mine.starting.some((x) => x.is_me) ? 'starting' : 'substitute') : 'not_selected',
      my_performance: lines[actor.playerId] ?? null,
    };
  }

  const summary = (pid) => people[pid] ?? null;
  const squad = (teamId) => squadRows.filter((p) => p.team_id === teamId).map((p) => ({ id: p.id, name: p.name, photo: p.photo, position: p.position, jersey_number: p.jersey_number, team_id: p.team_id, status: p.status }));
  return {
    ...match,
    events: events.map((e) => serializeEvent(e, summary)),
    player_lines: lines,
    squads: { home: squad(match.home_team_id), away: squad(match.away_team_id) },
    ...(isCoach(actor) ? { editable_sides: ['home', 'away'].filter((s) => canAccessTeam(actor, s === 'home' ? match.home_team_id : match.away_team_id)) } : {}),
  };
}

// ------------------------------------------------------------------ fixtures (admin)

async function validateFixture(client, values, exceptId) {
  if (values.home_team_id === values.away_team_id) {
    throw unprocessable('SAME_TEAM', 'A team cannot play itself', { i18nKey: 'matches.errors.sameTeam', fields: { away_team_id: 'matches.errors.sameTeam' } });
  }
  const teams = await many(`SELECT id FROM teams WHERE id IN ($1, $2) AND deleted_at IS NULL`, [values.home_team_id, values.away_team_id], client);
  if (teams.length !== 2) throw unprocessable('TEAM_NOT_FOUND', 'Team not found', { i18nKey: 'errors.notFound', fields: { home_team_id: 'errors.notFound' } });
  if (values.competition_id) {
    const comp = await one(`SELECT team_ids FROM v_competitions WHERE id = $1`, [values.competition_id], client);
    if (!comp) throw unprocessable('COMPETITION_NOT_FOUND', 'Competition not found', { i18nKey: 'errors.notFound', fields: { competition_id: 'errors.notFound' } });
    if (!comp.team_ids.includes(values.home_team_id) || !comp.team_ids.includes(values.away_team_id)) {
      throw unprocessable('TEAM_NOT_IN_COMPETITION', 'Both teams must be entered in the competition', { i18nKey: 'errors.generic', fields: { competition_id: 'errors.generic' } });
    }
  }
  const clash = await one(
    `SELECT id FROM v_matches WHERE date = $1 AND status NOT IN ('cancelled', 'postponed') AND ($2::uuid IS NULL OR id <> $2)
       AND (home_team_id IN ($3, $4) OR away_team_id IN ($3, $4)) LIMIT 1`,
    [values.date, exceptId ?? null, values.home_team_id, values.away_team_id],
    client,
  );
  if (clash) throw unprocessable('TEAM_BUSY', 'One of the teams already plays on this date', { i18nKey: 'matches.errors.teamBusy', fields: { date: 'matches.errors.teamBusy' } });
}

const COLUMN = { competition_id: 'competition_id', home_team_id: 'home_team_id', away_team_id: 'away_team_id', date: 'match_date', time: 'match_time', location: 'venue', referee: 'referee', round: 'round', notes: 'notes' };

export async function create(actor, data) {
  const id = await withTransaction(async (client) => {
    await validateFixture(client, data);
    const status = data.status ?? 'scheduled';
    const played = status === 'live' || status === 'completed';
    const cols = Object.keys(COLUMN).filter((k) => data[k] !== undefined);
    const row = await one(
      `INSERT INTO matches (${cols.map((k) => COLUMN[k]).join(', ')}, status, home_score, away_score, live_minute, created_by, updated_by)
       VALUES (${cols.map((_, i) => `$${i + 1}`).join(', ')}, $${cols.length + 1}, $${cols.length + 2}, $${cols.length + 2}, $${cols.length + 3}, $${cols.length + 4}, $${cols.length + 4}) RETURNING id`,
      [...cols.map((k) => data[k]), status, played ? 0 : null, status === 'live' ? 1 : null, actor.userId],
      client,
    );
    if (played) await recomputeMatch(client, row.id);
    const match = await loadMatch(row.id, client);
    await notifyMatchReminder(client, match, 'scheduled');
    await audit(client, actor, 'match.created', 'match', row.id, data);
    return row.id;
  });
  return getEnrichedMatch(id);
}

export async function update(actor, id, data) {
  await withTransaction(async (client) => {
    const current = await loadMatch(id, client);
    const next = { ...current, ...data };
    await validateFixture(client, next, id);
    const teamsChanged = next.home_team_id !== current.home_team_id || next.away_team_id !== current.away_team_id;
    if (teamsChanged) {
      const ev = await one(`SELECT count(*)::int AS n FROM match_events WHERE match_id = $1`, [id], client);
      if (ev.n) throw unprocessable('TEAMS_LOCKED', 'Teams cannot change once events have been recorded', { i18nKey: 'matches.errors.teamsLocked' });
      await query(`DELETE FROM match_lineups WHERE match_id = $1`, [id], client);
      await query(`DELETE FROM match_statistics WHERE match_id = $1`, [id], client);
      await query(`UPDATE matches SET home_formation = NULL, away_formation = NULL WHERE id = $1`, [id], client);
    }
    const cols = Object.keys(COLUMN).filter((k) => data[k] !== undefined);
    if (cols.length) await query(`UPDATE matches SET ${cols.map((k, i) => `${COLUMN[k]} = $${i + 2}`).join(', ')}, updated_by = $${cols.length + 2} WHERE id = $1`, [id, ...cols.map((k) => data[k]), actor.userId], client);
    if (data.status && data.status !== current.status) await applyStatus(client, actor, id, { status: data.status });
    else await recomputeMatch(client, id);
    if (data.date !== undefined && (data.date !== current.date || (data.time && data.time !== current.time))) {
      await notifyMatchReminder(client, await loadMatch(id, client), 'rescheduled', { includeAdmins: false });
    }
    await audit(client, actor, 'match.updated', 'match', id, data);
  });
  return getEnrichedMatch(id);
}

/** Soft delete: results stay out of every list and standings are recalculated. */
export async function remove(actor, id) {
  await withTransaction(async (client) => {
    const m = await loadMatch(id, client);
    await query(`UPDATE matches SET deleted_at = now(), updated_by = $2 WHERE id = $1`, [id, actor.userId], client);
    if (m.competition_id) await recomputeStandings(client, m.competition_id);
    await audit(client, actor, 'match.deleted', 'match', id);
  });
  return { ok: true };
}

// ------------------------------------------------------------------ live operation

async function applyStatus(client, actor, id, { status, home_score, away_score, live_minute }) {
  const m = await loadMatch(id, client);
  const goals = await one(`SELECT count(*)::int AS n FROM match_events WHERE match_id = $1 AND event_type IN ('goal', 'penalty', 'own_goal')`, [id], client);
  const played = status === 'live' || status === 'completed';
  let home = m.home_score;
  let away = m.away_score;
  if (!played) {
    if (!goals.n) {
      home = null;
      away = null;
    }
  } else if (!goals.n) {
    home = home_score !== undefined ? Number(home_score) || 0 : m.home_score ?? 0;
    away = away_score !== undefined ? Number(away_score) || 0 : m.away_score ?? 0;
  } else if (home === null) {
    home = 0;
    away = 0;
  }
  const minute = status === 'live' ? Number(live_minute) || m.live_minute || 1 : null;
  await query(`UPDATE matches SET status = $2, home_score = $3, away_score = $4, live_minute = $5, updated_by = $6 WHERE id = $1`, [id, status, home, away, minute, actor.userId], client);
  await recomputeMatch(client, id, { score: goals.n && played ? 'events' : 'keep' });
  const updated = await loadMatch(id, client);
  if (status !== m.status) {
    if (status === 'live') await notifyMatchReminder(client, updated, 'live');
    if (status === 'completed') await notifyMatchReminder(client, updated, 'result');
    if (status === 'cancelled' || status === 'postponed') await notifyMatchReminder(client, updated, 'cancelled');
  }
  await audit(client, actor, 'match.status', 'match', id, { from: m.status, to: status, home_score: home, away_score: away, live_minute: minute });
  return updated;
}

/** Status + live minute; manual scores only while no goal events exist (events drive the score). */
export async function updateStatus(actor, id, body) {
  await withTransaction(async (client) => {
    await loadOwned(actor, id, client);
    await applyStatus(client, actor, id, body);
  });
  return getEnrichedMatch(id);
}

const STAT_KEYS = ['possession', 'shots', 'shots_on_target', 'corners', 'fouls', 'offsides', 'passes', 'completed_passes'];

/** Team statistics for one or both sides. Possession of the other side is kept at 100 − x. */
export async function updateTeamStats(actor, id, body) {
  return withTransaction(async (client) => {
    const m = await loadOwned(actor, id, client);
    if (!['live', 'completed'].includes(m.status)) throw unprocessable('MATCH_NOT_STARTED', 'Statistics can only be recorded once the match has started', { i18nKey: 'matches.errors.notStarted' });
    const sides = body.team_id ? { [sideOf(m, body.team_id)]: body } : { home: body.home, away: body.away };
    if (sides.null !== undefined) throw unprocessable('TEAM_NOT_IN_MATCH', 'The team does not play in this match', { i18nKey: 'matches.errors.playerNotInMatch' });
    if (isCoach(actor) && body.team_id && !canAccessTeam(actor, body.team_id)) throw forbidden('You can only edit your own team');
    for (const [side, values] of Object.entries(sides)) {
      if (!values) continue;
      const teamId = side === 'home' ? m.home_team_id : m.away_team_id;
      await query(`INSERT INTO match_statistics (match_id, team_id) VALUES ($1, $2) ON CONFLICT (match_id, team_id) DO NOTHING`, [id, teamId], client);
      const cols = STAT_KEYS.filter((k) => values[k] !== undefined);
      if (!cols.length) continue;
      const v = { ...values };
      if (v.shots !== undefined && v.shots_on_target !== undefined && v.shots_on_target > v.shots) v.shots = v.shots_on_target;
      if (v.passes !== undefined && v.completed_passes !== undefined && v.completed_passes > v.passes) {
        throw unprocessable('INVALID_PASSES', 'Completed passes cannot exceed passes', { fields: { completed_passes: 'validation.range' } });
      }
      await query(`UPDATE match_statistics SET ${cols.map((k, i) => `${k} = $${i + 3}`).join(', ')}, updated_by = $${cols.length + 3} WHERE match_id = $1 AND team_id = $2`, [id, teamId, ...cols.map((k) => v[k]), actor.userId], client);
      if (values.possession !== undefined) {
        const other = side === 'home' ? m.away_team_id : m.home_team_id;
        await query(`INSERT INTO match_statistics (match_id, team_id, possession) VALUES ($1, $2, $3) ON CONFLICT (match_id, team_id) DO UPDATE SET possession = EXCLUDED.possession`, [id, other, 100 - values.possession], client);
      }
    }
    await recomputeMatch(client, id, { score: 'keep' });
    await audit(client, actor, 'match.statistics', 'match', id, body);
    const [row] = await attachMatchDetails([{ id, home_team_id: m.home_team_id, away_team_id: m.away_team_id }], client, { lineups: false });
    return row.team_stats;
  });
}

// ------------------------------------------------------------------ line-ups

async function lineupOf(client, match, teamId) {
  const rows = await many(`SELECT player_id, is_starting FROM match_lineups WHERE match_id = $1 AND team_id = $2 ORDER BY is_starting DESC, sort_order`, [match.id, teamId], client);
  return rows.length ? { starting: rows.filter((r) => r.is_starting).map((r) => r.player_id), substitutes: rows.filter((r) => !r.is_starting).map((r) => r.player_id) } : null;
}

async function writeLineup(client, actor, match, teamId, { formation, starting, substitutes }) {
  const side = sideOf(match, teamId);
  await query(`DELETE FROM match_lineups WHERE match_id = $1 AND team_id = $2`, [match.id, teamId], client);
  const players = await many(`SELECT id, position, jersey_number FROM players WHERE id = ANY($1::uuid[])`, [[...starting, ...substitutes]], client);
  const byId = Object.fromEntries(players.map((p) => [p.id, p]));
  const rows = [
    ...starting.map((pid, i) => [match.id, teamId, pid, true, byId[pid]?.position ?? null, byId[pid]?.jersey_number ?? null, i, null, actor.userId]),
    ...substitutes.map((pid, i) => [match.id, teamId, pid, false, byId[pid]?.position ?? null, byId[pid]?.jersey_number ?? null, i, i + 1, actor.userId]),
  ];
  if (rows.length) {
    const params = [];
    const values = rows.map((r) => `(${r.map((v) => { params.push(v); return `$${params.length}`; }).join(', ')}, $${params.push(actor.userId)})`);
    await query(`INSERT INTO match_lineups (match_id, team_id, player_id, is_starting, position, shirt_number, sort_order, substitute_order, created_by, updated_by) VALUES ${values.join(', ')}`, params, client);
  }
  if (formation !== undefined) await query(`UPDATE matches SET ${side}_formation = $2 WHERE id = $1`, [match.id, formation], client);
}

/**
 * Saves one side's line-up: exactly 11 starters (with a goalkeeper), up to 9 substitutes, all
 * current members of that team, nobody listed twice.
 */
export async function saveLineup(actor, id, { side: sideParam, team_id: teamIdParam, formation, starting, substitutes = [] }) {
  const lineup = await withTransaction(async (client) => {
    const match = await loadOwned(actor, id, client);
    const teamId = teamIdParam ?? (sideParam === 'home' ? match.home_team_id : sideParam === 'away' ? match.away_team_id : null);
    const side = sideOf(match, teamId);
    if (!side) throw unprocessable('TEAM_NOT_IN_MATCH', 'The team does not play in this match', { i18nKey: 'matches.errors.playerNotInMatch' });
    if (!isAdmin(actor) && !canAccessTeam(actor, teamId)) throw forbidden('You can only set the line-up of your own team');
    if (match.status === 'cancelled') throw unprocessable('MATCH_CANCELLED', 'The match was cancelled', { i18nKey: 'matches.errors.notStarted' });
    if (formation !== undefined && !FORMATIONS.includes(formation)) throw unprocessable('INVALID_FORMATION', 'Unknown formation', { fields: { formation: 'validation.invalid' } });
    if (starting.length !== 11) throw unprocessable('ELEVEN_REQUIRED', 'The starting line-up needs exactly 11 players', { i18nKey: 'matches.lineup.errors.elevenRequired', fields: { starting: 'matches.lineup.errors.elevenRequired' } });
    if (substitutes.length > 9) throw unprocessable('TOO_MANY_SUBSTITUTES', 'At most 9 substitutes', { fields: { substitutes: 'validation.range' } });
    const all = [...starting, ...substitutes];
    if (new Set(all).size !== all.length) throw unprocessable('DUPLICATE_LINEUP_PLAYER', 'A player can only appear once in a line-up', { fields: { starting: 'validation.invalid' } });
    const members = await many(`SELECT id, position FROM players WHERE id = ANY($1::uuid[]) AND team_id = $2 AND deleted_at IS NULL`, [all, teamId], client);
    if (members.length !== all.length) throw unprocessable('PLAYER_NOT_IN_TEAM', 'Every player must belong to the team', { i18nKey: 'matches.errors.playerNotInMatch', fields: { starting: 'matches.errors.playerNotInMatch' } });
    if (!members.some((p) => starting.includes(p.id) && p.position === 'goalkeeper')) {
      throw unprocessable('GOALKEEPER_REQUIRED', 'The starting line-up needs a goalkeeper', { i18nKey: 'matches.lineup.errors.goalkeeperRequired', fields: { starting: 'matches.lineup.errors.goalkeeperRequired' } });
    }
    await writeLineup(client, actor, match, teamId, { formation, starting, substitutes });
    await recomputeMatch(client, id, { score: 'keep' });
    if (['scheduled', 'live'].includes(match.status)) await notifyMatchReminder(client, match, 'lineup', { lineupTeamId: teamId });
    await audit(client, actor, 'match.lineup', 'match', id, { team_id: teamId, formation, starting, substitutes });
    const saved = await lineupOf(client, match, teamId);
    return { formation: formation ?? match[`${side}_formation`] ?? '4-3-3', ...saved };
  });
  return lineup;
}

// ------------------------------------------------------------------ events

/** Who is on the pitch for a side at a given minute (from the line-up and earlier events). */
function onPitch(lineup, events, teamId, minute) {
  const on = new Set(lineup.starting);
  for (const e of events.filter((x) => x.team_id === teamId && x.minute <= minute).sort((a, b) => a.minute - b.minute)) {
    if (e.event_type === 'substitution') {
      on.delete(e.related_player_id);
      on.add(e.player_id);
    }
    if (e.event_type === 'red_card') on.delete(e.player_id);
  }
  return on;
}

function parseEventInput(data) {
  if (data.event_type === 'substitution') {
    // Preferred: explicit fields. Legacy (apps): player_id = going off, related_player_id = coming on.
    const inId = data.player_in_id ?? data.related_player_id;
    const outId = data.player_out_id ?? data.player_id;
    return { playerId: inId, relatedId: outId };
  }
  return { playerId: data.player_id, relatedId: data.related_player_id ?? null };
}

export async function addEvent(actor, matchId, data) {
  const event = await withTransaction(async (client) => {
    const match = await loadOwned(actor, matchId, client);
    if (!['live', 'completed'].includes(match.status)) throw unprocessable('MATCH_NOT_STARTED', 'Events can only be recorded once the match has started', { i18nKey: 'matches.errors.notStarted' });
    const { playerId, relatedId } = parseEventInput(data);
    if (!playerId) throw new AppError(400, 'VALIDATION_FAILED', 'Validation failed', { fields: { player_id: 'validation.required' } });
    const people = await many(`SELECT id, team_id FROM players WHERE id = ANY($1::uuid[]) AND deleted_at IS NULL`, [[playerId, relatedId, data.assist_player_id].filter(Boolean)], client);
    const teamOf = Object.fromEntries(people.map((p) => [p.id, p.team_id]));
    const teamId = data.team_id ?? teamOf[playerId];
    const side = sideOf(match, teamId);
    if (!side) throw unprocessable('PLAYER_NOT_IN_MATCH', 'The player does not play in this match', { i18nKey: 'matches.errors.playerNotInMatch', fields: { player_id: 'matches.errors.playerNotInMatch' } });
    for (const pid of [playerId, relatedId, data.assist_player_id].filter(Boolean)) {
      if (teamOf[pid] !== teamId) throw unprocessable('PLAYER_NOT_IN_TEAM', 'All players of an event must belong to the same team', { i18nKey: 'matches.errors.playerNotInMatch', fields: { player_id: 'matches.errors.playerNotInMatch' } });
    }
    if (relatedId && relatedId === playerId) throw unprocessable('SAME_PLAYER', 'The two players must be different', { fields: { related_player_id: 'validation.invalid' } });
    if (data.event_type === 'substitution' && !relatedId) throw new AppError(400, 'VALIDATION_FAILED', 'Validation failed', { fields: { related_player_id: 'validation.required' } });
    const minute = Number(data.minute);
    if (match.status === 'live' && match.live_minute && minute > match.live_minute + 15) throw unprocessable('MINUTE_IN_FUTURE', 'The minute is later than the live clock', { fields: { minute: 'validation.range' } });

    const events = await eventsOf(matchId, client);
    let lineup = await lineupOf(client, match, teamId);
    if (lineup) {
      const pitch = onPitch(lineup, events, teamId, minute);
      if (data.event_type === 'substitution') {
        if (!pitch.has(relatedId)) throw unprocessable('PLAYER_NOT_ON_PITCH', 'The player going off is not on the pitch at that minute', { i18nKey: 'matches.errors.playerNotInMatch', fields: { player_id: 'matches.errors.playerNotInMatch' } });
        const used = events.some((e) => e.team_id === teamId && e.event_type === 'substitution' && (e.player_id === playerId || e.related_player_id === playerId));
        if (!lineup.starting.includes(playerId) && !lineup.substitutes.includes(playerId)) {
          // A squad member who was not named on the bench joins it before coming on.
          await query(
            `INSERT INTO match_lineups (match_id, team_id, player_id, is_starting, position, shirt_number, sort_order, substitute_order, created_by, updated_by)
             SELECT $1, $2, p.id, false, p.position, p.jersey_number, $4, $4 + 1, $3, $3 FROM players p WHERE p.id = $5`,
            [matchId, teamId, actor.userId, lineup.substitutes.length, playerId],
            client,
          );
          lineup.substitutes.push(playerId);
        }
        if (!lineup.substitutes.includes(playerId) || pitch.has(playerId) || used) throw unprocessable('PLAYER_NOT_ON_BENCH', 'The player coming on must be an unused substitute', { i18nKey: 'matches.errors.playerNotInMatch', fields: { related_player_id: 'matches.errors.playerNotInMatch' } });
      } else {
        const squad = new Set([...lineup.starting, ...lineup.substitutes]);
        if (!squad.has(playerId)) throw unprocessable('PLAYER_NOT_IN_SQUAD', 'The player is not in the match squad', { i18nKey: 'matches.errors.playerNotInMatch', fields: { player_id: 'matches.errors.playerNotInMatch' } });
        if ([...GOAL_EVENT_TYPES, 'own_goal', 'assist'].includes(data.event_type) && !pitch.has(playerId)) {
          throw unprocessable('PLAYER_NOT_ON_PITCH', 'The player was not on the pitch at that minute', { i18nKey: 'matches.errors.playerNotInMatch', fields: { player_id: 'matches.errors.playerNotInMatch' } });
        }
        if (data.assist_player_id && !pitch.has(data.assist_player_id)) {
          throw unprocessable('ASSIST_NOT_ON_PITCH', 'The assisting player was not on the pitch', { i18nKey: 'matches.errors.playerNotInMatch', fields: { assist_player_id: 'matches.errors.playerNotInMatch' } });
        }
      }
    } else {
      // No line-up recorded for this side yet: everyone involved joins the squad so minutes count.
      const starting = [data.event_type === 'substitution' ? relatedId : playerId, data.assist_player_id].filter(Boolean);
      lineup = { starting, substitutes: data.event_type === 'substitution' ? [playerId] : [] };
      await writeLineup(client, actor, match, teamId, lineup);
    }

    const ev = await one(
      `INSERT INTO match_events (match_id, team_id, player_id, related_player_id, event_type, minute, additional_minute, description, created_by, updated_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $9) RETURNING *`,
      [matchId, teamId, playerId, relatedId, data.event_type, minute, data.additional_minute ?? null, data.description?.trim() ?? '', actor.userId],
      client,
    );
    if (GOAL_EVENT_TYPES.includes(data.event_type) && data.assist_player_id) {
      await query(
        `INSERT INTO match_events (match_id, team_id, player_id, related_player_id, event_type, minute, additional_minute, created_by, updated_by)
         VALUES ($1, $2, $3, $4, 'assist', $5, $6, $7, $7)`,
        [matchId, teamId, data.assist_player_id, playerId, minute, data.additional_minute ?? null, actor.userId],
        client,
      );
    }
    const scoring = [...GOAL_EVENT_TYPES, 'own_goal'].includes(data.event_type);
    const updated = await recomputeMatch(client, matchId, { score: scoring ? 'events' : 'auto' });
    if (scoring && data.event_type !== 'own_goal') {
      const scorer = await one(`SELECT u.id, u.role FROM players p JOIN users u ON u.id = p.user_id WHERE p.id = $1`, [playerId], client);
      await notify(client, [scorer], {
        subtype: 'match_result',
        templates: {},
        fallback: { title: 'Goal recorded', message: `Your goal at ${minute}' was recorded (${updated.home_score}–${updated.away_score}). Your statistics have been updated.` },
        referenceType: 'match',
        referenceId: matchId,
      });
    }
    await audit(client, actor, 'match.event_added', 'match', matchId, { event_id: ev.id, type: data.event_type, minute, player_id: playerId, related_player_id: relatedId, assist_player_id: data.assist_player_id ?? null });
    return ev;
  });
  const people = await playerSummaries([event.player_id, event.related_player_id]);
  return serializeEvent(event, (pid) => people[pid] ?? null);
}

/** Minute / description corrections (players and type are fixed — delete and re-add instead). */
export async function updateEvent(actor, matchId, eventId, data) {
  const event = await withTransaction(async (client) => {
    await loadOwned(actor, matchId, client);
    const current = await one(`SELECT * FROM match_events WHERE id = $1 AND match_id = $2`, [eventId, matchId], client);
    if (!current) throw notFound('Match event');
    const cols = ['minute', 'additional_minute', 'description'].filter((k) => data[k] !== undefined);
    const row = await one(
      `UPDATE match_events SET ${cols.map((k, i) => `${k} = $${i + 2}`).join(', ')}, updated_by = $${cols.length + 2} WHERE id = $1 RETURNING *`,
      [eventId, ...cols.map((k) => data[k]), actor.userId],
      client,
    );
    if (GOAL_EVENT_TYPES.includes(current.event_type) && data.minute !== undefined) {
      await query(`UPDATE match_events SET minute = $4 WHERE match_id = $1 AND event_type = 'assist' AND related_player_id = $2 AND minute = $3`, [matchId, current.player_id, current.minute, data.minute], client);
    }
    await recomputeMatch(client, matchId);
    await audit(client, actor, 'match.event_updated', 'match', matchId, { event_id: eventId, ...data });
    return row;
  });
  const people = await playerSummaries([event.player_id, event.related_player_id]);
  return serializeEvent(event, (pid) => people[pid] ?? null);
}

export async function removeEvent(actor, matchId, eventId) {
  await withTransaction(async (client) => {
    await loadOwned(actor, matchId, client);
    const ev = await one(`DELETE FROM match_events WHERE id = $1 AND match_id = $2 RETURNING *`, [eventId, matchId], client);
    if (!ev) throw notFound('Match event');
    if (GOAL_EVENT_TYPES.includes(ev.event_type)) {
      // The assist recorded with the goal goes with it.
      await query(`DELETE FROM match_events WHERE match_id = $1 AND event_type = 'assist' AND related_player_id = $2 AND minute = $3`, [matchId, ev.player_id, ev.minute], client);
    }
    const scoring = [...GOAL_EVENT_TYPES, 'own_goal'].includes(ev.event_type);
    await recomputeMatch(client, matchId, { score: scoring ? 'events' : 'auto' });
    await audit(client, actor, 'match.event_removed', 'match', matchId, { event_id: eventId, type: ev.event_type, minute: ev.minute });
  });
  return { ok: true };
}

