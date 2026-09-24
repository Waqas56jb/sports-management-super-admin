import { api, USE_MOCK } from './apiClient';
import { clone, delay, getDb } from './mock/db';
import { teamSummary } from './mock/relations';
import { currentPlayer } from './mock/scope';
import { attendanceRecordsInScope, playerMatchHistory, summarizeAttendance, summarizeLines } from './mock/statsEngine';

export const statisticsService = {
  /**
   * The player's own statistics, computed from the matches in scope.
   * Filters: season, competitionId, from, to, matchType (league | cup | tournament | friendly).
   */
  async getMyStatistics({ season, competitionId, from, to, matchType } = {}) {
    if (!USE_MOCK) return api.get('/player/statistics', { season, competitionId, from, to, matchType });
    await delay();
    const db = getDb();
    const me = currentPlayer(db);
    const history = playerMatchHistory(db, me.id, { season, competitionId, from, to, matchType, includeLive: false });
    const totals = summarizeLines(history.map((h) => h.line));
    const attendance = summarizeAttendance(attendanceRecordsInScope(db, { playerId: me.id, from, to }));

    const perMatch = history.map(({ match, line }) => ({
      match_id: match.id,
      date: match.date,
      opponent: teamSummary(db, match.home_team_id === me.team_id ? match.away_team_id : match.home_team_id),
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

    return clone({ totals, attendance, perMatch, monthly });
  },
};
