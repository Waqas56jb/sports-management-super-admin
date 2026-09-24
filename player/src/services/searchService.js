import { todayISO } from '@/utils/formatters';
import { api, USE_MOCK } from './apiClient';
import { clone, delay, getDb } from './mock/db';
import { matchesSearch } from './mock/query';
import { enrichMatch, enrichSession, teamSummary } from './mock/relations';
import { currentPlayer, involvesMyTeam } from './mock/scope';

const LIMIT = 5;
const EMPTY = { matches: [], training: [], team: [], competitions: [], notifications: [] };

export const searchService = {
  /**
   * Global search over player-accessible data only: own matches, training, team (and teammates'
   * public names), competitions and own notifications. `labels` translates enums/templates for matching.
   */
  async global(query, { trainingLabel, notificationText } = {}) {
    const q = query.trim();
    if (q.length < 2) return EMPTY;
    if (!USE_MOCK) return api.get('/player/search', { q });
    await delay(160);
    const db = getDb();
    const me = currentPlayer(db);
    const today = todayISO();
    const teamName = Object.fromEntries(db.teams.map((t) => [t.id, t.name]));
    const team = db.teams.find((t) => t.id === me.team_id);
    const byDate = (a, b) => {
      const au = a.date >= today;
      const bu = b.date >= today;
      if (au !== bu) return au ? -1 : 1;
      return au ? a.date.localeCompare(b.date) : b.date.localeCompare(a.date);
    };
    return clone({
      matches: db.matches
        .filter((m) => involvesMyTeam(db, m) && matchesSearch(q, `${teamName[m.home_team_id]} ${teamName[m.away_team_id]}`, teamName[m.home_team_id], teamName[m.away_team_id], m.location))
        .sort(byDate)
        .slice(0, LIMIT)
        .map((m) => enrichMatch(db, m)),
      training: db.trainingSessions
        .filter((s) => s.team_id === me.team_id && matchesSearch(q, s.location, trainingLabel?.(s.training_type), s.training_type))
        .sort(byDate)
        .slice(0, LIMIT)
        .map((s) => enrichSession(db, s)),
      team: [
        ...(matchesSearch(q, team.name, team.short_name, team.home_ground) ? [{ kind: 'team', ...teamSummary(db, team.id) }] : []),
        ...db.players
          .filter((p) => p.team_id === me.team_id && matchesSearch(q, p.name, `#${p.jersey_number}`))
          .slice(0, LIMIT)
          .map((p) => ({ kind: 'teammate', id: p.id, name: p.name, photo: p.photo, jersey_number: p.jersey_number, position: p.position, is_me: p.id === me.id })),
      ].slice(0, LIMIT),
      competitions: db.competitions
        .filter((c) => c.team_ids.includes(me.team_id) && matchesSearch(q, c.name, c.season, c.location))
        .slice(0, LIMIT)
        .map((c) => ({ id: c.id, name: c.name, season: c.season, status: c.status, type: c.type })),
      notifications: db.notifications
        .filter((n) => n.user_id === me.user_id)
        .filter((n) => {
          const text = notificationText?.(n);
          return matchesSearch(q, text?.title, text?.message, n.title, n.message);
        })
        .sort((a, b) => b.created_at.localeCompare(a.created_at))
        .slice(0, LIMIT),
    });
  },
};
