import { api, USE_MOCK } from './apiClient';
import { clone, delay, getDb } from './mock/db';
import { matchesSearch, paginate, sortBy } from './mock/query';
import { playerSummary, teamSummary } from './mock/relations';
import { myTeamIds } from './mock/scope';
import { attendanceRecordsInScope, computePlayerStats, computeTeamRecords, matchPlayerLines, scopedMatches, summarizeAttendance } from './mock/statsEngine';

export const statisticsService = {
  /** Player statistics for the coach's squads. Filters combine; pagination runs on the filtered set. */
  async players({ teamId, playerId, competitionId, season, from, to, position, search, sort = 'goals', dir = 'desc', page, pageSize } = {}) {
    if (!USE_MOCK) return api.get('/coach/statistics/players', { teamId, playerId, competitionId, season, from, to, position, search, sort, dir, page, pageSize });
    await delay();
    const db = getDb();
    const ids = myTeamIds(db);
    const byId = Object.fromEntries(db.players.map((p) => [p.id, p]));
    const rows = computePlayerStats(db, { competitionId, season, from, to })
      .filter((s) => {
        const p = byId[s.player_id];
        return p && ids.includes(p.team_id) && (!teamId || p.team_id === teamId) && (!playerId || p.id === playerId) && (!position || p.position === position) && matchesSearch(search, p.name);
      })
      .map((s) => ({ ...s, player: playerSummary(db, s.player_id), team: teamSummary(db, byId[s.player_id].team_id) }));
    const played = rows.filter((r) => r.matches_played > 0);
    const rated = played.filter((r) => r.rating !== null);
    const withAttendance = rows.filter((r) => r.attendance_rate !== null);
    const totals = {
      players: played.length,
      goals: rows.reduce((s, r) => s + r.goals, 0),
      assists: rows.reduce((s, r) => s + r.assists, 0),
      minutes_played: rows.reduce((s, r) => s + r.minutes_played, 0),
      yellow_cards: rows.reduce((s, r) => s + r.yellow_cards, 0),
      red_cards: rows.reduce((s, r) => s + r.red_cards, 0),
      avg_rating: rated.length ? Math.round((rated.reduce((s, r) => s + r.rating, 0) / rated.length) * 100) / 100 : null,
      avg_attendance: withAttendance.length ? withAttendance.reduce((s, r) => s + r.attendance_rate, 0) / withAttendance.length : null,
    };
    const sorted = sortBy(playerId ? rows : played, sort, dir);
    return clone({ ...paginate(sorted, { page, pageSize }), totals, all: sorted });
  },

  /** Team records (W/D/L, goals, attendance) for the coach's teams. */
  async teams({ competitionId, season, from, to, teamId } = {}) {
    if (!USE_MOCK) return api.get('/coach/statistics/teams', { competitionId, season, from, to, teamId });
    await delay();
    const db = getDb();
    const ids = teamId ? [teamId] : myTeamIds(db);
    return clone(
      computeTeamRecords(db, { competitionId, season, from, to })
        .filter((r) => ids.includes(r.team_id))
        .map((r) => ({ ...r, team: teamSummary(db, r.team_id), attendance_rate: summarizeAttendance(attendanceRecordsInScope(db, { teamId: r.team_id, from, to })).rate })),
    );
  },

  /** Match-by-match series for charts: team goals/result per match, avg player rating. */
  async trend({ competitionId, season, from, to, teamId, playerId } = {}) {
    if (!USE_MOCK) return api.get('/coach/statistics/trend', { competitionId, season, from, to, teamId, playerId });
    await delay();
    const db = getDb();
    const ids = teamId ? [teamId] : myTeamIds(db);
    const byId = Object.fromEntries(db.players.map((p) => [p.id, p]));
    const matches = scopedMatches(db, { competitionId, season, from, to, includeLive: false })
      .filter((m) => ids.includes(m.home_team_id) || ids.includes(m.away_team_id))
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-14);
    return clone(
      matches.map((m) => {
        const teamIdHere = ids.includes(m.home_team_id) ? m.home_team_id : m.away_team_id;
        const home = m.home_team_id === teamIdHere;
        const lines = Object.values(matchPlayerLines(m, db.matchEvents, byId)).filter((l) => l.team_id === teamIdHere && (!playerId || l.player_id === playerId));
        const gf = home ? m.home_score : m.away_score;
        const ga = home ? m.away_score : m.home_score;
        return {
          match_id: m.id,
          date: m.date,
          team: teamSummary(db, teamIdHere),
          opponent: teamSummary(db, home ? m.away_team_id : m.home_team_id),
          goals_for: gf,
          goals_against: ga,
          result: gf > ga ? 'W' : gf < ga ? 'L' : 'D',
          rating: lines.length ? Math.round((lines.reduce((s, l) => s + l.rating, 0) / lines.length) * 100) / 100 : null,
          player_goals: lines.reduce((s, l) => s + l.goals, 0),
        };
      }),
    );
  },
};
