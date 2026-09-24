/**
 * Competitions: admin CRUD + participating teams; read-only, team-scoped views for coaches and
 * players. Standings are always computed on the server from completed matches.
 */
import { many, one, pool, query, withTransaction } from '../config/database.js';
import { conflict, forbidden, notFound, unprocessable } from '../utils/errors.js';
import { SqlBuilder } from '../utils/filters.js';
import { canAccessCompetition, isAdmin, isCoach, isPlayer, teamScope } from '../utils/permissions.js';
import { buildPagination, parsePagination } from '../utils/pagination.js';
import { audit, getEnrichedMatches, teamSummaries } from './shared.js';
import { computePlayerStats, recomputeStandings, standings, withPlayerAndTeam } from './statisticsService.js';
import { notifyCompetitionUpdate } from './notificationService.js';

const COMP_SORT = { start_date: 'c.start_date', end_date: 'c.end_date', name: 'c.name', season: 'c.season', status: 'c.status', created_at: 'c.created_at' };

async function loadCompetition(id, client = pool) {
  const c = await one(`SELECT * FROM v_competitions WHERE id = $1`, [id], client);
  if (!c) throw notFound('Competition');
  return c;
}

function scopedFilter(actor, q) {
  const b = new SqlBuilder();
  const scope = teamScope(actor);
  if (scope) b.where('c.team_ids && ?::uuid[]', scope);
  b.whereIf(q.status, 'c.status = ?', q.status);
  b.whereIf(q.type, 'c.type = ?', q.type);
  b.whereIf(q.season, 'c.season = ?', q.season);
  b.search(q.search, ['c.name', 'c.location', 'c.season']);
  return b;
}

async function matchCounts(ids, scope) {
  if (!ids.length) return {};
  const rows = await many(
    `SELECT m.competition_id AS id, count(*)::int AS total, (count(*) FILTER (WHERE m.status = 'completed'))::int AS completed,
            (count(*) FILTER (WHERE $2::uuid[] IS NULL OR m.home_team_id = ANY($2::uuid[]) OR m.away_team_id = ANY($2::uuid[])))::int AS mine
     FROM v_matches m WHERE m.competition_id = ANY($1::uuid[]) GROUP BY m.competition_id`,
    [ids, scope],
  );
  return Object.fromEntries(rows.map((r) => [r.id, r]));
}

// ------------------------------------------------------------------ reads

export async function list(actor, q = {}) {
  const b = scopedFilter(actor, q);
  const sort = COMP_SORT[q.sortBy] ?? 'c.start_date';
  const dir = String(q.sortOrder ?? 'desc').toLowerCase() === 'asc' ? 'ASC' : 'DESC';
  const scope = teamScope(actor);

  if (isPlayer(actor)) {
    const rows = await many(`SELECT c.* FROM v_competitions c ${b.clause} ORDER BY c.start_date DESC`, b.params);
    const counts = await matchCounts(rows.map((r) => r.id), scope);
    const team = (await teamSummaries([actor.teamId]))[actor.teamId] ?? null;
    return Promise.all(
      rows.map(async (c) => {
        const table = c.type === 'league' ? await standings(c.id) : [];
        const pos = table.findIndex((r) => r.team_id === actor.teamId) + 1;
        return { ...c, team, teams_count: c.team_ids.length, matches_total: counts[c.id]?.total ?? 0, my_matches: counts[c.id]?.mine ?? 0, matches_completed: counts[c.id]?.completed ?? 0, position: pos || null, points: table[pos - 1]?.points ?? null };
      }),
    );
  }

  const p = parsePagination(q, { defaultLimit: 10 });
  const params = [...b.params];
  const [rows, count] = await Promise.all([
    many(`SELECT c.* FROM v_competitions c ${b.clause} ORDER BY ${sort} ${dir}, c.name LIMIT $${params.length + 1} OFFSET $${params.length + 2}`, [...params, p.limit, p.offset]),
    one(`SELECT count(*)::int AS total FROM v_competitions c ${b.clause}`, params),
  ]);
  const [counts, teams] = await Promise.all([matchCounts(rows.map((r) => r.id), scope), teamSummaries([...new Set(rows.flatMap((r) => r.team_ids))])]);
  const data = rows.map((c) => ({
    ...c,
    teams: c.team_ids.map((id) => teams[id]).filter(Boolean),
    matches_total: counts[c.id]?.total ?? 0,
    matches_completed: counts[c.id]?.completed ?? 0,
    ...(isCoach(actor) ? { my_teams: c.team_ids.filter((t) => scope.includes(t)).map((id) => teams[id]), my_matches: counts[c.id]?.mine ?? 0 } : {}),
  }));
  return { rows: data, pagination: buildPagination(count.total, p) };
}

