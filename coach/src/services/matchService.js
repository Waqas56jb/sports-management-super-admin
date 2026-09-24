import { api, ApiError, USE_MOCK } from './apiClient';
import { clone, commit, delay, getDb, uid } from './mock/db';
import { inDateRange, matchesSearch, paginate, sortBy } from './mock/query';
import { enrichMatch, playerSummary } from './mock/relations';
import { involvesMyTeam, isMyTeam } from './mock/scope';
import { matchPlayerLines } from './mock/statsEngine';

function findOwned(db, id) {
  const match = db.matches.find((m) => m.id === id);
  if (!match) throw new ApiError('errors.notFound', { status: 404 });
  if (!involvesMyTeam(db, match)) throw new ApiError('errors.forbidden', { status: 403 });
  return match;
}

/** Keep shot statistics consistent with the score on record. */
function syncShots(match) {
  if (!match.team_stats) return;
  for (const side of ['home', 'away']) {
    const s = match.team_stats[side];
    const scored = (side === 'home' ? match.home_score : match.away_score) ?? 0;
    s.shots_on_target = Math.max(s.shots_on_target, scored);
    s.shots = Math.max(s.shots, s.shots_on_target);
  }
}

/** Goals recorded as events drive the score, so the scoreboard and statistics never disagree. */
function recomputeScore(db, match) {
  const goals = db.matchEvents.filter((e) => e.match_id === match.id && e.event_type === 'goal');
  match.home_score = goals.filter((e) => e.team_id === match.home_team_id).length;
  match.away_score = goals.filter((e) => e.team_id === match.away_team_id).length;
  syncShots(match);
}

const emptyStats = () => ({ possession: 50, shots: 0, shots_on_target: 0, corners: 0, fouls: 0, offsides: 0 });

