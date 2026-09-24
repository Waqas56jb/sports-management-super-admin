/**
 * Dashboards in one request each (GET /dashboard/admin | coach | player). The coach and player
 * dashboards live with their services; this module builds the system-wide admin view.
 */
import { many, one } from '../config/database.js';
import { addDays, toISODate, todayISO } from '../utils/dates.js';
import { cleanSession, currentLeague, MATCH_SELECT, SESSION_SELECT, teamSummaries } from './shared.js';
import { attendanceGroups, attendanceTrend, computePlayerStats, computeTeamRecords, withPlayerAndTeam } from './statisticsService.js';
import { dashboard as coachDashboard } from './coachService.js';
import { dashboard as playerDashboard } from './playerService.js';

export async function admin() {
  const today = todayISO();
  const weekAhead = toISODate(addDays(new Date(), 7));
  const from = toISODate(addDays(new Date(), -56));
  const league = await currentLeague();
  const seasonScope = league ? { competitionId: league.id } : {};

  const [counts, live, upcoming, recent, training, byTeam, trend, attendanceSummary, records, stats, users, notifications] = await Promise.all([
    one(
      `SELECT (SELECT count(*)::int FROM players WHERE deleted_at IS NULL) AS players,
              (SELECT count(*)::int FROM players WHERE deleted_at IS NULL AND status = 'active') AS active_players,
              (SELECT count(*)::int FROM coaches WHERE deleted_at IS NULL) AS coaches,
              (SELECT count(DISTINCT ct.coach_id)::int FROM coach_teams ct JOIN coaches c ON c.id = ct.coach_id AND c.deleted_at IS NULL WHERE ct.role = 'head_coach') AS assigned_coaches,
              (SELECT count(*)::int FROM teams WHERE deleted_at IS NULL) AS teams,
              (SELECT count(*)::int FROM teams WHERE deleted_at IS NULL AND status = 'active') AS active_teams,
              (SELECT count(*)::int FROM competitions WHERE deleted_at IS NULL AND status = 'active') AS active_competitions,
              (SELECT count(*)::int FROM competitions WHERE deleted_at IS NULL AND status = 'upcoming') AS upcoming_competitions,
              (SELECT count(*)::int FROM v_matches WHERE status = 'scheduled' AND date >= $1) AS upcoming_matches,
              (SELECT count(*)::int FROM v_matches WHERE status = 'live') AS live_matches,
              (SELECT count(*)::int FROM v_training_sessions WHERE date >= $1 AND status <> 'cancelled') AS upcoming_training,
              (SELECT count(*)::int FROM v_training_sessions WHERE date BETWEEN $1 AND $2 AND status <> 'cancelled') AS training_this_week`,
      [today, weekAhead],
    ),
    many(`${MATCH_SELECT} WHERE m.status = 'live' ORDER BY m.date, m.time`),
    many(`${MATCH_SELECT} WHERE m.status = 'scheduled' AND m.date >= $1 ORDER BY m.date, m.time LIMIT 5`, [today]),
    many(`${MATCH_SELECT} WHERE m.status = 'completed' ORDER BY m.date DESC, m.time DESC LIMIT 5`),
    many(`${SESSION_SELECT} WHERE s.date >= $1 AND s.status <> 'cancelled' ORDER BY s.date, s.start_time LIMIT 5`, [today]),
    many(
      `SELECT t.id, (count(p.id) FILTER (WHERE p.status = 'active'))::int AS active, (count(p.id) FILTER (WHERE p.status <> 'active'))::int AS unavailable, count(p.id)::int AS total
       FROM v_teams t LEFT JOIN players p ON p.team_id = t.id AND p.deleted_at IS NULL GROUP BY t.id, t.name ORDER BY t.name`,
    ),
    attendanceTrend({ granularity: 'week', keyName: 'week', from, to: today }),
    attendanceGroups({ from, to: today }),
    computeTeamRecords(seasonScope),
    computePlayerStats(seasonScope),
    one(`SELECT count(*)::int AS total, (count(*) FILTER (WHERE last_login_at > now() - interval '7 days'))::int AS active_last_week FROM users WHERE deleted_at IS NULL`),
    one(`SELECT count(*)::int AS total, (count(*) FILTER (WHERE created_at > now() - interval '7 days'))::int AS last_week FROM notifications`),
  ]);

  const teamIds = byTeam.map((t) => t.id);
  const teams = await teamSummaries(teamIds);
  const played = stats.filter((s) => s.matches_played > 0);
  const topPlayers = await withPlayerAndTeam(
    [...played].sort((a, b) => b.goals * 3 + b.assists * 2 + (b.rating ?? 0) - (a.goals * 3 + a.assists * 2 + (a.rating ?? 0))).slice(0, 5),
  );

  return {
    counts,
    live,
    upcomingMatches: upcoming,
    recentResults: recent,
    upcomingTraining: training.map(cleanSession),
    playersByTeam: byTeam.map((t) => ({ team: teams[t.id], active: t.active, unavailable: t.unavailable, total: t.total })),
    attendanceTrend: trend,
    attendanceSummary,
    matchResults: records.map((r) => ({ ...r, team: teams[r.team_id] })),
    topPlayers,
    performanceByTeam: teamIds.map((id) => {
      const rows = played.filter((s) => s.team_id === id);
      const rated = rows.filter((s) => s.rating !== null);
      return {
        team: teams[id],
        goals: rows.reduce((s, r) => s + r.goals, 0),
        assists: rows.reduce((s, r) => s + r.assists, 0),
        rating: rated.length ? Math.round((rated.reduce((s, r) => s + r.rating, 0) / rated.length) * 100) / 100 : null,
      };
    }),
    season: league,
    system: { users, notifications },
  };
}

export const coach = (actor) => coachDashboard(actor);
export const player = (actor) => playerDashboard(actor);
