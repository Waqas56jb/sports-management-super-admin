import { todayISO } from '@/utils/format';
import { api, USE_MOCK } from './apiClient';
import { clone, delay, getDb } from './mock/db';
import { matchesSearch } from './mock/query';
import { enrichMatch, enrichSession, teamSummary } from './mock/relations';
import { involvesMyTeam, myTeamIds } from './mock/scope';

const LIMIT = 5;
const EMPTY = { players: [], teams: [], matches: [], training: [], competitions: [] };

export const searchService = {
  /** Global search limited to the coach's own teams, grouped by type. */
  async global(query, { trainingLabel } = {}) {
    const q = query.trim();
    if (q.length < 2) return EMPTY;
    if (!USE_MOCK) return api.get('/coach/search', { q });
    await delay(180);
    const db = getDb();
    const ids = myTeamIds(db);
    const teamName = Object.fromEntries(db.teams.map((t) => [t.id, t.name]));
    const today = todayISO();
    return clone({
      players: db.players
        .filter((p) => ids.includes(p.team_id) && matchesSearch(q, p.name, p.email, `#${p.jersey_number}`))
        .slice(0, LIMIT)
        .map((p) => ({ id: p.id, name: p.name, photo: p.photo, position: p.position, jersey_number: p.jersey_number, team: teamSummary(db, p.team_id) })),
      teams: db.teams.filter((t) => ids.includes(t.id) && matchesSearch(q, t.name, t.short_name)).slice(0, LIMIT).map((t) => teamSummary(db, t.id)),
      matches: db.matches
        .filter((m) => involvesMyTeam(db, m) && matchesSearch(q, `${teamName[m.home_team_id]} ${teamName[m.away_team_id]}`, teamName[m.home_team_id], teamName[m.away_team_id], m.location))
        .sort((a, b) => Math.abs(Date.parse(a.date) - Date.now()) - Math.abs(Date.parse(b.date) - Date.now()))
        .slice(0, LIMIT)
        .map((m) => enrichMatch(db, m)),
      // Training matches on team, location, notes or the (translated) session type.
      training: db.trainingSessions
        .filter((s) => ids.includes(s.team_id) && matchesSearch(q, teamName[s.team_id], s.location, s.notes, s.description, trainingLabel?.(s.training_type)))
        .sort((a, b) => {
          const au = a.date >= today;
          const bu = b.date >= today;
          if (au !== bu) return au ? -1 : 1;
          return au ? a.date.localeCompare(b.date) : b.date.localeCompare(a.date);
        })
        .slice(0, LIMIT)
        .map((s) => enrichSession(db, s)),
      competitions: db.competitions
        .filter((c) => c.team_ids.some((t) => ids.includes(t)) && matchesSearch(q, c.name, c.season, c.location))
        .slice(0, LIMIT)
        .map((c) => ({ id: c.id, name: c.name, season: c.season, status: c.status, type: c.type })),
    });
  },
};