export const matchService = {
  /** Matches involving the coach's teams. status: scheduled | live | completed | cancelled */
  async list({ search, status, competitionId, teamId, from, to, page, pageSize } = {}) {
    if (!USE_MOCK) return api.get('/coach/matches', { search, status, competitionId, teamId, from, to, page, pageSize });
    await delay();
    const db = getDb();
    const teamName = Object.fromEntries(db.teams.map((t) => [t.id, t.name]));
    const rows = db.matches.filter(
      (m) =>
        involvesMyTeam(db, m) &&
        (!status || m.status === status) &&
        (!competitionId || (competitionId === 'friendly' ? !m.competition_id : m.competition_id === competitionId)) &&
        (!teamId || m.home_team_id === teamId || m.away_team_id === teamId) &&
        inDateRange(m.date, from, to) &&
        matchesSearch(search, teamName[m.home_team_id], teamName[m.away_team_id], m.location, m.referee),
    );
    const asc = status === 'scheduled' || status === 'live';
    rows.sort((a, b) => {
      const k = `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`);
      return asc ? k : -k;
    });
    return clone(paginate(rows.map((m) => enrichMatch(db, m)), { page, pageSize }));
  },

  async counts() {
    if (!USE_MOCK) return api.get('/coach/matches/counts');
    await delay(80);
    const db = getDb();
    const mine = db.matches.filter((m) => involvesMyTeam(db, m));
    return Object.fromEntries(['scheduled', 'live', 'completed', 'cancelled'].map((s) => [s, mine.filter((m) => m.status === s).length]));
  },

  async get(id) {
    if (!USE_MOCK) return api.get(`/coach/matches/${id}`);
    await delay();
    const db = getDb();
    const match = findOwned(db, id);
    const byId = Object.fromEntries(db.players.map((p) => [p.id, p]));
    const events = sortBy(db.matchEvents.filter((e) => e.match_id === id), 'minute').map((e) => ({
      ...e,
      player: playerSummary(db, e.player_id),
      related_player: playerSummary(db, e.related_player_id),
    }));
    const squad = (teamId) => sortBy(db.players.filter((p) => p.team_id === teamId), 'jersey_number').map((p) => ({ ...playerSummary(db, p.id), status: p.status }));
    return clone({
      ...enrichMatch(db, match),
      events,
      player_lines: matchPlayerLines(match, db.matchEvents, byId),
      squads: { home: squad(match.home_team_id), away: squad(match.away_team_id) },
      editable_sides: ['home', 'away'].filter((side) => isMyTeam(db, side === 'home' ? match.home_team_id : match.away_team_id)),
    });
  },

  /** Match status + live minute. Manual scores are only allowed when no goal events exist. */
  async updateStatus(id, { status, home_score, away_score, live_minute }) {
    if (!USE_MOCK) return api.patch(`/coach/matches/${id}/status`, { status, home_score, away_score, live_minute });
    await delay(350);
    const db = getDb();
    const match = findOwned(db, id);
    const hasGoalEvents = db.matchEvents.some((e) => e.match_id === id && e.event_type === 'goal');
    match.status = status;
    match.live_minute = status === 'live' ? Number(live_minute) || match.live_minute || 1 : null;
    if ((status === 'live' || status === 'completed') && !match.team_stats) match.team_stats = { home: emptyStats(), away: emptyStats() };
    if (status === 'scheduled' || status === 'cancelled') {
      if (!hasGoalEvents) {
        match.home_score = null;
        match.away_score = null;
      }
    } else if (hasGoalEvents) recomputeScore(db, match);
    else {
      match.home_score = Number(home_score) || 0;
      match.away_score = Number(away_score) || 0;
      syncShots(match);
    }
    commit();
    return clone(enrichMatch(db, match));
  },

  async updateTeamStats(id, stats) {
    if (!USE_MOCK) return api.put(`/coach/matches/${id}/team-stats`, stats);
    await delay(350);
    const db = getDb();
    const match = findOwned(db, id);
    const num = (v) => Math.max(0, Number(v) || 0);
    const next = {};
    for (const side of ['home', 'away']) next[side] = Object.fromEntries(Object.keys(emptyStats()).map((k) => [k, num(stats[side]?.[k])]));
    next.away.possession = 100 - Math.min(100, next.home.possession);
    match.team_stats = next;
    syncShots(match);
    commit();
    return clone(match.team_stats);
  },

  async addEvent(matchId, data) {
    if (!USE_MOCK) return api.post(`/coach/matches/${matchId}/events`, data);
    await delay(350);
    const db = getDb();
    const match = findOwned(db, matchId);
    if (match.status === 'scheduled' || match.status === 'cancelled') throw new ApiError('matches.errors.notStarted');
    const teamId = data.team_id;
    if (teamId !== match.home_team_id && teamId !== match.away_team_id) throw new ApiError('matches.errors.playerNotInMatch');
    const side = teamId === match.home_team_id ? 'home' : 'away';
    if (!match.lineups) match.lineups = { home: null, away: null };
    if (!match.lineups[side]) match.lineups[side] = { formation: '4-3-3', starting: [], substitutes: [] };
    const lineup = match.lineups[side];
    const ensureInSquad = (pid) => {
      if (pid && !lineup.starting.includes(pid) && !lineup.substitutes.includes(pid)) lineup.starting.push(pid);
    };
    if (data.event_type === 'substitution' && data.related_player_id && !lineup.substitutes.includes(data.related_player_id)) {
      lineup.starting = lineup.starting.filter((pid) => pid !== data.related_player_id);
      lineup.substitutes.push(data.related_player_id);
    }
    ensureInSquad(data.player_id);

    const event = {
      id: uid('e'),
      match_id: matchId,
      player_id: data.player_id,
      related_player_id: data.related_player_id || null,
      team_id: teamId,
      event_type: data.event_type,
      minute: Number(data.minute),
      description: data.description?.trim() ?? '',
    };
    db.matchEvents.push(event);
    if (event.event_type === 'goal' && data.assist_player_id) {
      ensureInSquad(data.assist_player_id);
      db.matchEvents.push({ ...event, id: uid('e'), event_type: 'assist', player_id: data.assist_player_id, related_player_id: data.player_id, description: '' });
    }
    if (event.event_type === 'goal') recomputeScore(db, match);
    commit();
    return clone(event);
  },

  async removeEvent(matchId, eventId) {
    if (!USE_MOCK) return api.delete(`/coach/matches/${matchId}/events/${eventId}`);
    await delay(300);
    const db = getDb();
    const match = findOwned(db, matchId);
    const event = db.matchEvents.find((e) => e.id === eventId && e.match_id === matchId);
    if (!event) throw new ApiError('errors.notFound', { status: 404 });
    db.matchEvents = db.matchEvents.filter((e) => e.id !== eventId);
    if (event.event_type === 'goal') {
      db.matchEvents = db.matchEvents.filter(
        (e) => !(e.match_id === matchId && e.event_type === 'assist' && e.related_player_id === event.player_id && e.minute === event.minute),
      );
      recomputeScore(db, match);
    }
    commit();
    return { ok: true };
  },

  /** A coach can only set the line-up of their own team. */
  async saveLineup(matchId, side, { formation, starting, substitutes }) {
    if (!USE_MOCK) return api.put(`/coach/matches/${matchId}/lineups/${side}`, { formation, starting, substitutes });
    await delay(400);
    const db = getDb();
    const match = findOwned(db, matchId);
    const teamId = side === 'home' ? match.home_team_id : match.away_team_id;
    if (!isMyTeam(db, teamId)) throw new ApiError('errors.forbidden', { status: 403 });
    if (starting.length !== 11) throw new ApiError('matches.lineup.errors.elevenRequired');
    match.lineups = match.lineups ?? { home: null, away: null };
    match.lineups[side] = { formation, starting, substitutes };
    commit();
    return clone(match.lineups[side]);
  },
};
