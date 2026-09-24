import { api, ApiError, USE_MOCK } from './apiClient';
import { clone, delay, getDb } from './mock/db';
import { inDateRange, matchesSearch, paginate, sortBy } from './mock/query';
import { enrichMatch } from './mock/relations';
import { currentPlayer, involvesMyTeam } from './mock/scope';
import { playerMatchHistory } from './mock/statsEngine';

/** Tabs: upcoming = scheduled + live, completed, cancelled. */
const TAB_STATUS = { upcoming: ['scheduled', 'live'], completed: ['completed'], cancelled: ['cancelled'] };

export const matchService = {
  async getMatches({ tab = 'upcoming', search, competitionId, from, to, status, page, pageSize } = {}) {
    if (!USE_MOCK) return api.get('/player/matches', { tab, search, competitionId, from, to, status, page, pageSize });
    await delay();
    const db = getDb();
    const teamName = Object.fromEntries(db.teams.map((t) => [t.id, t.name]));
    const allowed = TAB_STATUS[tab] ?? TAB_STATUS.upcoming;
    const rows = db.matches.filter(
      (m) =>
        involvesMyTeam(db, m) &&
        allowed.includes(m.status) &&
        (!status || m.status === status) &&
        (!competitionId || (competitionId === 'friendly' ? !m.competition_id : m.competition_id === competitionId)) &&
        inDateRange(m.date, from, to) &&
        matchesSearch(search, teamName[m.home_team_id], teamName[m.away_team_id], m.location),
    );
    const asc = tab === 'upcoming';
    rows.sort((a, b) => {
      const k = `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`);
      return asc ? k : -k;
    });
    return clone(paginate(rows.map((m) => enrichMatch(db, m)), { page, pageSize }));
  },

  async counts() {
    if (!USE_MOCK) return api.get('/player/matches/counts');
    await delay(60);
    const db = getDb();
    const mine = db.matches.filter((m) => involvesMyTeam(db, m));
    return Object.fromEntries(Object.entries(TAB_STATUS).map(([tab, st]) => [tab, mine.filter((m) => st.includes(m.status)).length]));
  },

  /** Match centre (view only). Includes the player's own detailed performance when they played. */
  async getMatch(id) {
    if (!USE_MOCK) return api.get(`/player/matches/${id}`);
    await delay();
    const db = getDb();
    const match = db.matches.find((m) => m.id === id);
    if (!match) throw new ApiError('errors.notFound', { status: 404 });
    if (!involvesMyTeam(db, match)) throw new ApiError('errors.forbidden', { status: 403 });
    const me = currentPlayer(db);
    const mine = playerMatchHistory(db, me.id, {}).find((h) => h.match.id === id)?.line ?? null;
    const lineupPlayer = (pid) => {
      const p = db.players.find((x) => x.id === pid);
      return p ? { id: p.id, name: p.name, photo: p.photo, jersey_number: p.jersey_number, position: p.position, is_me: p.id === me.id } : null;
    };
    const events = sortBy(db.matchEvents.filter((e) => e.match_id === id), 'minute').map((e) => ({
      ...e,
      player: lineupPlayer(e.player_id),
      related_player: lineupPlayer(e.related_player_id),
    }));
    const lineups = {};
    for (const side of ['home', 'away']) {
      const l = match.lineups?.[side];
      lineups[side] = l ? { formation: l.formation, starting: l.starting.map(lineupPlayer).filter(Boolean), substitutes: l.substitutes.map(lineupPlayer).filter(Boolean) } : null;
    }
    const mySide = match.home_team_id === me.team_id ? 'home' : 'away';
    const inSquad = lineups[mySide] && [...lineups[mySide].starting, ...lineups[mySide].substitutes].find((p) => p.is_me);
    return clone({
      ...enrichMatch(db, match),
      events,
      lineups,
      my_side: mySide,
      my_selection: !lineups[mySide] ? null : inSquad ? (lineups[mySide].starting.some((p) => p.is_me) ? 'starting' : 'substitute') : 'not_selected',
      my_performance: mine,
    });
  },
};
