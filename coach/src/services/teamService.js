import { todayISO } from '@/utils/format';
import { api, ApiError, USE_MOCK } from './apiClient';
import { clone, delay, getDb } from './mock/db';
import { matchesSearch, sortBy } from './mock/query';
import { enrichMatch, enrichSession, playerSummary, teamSummary } from './mock/relations';
import { assertMyTeam, myTeamIds } from './mock/scope';
import { attendanceRecordsInScope, computeAttendanceByPlayer, computePlayerStats, computeTeamRecords, summarizeAttendance } from './mock/statsEngine';

const nextMatchFor = (db, teamId, today) =>
  db.matches
    .filter((m) => (m.home_team_id === teamId || m.away_team_id === teamId) && (m.status === 'live' || (m.status === 'scheduled' && m.date >= today)))
    .sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`))[0];

const nextSessionFor = (db, teamId, today) =>
  db.trainingSessions
    .filter((s) => s.team_id === teamId && s.status !== 'cancelled' && s.date >= today)
    .sort((a, b) => `${a.date}${a.start_time}`.localeCompare(`${b.date}${b.start_time}`))[0];

export const teamService = {
  /** Teams assigned to the signed-in coach. */
  async list({ search, category, status } = {}) {
    if (!USE_MOCK) return api.get('/coach/teams', { search, category, status });
    await delay();
    const db = getDb();
    const ids = myTeamIds(db);
    const today = todayISO();
    const records = Object.fromEntries(computeTeamRecords(db).map((r) => [r.team_id, r]));
    const rows = db.teams
      .filter((t) => ids.includes(t.id) && (!category || t.category === category) && (!status || t.status === status) && matchesSearch(search, t.name, t.short_name))
      .map((t) => {
        const roster = db.players.filter((p) => p.team_id === t.id);
        const nm = nextMatchFor(db, t.id, today);
        const ns = nextSessionFor(db, t.id, today);
        return {
          ...t,
          players_count: roster.length,
          active_players: roster.filter((p) => p.status === 'active').length,
          record: records[t.id],
          attendance_rate: summarizeAttendance(attendanceRecordsInScope(db, { teamId: t.id })).rate,
          next_match: nm ? enrichMatch(db, nm) : null,
          next_session: ns ? enrichSession(db, ns) : null,
        };
      });
    return clone(sortBy(rows, 'name'));
  },

  async options() {
    if (!USE_MOCK) return api.get('/coach/teams/options');
    await delay(80);
    const db = getDb();
    const ids = myTeamIds(db);
    return clone(db.teams.filter((t) => ids.includes(t.id)).map((t) => teamSummary(db, t.id)));
  },

  async get(id) {
    if (!USE_MOCK) return api.get(`/coach/teams/${id}`);
    await delay();
    const db = getDb();
    const team = db.teams.find((t) => t.id === id);
    if (!team) throw new ApiError('errors.notFound', { status: 404 });
    assertMyTeam(db, id);
    const today = todayISO();
    const stats = Object.fromEntries(computePlayerStats(db).map((s) => [s.player_id, s]));
    const attendance = computeAttendanceByPlayer(db, { teamId: id });
    const roster = sortBy(db.players.filter((p) => p.team_id === id), 'jersey_number').map((p) => ({ ...p, statistics: stats[p.id], attendance_rate: attendance[p.id]?.rate ?? null }));
    const teamMatches = db.matches.filter((m) => m.home_team_id === id || m.away_team_id === id);
    const sessions = db.trainingSessions.filter((s) => s.team_id === id);
    const played = teamMatches.filter((m) => m.status === 'completed');
    const scorers = roster.filter((p) => p.statistics?.goals).sort((a, b) => b.statistics.goals - a.statistics.goals).slice(0, 5);

    // Goals scored / conceded per competition for the statistics tab
    const byCompetition = {};
    played.forEach((m) => {
      const key = m.competition_id ?? 'friendly';
      const home = m.home_team_id === id;
      const row = (byCompetition[key] ??= { competition: m.competition_id ? db.competitions.find((c) => c.id === m.competition_id) : null, played: 0, won: 0, drawn: 0, lost: 0, goals_for: 0, goals_against: 0 });
      const gf = home ? m.home_score : m.away_score;
      const ga = home ? m.away_score : m.home_score;
      row.played += 1;
      row.goals_for += gf;
      row.goals_against += ga;
      row[gf > ga ? 'won' : gf < ga ? 'lost' : 'drawn'] += 1;
    });

    return clone({
      ...team,
      coach: team.coach_id ? db.coaches.find((c) => c.id === team.coach_id) ?? null : null,
      roster,
      record: computeTeamRecords(db).find((r) => r.team_id === id),
      attendance: summarizeAttendance(attendanceRecordsInScope(db, { teamId: id })),
      top_scorers: scorers.map((p) => ({ player: playerSummary(db, p.id), goals: p.statistics.goals, assists: p.statistics.assists })),
      by_competition: Object.values(byCompetition).map((r) => ({ ...r, competition: r.competition && { id: r.competition.id, name: r.competition.name, season: r.competition.season } })),
      recent_matches: sortBy(played, 'date', 'desc').slice(0, 8).map((m) => enrichMatch(db, m)),
      upcoming_matches: teamMatches.filter((m) => m.status === 'scheduled' || m.status === 'live').sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`)).slice(0, 6).map((m) => enrichMatch(db, m)),
      upcoming_sessions: sessions.filter((s) => s.date >= today).sort((a, b) => `${a.date}${a.start_time}`.localeCompare(`${b.date}${b.start_time}`)).slice(0, 6).map((s) => enrichSession(db, s)),
      recent_sessions: sortBy(sessions.filter((s) => s.date < today), 'date', 'desc').slice(0, 6).map((s) => enrichSession(db, s)),
    });
  },
};