export async function options(actor) {
  const scope = teamScope(actor);
  const rows = await many(`SELECT c.id, c.name, c.season, c.status, c.type, c.team_ids FROM v_competitions c ${scope ? 'WHERE c.team_ids && $1::uuid[]' : ''} ORDER BY c.start_date DESC`, scope ? [scope] : []);
  return isAdmin(actor) ? rows : rows.map(({ team_ids: _t, ...r }) => r);
}

export async function seasons(actor) {
  const scope = teamScope(actor);
  const rows = await many(`SELECT DISTINCT c.season FROM v_competitions c ${scope ? 'WHERE c.team_ids && $1::uuid[]' : ''} ORDER BY c.season DESC`, scope ? [scope] : []);
  return rows.map((r) => r.season);
}

export async function get(actor, id) {
  const comp = await loadCompetition(id);
  if (!canAccessCompetition(actor, comp)) throw forbidden('Your team does not take part in this competition');
  const scope = teamScope(actor) ?? [];
  const [teams, table, upcoming, completed, stats] = await Promise.all([
    teamSummaries(comp.team_ids),
    standings(id),
    getEnrichedMatches(`WHERE m.competition_id = $1 AND m.status IN ('scheduled', 'live')`, [id], pool, { order: 'm.date, m.time', details: false }),
    getEnrichedMatches(`WHERE m.competition_id = $1 AND m.status = 'completed'`, [id], pool, { order: 'm.date DESC, m.time DESC', details: false }),
    computePlayerStats({ competitionId: id }),
  ]);
  const played = stats.filter((s) => s.matches_played > 0);
  const goals = completed.reduce((s, m) => s + m.home_score + m.away_score, 0);
  const all = await one(`SELECT count(*)::int AS n FROM v_matches WHERE competition_id = $1`, [id]);
  const scorers = await withPlayerAndTeam(played.filter((s) => s.goals > 0).sort((a, b) => b.goals - a.goals || b.assists - a.assists).slice(0, 5));

  const base = {
    ...comp,
    teams: comp.team_ids.map((t) => teams[t]).filter(Boolean),
    matches_total: all.n,
    matches_completed: completed.length,
    standings: table.map((r) => ({ ...r, ...(isCoach(actor) ? { mine: scope.includes(r.team_id) } : {}) })),
    top_scorers: scorers.map((s) => ({ ...s, ...(isCoach(actor) ? { mine: scope.includes(s.team_id) } : {}), ...(isPlayer(actor) ? { is_me: s.player_id === actor.playerId } : {}) })),
    totals: {
      matches: all.n,
      played: completed.length,
      goals,
      goals_per_match: completed.length ? Math.round((goals / completed.length) * 100) / 100 : 0,
      yellow_cards: played.reduce((s, r) => s + r.yellow_cards, 0),
      red_cards: played.reduce((s, r) => s + r.red_cards, 0),
    },
  };
  if (isPlayer(actor)) return { ...base, my_team: teams[actor.teamId] ?? null, fixtures: upcoming, results: completed };
  const result = { ...base, upcoming_matches: upcoming, completed_matches: completed };
  if (isCoach(actor)) {
    result.my_teams = comp.team_ids.filter((t) => scope.includes(t)).map((t) => teams[t]);
    result.my_matches = [...upcoming, ...completed].filter((m) => scope.includes(m.home_team_id) || scope.includes(m.away_team_id)).length;
  }
  return result;
}

export async function listTeams(actor, id) {
  const comp = await loadCompetition(id);
  if (!canAccessCompetition(actor, comp)) throw forbidden();
  return many(
    `SELECT ct.team_id, ct.played, ct.won, ct.drawn, ct.lost, ct.goals_for, ct.goals_against, ct.points, ct.position,
            json_build_object('id', t.id, 'name', t.name, 'short_name', t.short_name, 'color', t.color, 'logo', t.logo_url) AS team
     FROM competition_teams ct JOIN teams t ON t.id = ct.team_id AND t.deleted_at IS NULL WHERE ct.competition_id = $1 ORDER BY ct.position NULLS LAST, t.name`,
    [id],
  );
}

// ------------------------------------------------------------------ admin writes

const FIELDS = ['name', 'type', 'season', 'description', 'start_date', 'end_date', 'status', 'location'];

