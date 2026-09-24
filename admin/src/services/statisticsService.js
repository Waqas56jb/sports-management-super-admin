import { api, USE_MOCK } from './apiClient';
import { clone, delay, getDb } from './mock/db';
import { matchesSearch, paginate, sortBy } from './mock/query';
import { playerSummary, teamSummary } from './mock/relations';
import { computePlayerStats, computeTeamRecords } from './mock/statsEngine';

export const statisticsService = {
  /** Player statistics table (the `player_statistics` resource), filterable by team/competition/season. */
  async players({ teamId, competitionId, season, playerId, position, search, sort = 'goals', dir = 'desc', page, pageSize, onlyPlayed = true } = {}) {
    if (!USE_MOCK) return api.get('/statistics/players', { teamId, competitionId, season, playerId, position, search, sort, dir, page, pageSize });
    await delay();
    const db = getDb();
    const byId = Object.fromEntries(db.players.map((p) => [p.id, p]));
    const rows = computePlayerStats(db, { competitionId, season })
      .filter((s) => {
        const p = byId[s.player_id];
        return (
          p &&
          (!teamId || p.team_id === teamId) &&
          (!playerId || p.id === playerId) &&
          (!position || p.position === position) &&
          (!onlyPlayed || s.matches_played > 0) &&
          matchesSearch(search, p.name)
        );
      })
      .map((s) => ({ ...s, player: playerSummary(db, s.player_id), team: teamSummary(db, byId[s.player_id].team_id) }));

    const totals = rows.reduce(
      (acc, r) => ({
        goals: acc.goals + r.goals,
        assists: acc.assists + r.assists,
        minutes_played: acc.minutes_played + r.minutes_played,
        yellow_cards: acc.yellow_cards + r.yellow_cards,
        red_cards: acc.red_cards + r.red_cards,
        appearances: acc.appearances + r.matches_played,
      }),
      { goals: 0, assists: 0, minutes_played: 0, yellow_cards: 0, red_cards: 0, appearances: 0 },
    );
    const rated = rows.filter((r) => r.rating !== null);
    totals.avg_rating = rated.length ? Math.round((rated.reduce((s, r) => s + r.rating, 0) / rated.length) * 10) / 10 : null;
    const withAttendance = rows.filter((r) => r.attendance_rate !== null);
    totals.avg_attendance = withAttendance.length ? withAttendance.reduce((s, r) => s + r.attendance_rate, 0) / withAttendance.length : null;
    totals.players = rows.length;

    const sorted = sortBy(rows, sort, dir);
    return clone({ ...paginate(sorted, { page, pageSize }), totals, all: sorted.slice(0, 200) });
  },

  async teams({ competitionId, season } = {}) {
    if (!USE_MOCK) return api.get('/statistics/teams', { competitionId, season });
    await delay();
    const db = getDb();
    return clone(computeTeamRecords(db, { competitionId, season }).map((r) => ({ ...r, team: teamSummary(db, r.team_id) })));
  },
};
