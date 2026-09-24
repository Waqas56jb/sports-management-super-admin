/**
 * Shared read helpers: SQL fragments that build the embedded summaries every app expects
 * (home_team, competition, coach…), plus batched loaders so list endpoints never run N+1 queries.
 */
import { many, one, query } from '../config/database.js';
import { notFound } from '../utils/errors.js';

export const teamJson = (a) =>
  `CASE WHEN ${a}.id IS NULL THEN NULL ELSE json_build_object('id', ${a}.id, 'name', ${a}.name, 'short_name', ${a}.short_name, 'color', ${a}.color, 'logo', ${a}.logo_url) END`;

export const competitionJson = (a) =>
  `CASE WHEN ${a}.id IS NULL THEN NULL ELSE json_build_object('id', ${a}.id, 'name', ${a}.name, 'season', ${a}.season, 'type', ${a}.type) END`;

/** Coach summary from coaches (co) + users (cu). */
export const coachJson = (co, cu) =>
  `CASE WHEN ${co}.id IS NULL THEN NULL ELSE json_build_object('id', ${co}.id, 'name', trim(${cu}.first_name || ' ' || ${cu}.last_name), 'photo', ${cu}.avatar_url, 'license', ${co}.license) END`;

/** Player summary from v_players (vp). */
export const playerJson = (vp) =>
  `CASE WHEN ${vp}.id IS NULL THEN NULL ELSE json_build_object('id', ${vp}.id, 'name', ${vp}.name, 'photo', ${vp}.photo, 'position', ${vp}.position, 'jersey_number', ${vp}.jersey_number, 'team_id', ${vp}.team_id) END`;

/** Enriched match row: match + home_team + away_team + competition summaries. */
export const MATCH_SELECT = `
  SELECT m.*, ${teamJson('ht')} AS home_team, ${teamJson('awt')} AS away_team, ${competitionJson('mc')} AS competition
  FROM v_matches m
  JOIN teams ht ON ht.id = m.home_team_id
  JOIN teams awt ON awt.id = m.away_team_id
  LEFT JOIN competitions mc ON mc.id = m.competition_id`;

/** Enriched training session: session + team + coach summaries. */
export const SESSION_SELECT = `
  SELECT s.*, ${teamJson('st')} AS team, ${coachJson('sco', 'scu')} AS coach, trim(scu.first_name || ' ' || scu.last_name) AS coach_name
  FROM v_training_sessions s
  JOIN teams st ON st.id = s.team_id
  LEFT JOIN coaches sco ON sco.id = s.coach_id
  LEFT JOIN users scu ON scu.id = sco.user_id`;

export async function teamSummary(id, client) {
  if (!id) return null;
  return (await one(`SELECT ${teamJson('t')} AS team FROM teams t WHERE t.id = $1`, [id], client))?.team ?? null;
}

export async function teamSummaries(ids, client) {
  if (!ids?.length) return {};
  const rows = await many(`SELECT t.id, ${teamJson('t')} AS team FROM teams t WHERE t.id = ANY($1::uuid[])`, [ids], client);
  return Object.fromEntries(rows.map((r) => [r.id, r.team]));
}

export async function playerSummaries(ids, client) {
  const list = [...new Set(ids.filter(Boolean))];
  if (!list.length) return {};
  const rows = await many(`SELECT vp.id, ${playerJson('vp')} AS player FROM v_players vp WHERE vp.id = ANY($1::uuid[])`, [list], client);
  // Players removed later still appear in historical line-ups/events.
  const missing = list.filter((id) => !rows.some((r) => r.id === id));
  if (missing.length) {
    const old = await many(
      `SELECT p.id, json_build_object('id', p.id, 'name', trim(u.first_name || ' ' || u.last_name), 'photo', u.avatar_url, 'position', p.position, 'jersey_number', p.jersey_number, 'team_id', p.team_id) AS player
       FROM players p JOIN users u ON u.id = p.user_id WHERE p.id = ANY($1::uuid[])`,
      [missing],
      client,
    );
    rows.push(...old);
  }
  return Object.fromEntries(rows.map((r) => [r.id, r.player]));
}