async function syncTeams(client, actor, comp, teamIds) {
  const current = new Set(comp.team_ids ?? []);
  const next = new Set(teamIds);
  const removing = [...current].filter((t) => !next.has(t));
  if (removing.length) {
    const used = await one(
      `SELECT count(*)::int AS n FROM matches WHERE competition_id = $1 AND deleted_at IS NULL AND (home_team_id = ANY($2::uuid[]) OR away_team_id = ANY($2::uuid[]))`,
      [comp.id, removing],
      client,
    );
    if (used.n) throw unprocessable('TEAM_HAS_MATCHES', 'A team with fixtures in this competition cannot be removed', { i18nKey: 'competitions.errors.teamHasMatches', fields: { team_ids: 'competitions.errors.teamHasMatches' } });
    await query(`DELETE FROM competition_teams WHERE competition_id = $1 AND team_id = ANY($2::uuid[])`, [comp.id, removing], client);
  }
  const adding = [...next].filter((t) => !current.has(t));
  if (adding.length) {
    const found = await many(`SELECT id FROM teams WHERE id = ANY($1::uuid[]) AND deleted_at IS NULL`, [adding], client);
    if (found.length !== adding.length) throw unprocessable('TEAM_NOT_FOUND', 'One of the teams does not exist', { i18nKey: 'errors.notFound', fields: { team_ids: 'errors.notFound' } });
    await query(`INSERT INTO competition_teams (competition_id, team_id) SELECT $1, unnest($2::uuid[]) ON CONFLICT DO NOTHING`, [comp.id, adding], client);
  }
  if (removing.length || adding.length) await recomputeStandings(client, comp.id);
  return adding;
}

export async function create(actor, data) {
  const id = await withTransaction(async (client) => {
    const cols = FIELDS.filter((k) => data[k] !== undefined);
    const row = await one(
      `INSERT INTO competitions (${cols.join(', ')}, created_by, updated_by) VALUES (${cols.map((_, i) => `$${i + 1}`).join(', ')}, $${cols.length + 1}, $${cols.length + 1}) RETURNING id, name, season`,
      [...cols.map((k) => data[k]), actor.userId],
      client,
    );
    await syncTeams(client, actor, { id: row.id, team_ids: [] }, data.team_ids ?? []);
    await notifyCompetitionUpdate(client, { id: row.id, name: row.name, season: row.season }, 'created', data.team_ids ?? []);
    await audit(client, actor, 'competition.created', 'competition', row.id, { name: data.name });
    return row.id;
  });
  return loadCompetition(id);
}

export async function update(actor, id, data) {
  const comp = await loadCompetition(id);
  await withTransaction(async (client) => {
    const cols = FIELDS.filter((k) => data[k] !== undefined);
    if (cols.length) await query(`UPDATE competitions SET ${cols.map((k, i) => `${k} = $${i + 2}`).join(', ')}, updated_by = $${cols.length + 2} WHERE id = $1`, [id, ...cols.map((k) => data[k]), actor.userId], client);
    if (data.team_ids) {
      const added = await syncTeams(client, actor, comp, data.team_ids);
      if (added.length) await notifyCompetitionUpdate(client, { id, name: data.name ?? comp.name, season: data.season ?? comp.season }, 'teams', added);
    }
    await audit(client, actor, 'competition.updated', 'competition', id, data);
  });
  return loadCompetition(id);
}

/** Competitions with fixtures keep their results: they cannot be deleted. */
export async function remove(actor, id) {
  await loadCompetition(id);
  const used = await one(`SELECT count(*)::int AS n FROM matches WHERE competition_id = $1 AND deleted_at IS NULL`, [id]);
  if (used.n) throw conflict('COMPETITION_HAS_MATCHES', 'This competition has fixtures and cannot be deleted', { i18nKey: 'competitions.errors.hasMatches' });
  await withTransaction(async (client) => {
    await query(`DELETE FROM competition_teams WHERE competition_id = $1`, [id], client);
    await query(`UPDATE competitions SET deleted_at = now(), updated_by = $2 WHERE id = $1`, [id, actor.userId], client);
    await audit(client, actor, 'competition.deleted', 'competition', id);
  });
  return { ok: true };
}

export async function addTeam(actor, id, teamId) {
  const comp = await loadCompetition(id);
  if (comp.team_ids.includes(teamId)) throw conflict('TEAM_ALREADY_IN_COMPETITION', 'This team is already in the competition');
  await withTransaction(async (client) => {
    await syncTeams(client, actor, comp, [...comp.team_ids, teamId]);
    await notifyCompetitionUpdate(client, comp, 'teams', [teamId]);
    await audit(client, actor, 'competition.team_added', 'competition', id, { team_id: teamId });
  });
  return listTeams(actor, id);
}

export async function removeTeam(actor, id, teamId) {
  const comp = await loadCompetition(id);
  if (!comp.team_ids.includes(teamId)) throw notFound('Team in competition');
  await withTransaction(async (client) => {
    await syncTeams(client, actor, comp, comp.team_ids.filter((t) => t !== teamId));
    await audit(client, actor, 'competition.team_removed', 'competition', id, { team_id: teamId });
  });
  return { ok: true };
}
