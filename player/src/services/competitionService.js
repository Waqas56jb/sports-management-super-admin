import { api, ApiError, USE_MOCK } from './apiClient';
import { clone, delay, getDb } from './mock/db';
import { matchesSearch, sortBy } from './mock/query';
import { enrichMatch, playerSummary, teamSummary } from './mock/relations';
import { currentPlayer } from './mock/scope';
import { computePlayerStats, standings } from './mock/statsEngine';

export const competitionService = {
  /** Competitions in which the player's team takes part (read-only). */
  async getCompetitions({ search, status, season } = {}) {
    if (!USE_MOCK) return api.get('/player/competitions', { search, status, season });
    await delay();
    const db = getDb();
    const me = currentPlayer(db);
    const rows = db.competitions
      .filter((c) => c.team_ids.includes(me.team_id) && (!status || c.status === status) && (!season || c.season === season) && matchesSearch(search, c.name, c.season))
      .map((c) => {
        const matches = db.matches.filter((m) => m.competition_id === c.id);
        const table = c.type === 'league' ? standings(db, c.id) : [];
        const pos = table.findIndex((r) => r.team_id === me.team_id) + 1;
        return {
          ...c,
          team: teamSummary(db, me.team_id),
          teams_count: c.team_ids.length,
          matches_total: matches.length,
          my_matches: matches.filter((m) => m.home_team_id === me.team_id || m.away_team_id === me.team_id).length,
          matches_completed: matches.filter((m) => m.status === 'completed').length,
          position: pos || null,
          points: table[pos - 1]?.points ?? null,
        };
      });
    return clone(sortBy(rows, 'start_date', 'desc'));
  },

  async getSeasons() {
    if (!USE_MOCK) return api.get('/player/competitions/seasons');
    await delay(60);
    const db = getDb();
    const me = currentPlayer(db);
    return [...new Set(db.competitions.filter((c) => c.team_ids.includes(me.team_id)).map((c) => c.season))].sort().reverse();
  },

  async getCompetition(id) {
    if (!USE_MOCK) return api.get(`/player/competitions/${id}`);
    await delay();
    const db = getDb();
    const me = currentPlayer(db);
    const comp = db.competitions.find((c) => c.id === id);
    if (!comp) throw new ApiError('errors.notFound', { status: 404 });
    if (!comp.team_ids.includes(me.team_id)) throw new ApiError('errors.forbidden', { status: 403 });
    const matches = db.matches.filter((m) => m.competition_id === id);
    const played = matches.filter((m) => m.status === 'completed');
    const stats = computePlayerStats(db, { competitionId: id }).filter((s) => s.matches_played > 0);
    const goals = played.reduce((s, m) => s + m.home_score + m.away_score, 0);
    return clone({
      ...comp,
      teams: comp.team_ids.map((t) => teamSummary(db, t)).filter(Boolean),
      my_team: teamSummary(db, me.team_id),
      standings: standings(db, id).map((r) => ({ ...r, team: teamSummary(db, r.team_id) })),
      fixtures: matches.filter((m) => m.status === 'scheduled' || m.status === 'live').sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`)).map((m) => enrichMatch(db, m)),
      results: sortBy(played, 'date', 'desc').map((m) => enrichMatch(db, m)),
      top_scorers: sortBy(stats.filter((s) => s.goals > 0), 'goals', 'desc').slice(0, 5).map((s) => ({ ...s, player: playerSummary(db, s.player_id), team: teamSummary(db, s.team_id), is_me: s.player_id === me.id })),
      totals: {
        matches: matches.length,
        played: played.length,
        goals,
        goals_per_match: played.length ? Math.round((goals / played.length) * 100) / 100 : 0,
        yellow_cards: stats.reduce((s, r) => s + r.yellow_cards, 0),
        red_cards: stats.reduce((s, r) => s + r.red_cards, 0),
      },
    });
  },
};
