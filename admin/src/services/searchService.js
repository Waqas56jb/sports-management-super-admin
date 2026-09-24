import { api, USE_MOCK } from './apiClient';
import { clone, delay, getDb } from './mock/db';
import { matchesSearch } from './mock/query';
import { enrichMatch, teamSummary } from './mock/relations';

const LIMIT = 5;

export const searchService = {
  /** Global admin search, grouped by resource type. */
  async global(query) {
    const q = query.trim();
    if (q.length < 2) return { players: [], coaches: [], teams: [], matches: [], competitions: [] };
    if (!USE_MOCK) return api.get('/search', { q });
    await delay(180);
    const db = getDb();
    const teamName = Object.fromEntries(db.teams.map((t) => [t.id, t.name]));
    return clone({
      players: db.players
        .filter((p) => matchesSearch(q, p.name, p.email, `#${p.jersey_number}`))
        .slice(0, LIMIT)
        .map((p) => ({ id: p.id, name: p.name, photo: p.photo, position: p.position, jersey_number: p.jersey_number, team: teamSummary(db, p.team_id) })),
      coaches: db.coaches
        .filter((c) => matchesSearch(q, c.name, c.email, c.license))
        .slice(0, LIMIT)
        .map((c) => ({ id: c.id, name: c.name, photo: c.photo, license: c.license, team: teamSummary(db, c.team_id) })),
      teams: db.teams.filter((t) => matchesSearch(q, t.name, t.short_name)).slice(0, LIMIT).map((t) => teamSummary(db, t.id)),
      matches: db.matches
        .filter((m) => matchesSearch(q, `${teamName[m.home_team_id]} ${teamName[m.away_team_id]}`, teamName[m.home_team_id], teamName[m.away_team_id], m.location))
        .sort((a, b) => b.date.localeCompare(a.date))
        .slice(0, LIMIT)
        .map((m) => enrichMatch(db, m)),
      competitions: db.competitions
        .filter((c) => matchesSearch(q, c.name, c.season, c.location))
        .slice(0, LIMIT)
        .map((c) => ({ id: c.id, name: c.name, season: c.season, status: c.status, type: c.type })),
    });
  },
};
