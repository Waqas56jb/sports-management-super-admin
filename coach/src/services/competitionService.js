import { api, ApiError, USE_MOCK } from './apiClient';
import { clone, delay, getDb } from './mock/db';
import { matchesSearch, paginate, sortBy } from './mock/query';
import { enrichMatch, playerSummary, teamSummary } from './mock/relations';
import { myTeamIds } from './mock/scope';
import { computePlayerStats, standings } from './mock/statsEngine';

const involves = (c, ids) => c.team_ids.some((t) => ids.includes(t));

function summary(db, c, ids) {
  const matches = db.matches.filter((m) => m.competition_id === c.id);
  const mine = matches.filter((m) => ids.includes(m.home_team_id) || ids.includes(m.away_team_id));
  return {
    ...c,
    teams: c.team_ids.map((id) => teamSummary(db, id)).filter(Boolean),
    my_teams: c.team_ids.filter((t) => ids.includes(t)).map((id) => teamSummary(db, id)),
    matches_total: matches.length,
    matches_completed: matches.filter((m) => m.status === 'completed').length,
    my_matches: mine.length,
  };
}

export const competitionService = {
  /** Competitions in which at least one of the coach's teams takes part (read-only). */
  async list({ search, status, type, season, page, pageSize } = {}) {
    if (!USE_MOCK) return api.get('/coach/competitions', { search, status, type, season, page, pageSize });
    await delay();
    const db = getDb();
    const ids = myTeamIds(db);
    const rows = db.competitions.filter(
      (c) => involves(c, ids) && (!status || c.status === status) && (!type || c.type === type) && (!season || c.season === season) && matchesSearch(search, c.name, c.location, c.season),
    );
    return clone(paginate(sortBy(rows, 'start_date', 'desc').map((c) => summary(db, c, ids)), { page, pageSize }));
  },

  async options() {
    if (!USE_MOCK) return api.get('/coach/competitions/options');
    await delay(80);
    const db = getDb();
    const ids = myTeamIds(db);
    return clone(sortBy(db.competitions.filter((c) => involves(c, ids)), 'start_date', 'desc').map((c) => ({ id: c.id, name: c.name, season: c.season, status: c.status })));
  },

  async seasons() {
    if (!USE_MOCK) return api.get('/coach/competitions/seasons');
    await delay(60);
    const db = getDb();
    const ids = myTeamIds(db);
    return [...new Set(db.competitions.filter((c) => involves(c, ids)).map((c) => c.season))].sort().reverse();
  },

  async get(id) {
    if (!USE_MOCK) return api.get(`/coach/competitions/${id}`);
    await delay();
    const db = getDb();
    const comp = db.competitions.find((c) => c.id === id);
    if (!comp) throw new ApiError('errors.notFound', { status: 404 });
    const ids = myTeamIds(db);
    if (!involves(comp, ids)) throw new ApiError('errors.forbidden', { status: 403 });
    const matches = db.matches.filter((m) => m.competition_id === id);
    const played = matches.filter((m) => m.status === 'completed');
    const stats = computePlayerStats(db, { competitionId: id }).filter((s) => s.matches_played > 0);
    const goals = played.reduce((sum, m) => sum + m.home_score + m.away_score, 0);
    return clone({
      ...summary(db, comp, ids),
      standings: standings(db, id).map((r) => ({ ...r, team: teamSummary(db, r.team_id), mine: ids.includes(r.team_id) })),
      upcoming_matches: matches.filter((m) => m.status === 'scheduled' || m.status === 'live').sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`)).map((m) => enrichMatch(db, m)),
      completed_matches: sortBy(played, 'date', 'desc').map((m) => enrichMatch(db, m)),
      top_scorers: sortBy(stats.filter((s) => s.goals > 0), 'goals', 'desc').slice(0, 5).map((s) => ({ ...s, player: playerSummary(db, s.player_id), team: teamSummary(db, s.team_id), mine: ids.includes(s.team_id) })),
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
