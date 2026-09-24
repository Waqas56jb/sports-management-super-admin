import { api, ApiError, USE_MOCK } from './apiClient';
import { clone, commit, delay, getDb, nowIso, uid } from './mock/db';
import { matchesSearch, paginate, sortBy } from './mock/query';
import { enrichMatch, notifyAdmins, playerSummary, teamSummary } from './mock/relations';
import { computePlayerStats, standings } from './mock/statsEngine';

const FIELDS = ['name', 'type', 'season', 'start_date', 'end_date', 'location', 'team_ids', 'status', 'description'];

function pick(data) {
  const out = {};
  FIELDS.forEach((f) => {
    if (data[f] !== undefined) out[f] = typeof data[f] === 'string' ? data[f].trim() : data[f];
  });
  return out;
}

function summary(db, c) {
  const matches = db.matches.filter((m) => m.competition_id === c.id);
  return {
    ...c,
    teams: c.team_ids.map((id) => teamSummary(db, id)).filter(Boolean),
    matches_total: matches.length,
    matches_completed: matches.filter((m) => m.status === 'completed').length,
  };
}

export const competitionService = {
  async list({ search, status, type, season, page, pageSize, sort = 'start_date', dir = 'desc' } = {}) {
    if (!USE_MOCK) return api.get('/competitions', { search, status, type, season, page, pageSize, sort, dir });
    await delay();
    const db = getDb();
    const rows = db.competitions.filter(
      (c) => (!status || c.status === status) && (!type || c.type === type) && (!season || c.season === season) && matchesSearch(search, c.name, c.location, c.season),
    );
    return clone(paginate(sortBy(rows, sort, dir).map((c) => summary(db, c)), { page, pageSize }));
  },

  async options() {
    if (!USE_MOCK) return api.get('/competitions/options');
    await delay(100);
    return clone(sortBy(getDb().competitions, 'start_date', 'desc').map((c) => ({ id: c.id, name: c.name, season: c.season, status: c.status, team_ids: c.team_ids })));
  },

  async seasons() {
    if (!USE_MOCK) return api.get('/competitions/seasons');
    await delay(80);
    return [...new Set(getDb().competitions.map((c) => c.season))].sort().reverse();
  },

  async get(id) {
    if (!USE_MOCK) return api.get(`/competitions/${id}`);
    await delay();
    const db = getDb();
    const comp = db.competitions.find((c) => c.id === id);
    if (!comp) throw new ApiError('errors.notFound', { status: 404 });
    const matches = db.matches.filter((m) => m.competition_id === id);
    const stats = computePlayerStats(db, { competitionId: id }).filter((s) => s.matches_played > 0);
    const played = matches.filter((m) => m.status === 'completed');
    const goals = played.reduce((sum, m) => sum + m.home_score + m.away_score, 0);
    return clone({
      ...summary(db, comp),
      standings: standings(db, id).map((r) => ({ ...r, team: teamSummary(db, r.team_id) })),
      upcoming_matches: sortBy(matches.filter((m) => m.status === 'scheduled' || m.status === 'live'), 'date').map((m) => enrichMatch(db, m)),
      completed_matches: sortBy(played, 'date', 'desc').map((m) => enrichMatch(db, m)),
      top_scorers: sortBy(stats.filter((s) => s.goals > 0), 'goals', 'desc').slice(0, 5).map((s) => ({ ...s, player: playerSummary(db, s.player_id), team: teamSummary(db, s.team_id) })),
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

  async create(data) {
    if (!USE_MOCK) return api.post('/competitions', data);
    await delay(450);
    const db = getDb();
    const comp = { id: uid('k'), created_at: nowIso(), description: '', ...pick(data) };
    db.competitions.unshift(comp);
    notifyAdmins(db, { type: 'team_announcement', template: 'competition_created', params: { name: comp.name, season: comp.season }, link: `/admin/competitions/${comp.id}` });
    commit();
    return clone(comp);
  },

  async update(id, data) {
    if (!USE_MOCK) return api.put(`/competitions/${id}`, data);
    await delay(400);
    const db = getDb();
    const comp = db.competitions.find((c) => c.id === id);
    if (!comp) throw new ApiError('errors.notFound', { status: 404 });
    const values = pick(data);
    if (values.team_ids) {
      const locked = new Set(db.matches.filter((m) => m.competition_id === id).flatMap((m) => [m.home_team_id, m.away_team_id]));
      const missing = [...locked].filter((t) => !values.team_ids.includes(t));
      if (missing.length) throw new ApiError('competitions.errors.teamHasMatches', { fields: { team_ids: 'competitions.errors.teamHasMatches' } });
    }
    Object.assign(comp, values);
    commit();
    return clone(comp);
  },

  async remove(id) {
    if (!USE_MOCK) return api.delete(`/competitions/${id}`);
    await delay(350);
    const db = getDb();
    if (db.matches.some((m) => m.competition_id === id)) throw new ApiError('competitions.errors.hasMatches', { status: 409 });
    db.competitions = db.competitions.filter((c) => c.id !== id);
    commit();
    return { ok: true };
  },
};