/** Adds `lineups` and `team_stats` to match rows (two queries for the whole list). */
export async function attachMatchDetails(matches, client, { lineups = true, stats = true } = {}) {
  if (!matches.length) return matches;
  const ids = matches.map((m) => m.id);
  const [lineupRows, statRows] = await Promise.all([
    lineups
      ? many(
          `SELECT match_id, team_id, player_id, is_starting FROM match_lineups WHERE match_id = ANY($1::uuid[])
           ORDER BY match_id, is_starting DESC, sort_order, substitute_order NULLS LAST`,
          [ids],
          client,
        )
      : [],
    stats ? many(`SELECT * FROM match_statistics WHERE match_id = ANY($1::uuid[])`, [ids], client) : [],
  ]);
  for (const m of matches) {
    if (lineups) {
      const rows = lineupRows.filter((r) => r.match_id === m.id);
      if (rows.length) {
        const side = (teamId, formation) => {
          const mine = rows.filter((r) => r.team_id === teamId);
          if (!mine.length) return null;
          return {
            formation: formation ?? '4-3-3',
            starting: mine.filter((r) => r.is_starting).map((r) => r.player_id),
            substitutes: mine.filter((r) => !r.is_starting).map((r) => r.player_id),
          };
        };
        m.lineups = { home: side(m.home_team_id, m.home_formation), away: side(m.away_team_id, m.away_formation) };
      } else m.lineups = null;
    }
    if (stats) {
      const rows = statRows.filter((r) => r.match_id === m.id);
      const pick = (r) =>
        r && {
          possession: r.possession,
          shots: r.shots,
          shots_on_target: r.shots_on_target,
          corners: r.corners,
          fouls: r.fouls,
          offsides: r.offsides,
          yellow_cards: r.yellow_cards,
          red_cards: r.red_cards,
          passes: r.passes,
          completed_passes: r.completed_passes,
        };
      const home = rows.find((r) => r.team_id === m.home_team_id);
      const away = rows.find((r) => r.team_id === m.away_team_id);
      m.team_stats = home || away ? { home: pick(home) ?? null, away: pick(away) ?? null } : null;
    }
    delete m.home_formation;
    delete m.away_formation;
  }
  return matches;
}

export async function getEnrichedMatch(id, client) {
  const row = await one(`${MATCH_SELECT} WHERE m.id = $1`, [id], client);
  if (!row) throw notFound('Match');
  await attachMatchDetails([row], client);
  return row;
}

export async function getEnrichedMatches(whereSql, params, client, { order = 'm.date, m.time', details = true } = {}) {
  const rows = await many(`${MATCH_SELECT} ${whereSql} ORDER BY ${order}`, params, client);
  return details ? attachMatchDetails(rows, client) : rows;
}

export async function getSessionRow(id, client) {
  const row = await one(`${SESSION_SELECT} WHERE s.id = $1`, [id], client);
  if (!row) throw notFound('Training session');
  return row;
}

export function cleanSession(s) {
  const { coach_name: _coachName, ...rest } = s;
  return rest;
}

/** Current active league (used as the default "season" scope by dashboards). */
export async function currentLeague(client) {
  return one(
    `SELECT id, name, season FROM v_competitions WHERE status = 'active' ORDER BY (type = 'league') DESC, start_date DESC LIMIT 1`,
    [],
    client,
  );
}

/** Audit trail for sensitive writes. */
export async function audit(client, actor, action, entityType, entityId, changes = {}) {
  await query(
    `INSERT INTO audit_logs (actor_id, actor_role, action, entity_type, entity_id, changes) VALUES ($1, $2, $3, $4, $5, $6)`,
    [actor?.userId ?? null, actor?.role ?? 'system', action, entityType, entityId ?? null, JSON.stringify(changes)],
    client,
  );
}

/** Splits "Ahmed Hassan Robleh" → first "Ahmed", last "Hassan Robleh". */
export function splitName(name) {
  const parts = String(name ?? '').trim().split(/\s+/);
  return { first_name: parts.shift() ?? '', last_name: parts.join(' ') };
}

export const round1 = (n) => (n === null || n === undefined ? null : Math.round(n * 10) / 10);
export const round2 = (n) => (n === null || n === undefined ? null : Math.round(n * 100) / 100);
