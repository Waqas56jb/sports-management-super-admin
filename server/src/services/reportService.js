/**
 * Reports: structured JSON rows for charts / tables / CSV export. Admins see everything; coaches
 * get the same reports limited to their teams. Labels and formatting stay in the apps.
 */
import { many } from '../config/database.js';
import { assertTeamAccess, teamScope } from '../utils/permissions.js';
import { MATCH_SELECT, teamSummaries } from './shared.js';
import { attendanceGroups, computePlayerStats, computeTeamRecords, withPlayerAndTeam } from './statisticsService.js';

export const REPORT_TYPES = ['players', 'teams', 'matches', 'attendance', 'competitions', 'performance'];
/** Spec names → report types. */
export const REPORT_ALIASES = { 'player-performance': 'performance', 'team-performance': 'teams', attendance: 'attendance', matches: 'matches' };

export async function generate(actor, type, q = {}) {
  if (q.team_id) assertTeamAccess(actor, q.team_id);
  const scope = q.team_id ? [q.team_id] : teamScope(actor);
  const filters = { competitionId: q.competition_id, season: q.season, from: q.date_from, to: q.date_to };
  let rows = [];

  if (type === 'players') {
    const players = await many(
      `SELECT vp.*, json_build_object('id', t.id, 'name', t.name, 'short_name', t.short_name, 'color', t.color, 'logo', t.logo_url) AS team
       FROM v_players vp LEFT JOIN teams t ON t.id = vp.team_id
       WHERE ($1::uuid[] IS NULL OR vp.team_id = ANY($1::uuid[])) AND ($2::date IS NULL OR vp.registration_date <= $2) ORDER BY vp.name`,
      [scope, q.date_to ?? null],
    );
    const stats = Object.fromEntries((await computePlayerStats({ ...filters, playerIds: players.map((p) => p.id) })).map((s) => [s.player_id, s]));
    rows = players.map((p) => ({ ...p, team: p.team?.id ? p.team : null, statistics: stats[p.id] ?? null }));
  }

  if (type === 'teams') {
    const [teams, records, attendance] = await Promise.all([
      many(
        `SELECT t.*, (SELECT trim(u.first_name || ' ' || u.last_name) FROM coaches c JOIN users u ON u.id = c.user_id WHERE c.id = t.coach_id) AS coach,
                (SELECT count(*)::int FROM players p WHERE p.team_id = t.id AND p.deleted_at IS NULL) AS players_count
         FROM v_teams t WHERE ($1::uuid[] IS NULL OR t.id = ANY($1::uuid[])) ORDER BY t.name`,
        [scope],
      ),
      computeTeamRecords(filters),
      attendanceGroups({ groupBy: 'team', teamIds: scope ?? undefined, from: q.date_from, to: q.date_to }),
    ]);
    const byTeam = Object.fromEntries(records.map((r) => [r.team_id, r]));
    rows = teams.map((t) => ({ ...t, record: byTeam[t.id] ?? null, attendance_rate: attendance[t.id]?.rate ?? null }));
  }

  if (type === 'matches') {
    rows = await many(
      `${MATCH_SELECT}
       WHERE ($1::uuid[] IS NULL OR m.home_team_id = ANY($1::uuid[]) OR m.away_team_id = ANY($1::uuid[]))
         AND ($2::uuid IS NULL OR m.competition_id = $2) AND ($3::text IS NULL OR mc.season = $3)
         AND ($4::date IS NULL OR m.date >= $4) AND ($5::date IS NULL OR m.date <= $5)
       ORDER BY m.date DESC, m.time DESC`,
      [scope, q.competition_id ?? null, q.season ?? null, q.date_from ?? null, q.date_to ?? null],
    );
  }

  if (type === 'attendance') {
    const byPlayer = await attendanceGroups({ groupBy: 'player', teamIds: scope ?? undefined, from: q.date_from, to: q.date_to });
    const withPeople = await withPlayerAndTeam(Object.entries(byPlayer).map(([player_id, s]) => ({ player_id, ...s })));
    const teams = await teamSummaries([...new Set(withPeople.map((r) => r.player?.team_id).filter(Boolean))]);
    rows = withPeople
      .filter((r) => r.player)
      .map(({ player_id: _id, team: _t, ...r }) => ({ ...r, team: teams[r.player.team_id] ?? null }))
      .sort((a, b) => a.player.name.localeCompare(b.player.name));
  }

  if (type === 'competitions') {
    rows = await many(
      `SELECT c.*, cardinality(c.team_ids) AS teams_count,
              (SELECT count(*)::int FROM v_matches m WHERE m.competition_id = c.id) AS matches_total,
              (SELECT count(*)::int FROM v_matches m WHERE m.competition_id = c.id AND m.status = 'completed') AS matches_played,
              (SELECT coalesce(sum(m.home_score + m.away_score), 0)::int FROM v_matches m WHERE m.competition_id = c.id AND m.status = 'completed') AS goals
       FROM v_competitions c
       WHERE ($1::uuid IS NULL OR c.id = $1) AND ($2::text IS NULL OR c.season = $2) AND ($3::uuid[] IS NULL OR c.team_ids && $3::uuid[])
         AND ($4::date IS NULL OR c.end_date >= $4) AND ($5::date IS NULL OR c.start_date <= $5)
       ORDER BY c.start_date DESC`,
      [q.competition_id ?? null, q.season ?? null, scope, q.date_from ?? null, q.date_to ?? null],
    );
  }

  if (type === 'performance') {
    const stats = await computePlayerStats({ ...filters, teamIds: scope ?? undefined });
    rows = (await withPlayerAndTeam(stats.filter((s) => s.matches_played > 0))).sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
  }

  return { type, rows, generated_at: new Date().toISOString(), filters: q };
}
