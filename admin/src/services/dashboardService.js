import { addDays, parseDate, toISODate, todayISO } from '@/utils/format';
import { api, USE_MOCK } from './apiClient';
import { clone, delay, getDb } from './mock/db';
import { sortBy } from './mock/query';
import { enrichMatch, enrichSession, playerSummary, teamSummary } from './mock/relations';
import { attendanceRecordsInScope, computePlayerStats, computeTeamRecords, summarizeAttendance } from './mock/statsEngine';

export const dashboardService = {
  async overview() {
    if (!USE_MOCK) return api.get('/dashboard');
    await delay(500);
    const db = getDb();
    const today = todayISO();
    const currentLeague = db.competitions.find((c) => c.status === 'active' && c.type === 'league') ?? db.competitions.find((c) => c.status === 'active');

    const counts = {
      players: db.players.length,
      active_players: db.players.filter((p) => p.status === 'active').length,
      coaches: db.coaches.length,
      assigned_coaches: db.coaches.filter((c) => c.team_id).length,
      teams: db.teams.length,
      active_teams: db.teams.filter((t) => t.status === 'active').length,
      active_competitions: db.competitions.filter((c) => c.status === 'active').length,
      upcoming_competitions: db.competitions.filter((c) => c.status === 'upcoming').length,
      upcoming_matches: db.matches.filter((m) => m.status === 'scheduled' && m.date >= today).length,
      live_matches: db.matches.filter((m) => m.status === 'live').length,
      upcoming_training: db.trainingSessions.filter((s) => s.date >= today).length,
      training_this_week: db.trainingSessions.filter((s) => s.date >= today && s.date <= toISODate(addDays(new Date(), 7))).length,
    };

    const live = db.matches.filter((m) => m.status === 'live').map((m) => enrichMatch(db, m));
    const upcomingMatches = sortBy(db.matches.filter((m) => m.status === 'scheduled' && m.date >= today), 'date').slice(0, 5).map((m) => enrichMatch(db, m));
    const recentResults = sortBy(db.matches.filter((m) => m.status === 'completed'), 'date', 'desc').slice(0, 5).map((m) => enrichMatch(db, m));
    const upcomingTraining = db.trainingSessions
      .filter((s) => s.date >= today)
      .sort((a, b) => `${a.date}${a.start_time}`.localeCompare(`${b.date}${b.start_time}`))
      .slice(0, 5)
      .map((s) => enrichSession(db, s));

    const playersByTeam = db.teams.map((t) => {
      const roster = db.players.filter((p) => p.team_id === t.id);
      return {
        team: teamSummary(db, t.id),
        active: roster.filter((p) => p.status === 'active').length,
        unavailable: roster.filter((p) => p.status !== 'active').length,
        total: roster.length,
      };
    });

    // Attendance: last 8 weeks, weekly rate per team
    const from = toISODate(addDays(new Date(), -56));
    const records = attendanceRecordsInScope(db, { from, to: today });
    const weeks = {};
    records.forEach((r) => {
      const d = parseDate(r.session.date);
      const monday = toISODate(addDays(d, -((d.getDay() + 6) % 7)));
      ((weeks[monday] ??= {})[r.session.team_id] ??= []).push(r);
    });
    const attendanceTrend = Object.keys(weeks)
      .sort()
      .map((week) => {
        const row = { week };
        const all = [];
        Object.entries(weeks[week]).forEach(([tid, recs]) => {
          row[tid] = summarizeAttendance(recs).rate;
          all.push(...recs);
        });
        row.overall = summarizeAttendance(all).rate;
        return row;
      });
    const attendanceSummary = summarizeAttendance(records);

    const seasonScope = currentLeague ? { competitionId: currentLeague.id } : {};
    const matchResults = computeTeamRecords(db, seasonScope).map((r) => ({ ...r, team: teamSummary(db, r.team_id) }));

    const stats = computePlayerStats(db, seasonScope).filter((s) => s.matches_played > 0);
    const topPlayers = [...stats]
      .sort((a, b) => b.goals * 3 + b.assists * 2 + (b.rating ?? 0) - (a.goals * 3 + a.assists * 2 + (a.rating ?? 0)))
      .slice(0, 5)
      .map((s) => ({ ...s, player: playerSummary(db, s.player_id), team: teamSummary(db, s.team_id) }));

    const performanceByTeam = db.teams.map((t) => {
      const teamStats = stats.filter((s) => s.team_id === t.id);
      const rated = teamStats.filter((s) => s.rating !== null);
      return {
        team: teamSummary(db, t.id),
        goals: teamStats.reduce((sum, s) => sum + s.goals, 0),
        assists: teamStats.reduce((sum, s) => sum + s.assists, 0),
        rating: rated.length ? Math.round((rated.reduce((sum, s) => sum + s.rating, 0) / rated.length) * 100) / 100 : null,
      };
    });

    return clone({
      counts,
      live,
      upcomingMatches,
      recentResults,
      upcomingTraining,
      playersByTeam,
      attendanceTrend,
      attendanceSummary,
      matchResults,
      topPlayers,
      performanceByTeam,
      season: currentLeague ? { id: currentLeague.id, name: currentLeague.name, season: currentLeague.season } : null,
    });
  },
};
