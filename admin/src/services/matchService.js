import { api, ApiError, USE_MOCK } from './apiClient';
import { clone, commit, delay, getDb, nowIso, uid } from './mock/db';
import { inDateRange, matchesSearch, paginate, sortBy } from './mock/query';
import { enrichMatch, notifyAdmins, playerSummary, teamSummary } from './mock/relations';
import { matchPlayerLines } from './mock/statsEngine';

const FIELDS = ['competition_id', 'home_team_id', 'away_team_id', 'date', 'time', 'location', 'referee', 'status', 'round'];

function pick(data) {
  const out = {};
  FIELDS.forEach((f) => {
    if (data[f] !== undefined) out[f] = typeof data[f] === 'string' ? data[f].trim() : data[f];
  });
  if (out.competition_id === '') out.competition_id = null;
  return out;
}

function validateFixture(db, values, exceptId) {
  if (values.home_team_id === values.away_team_id) {
    throw new ApiError('matches.errors.sameTeam', { fields: { away_team_id: 'matches.errors.sameTeam' } });
  }
  const clash = db.matches.find(
    (m) =>
      m.id !== exceptId &&
      m.status !== 'cancelled' &&
      m.date === values.date &&
      [m.home_team_id, m.away_team_id].some((t) => t === values.home_team_id || t === values.away_team_id),
  );
  if (clash) throw new ApiError('matches.errors.teamBusy', { fields: { date: 'matches.errors.teamBusy' } });
}

/** Goals recorded as events drive the score, so the scoreboard and statistics never disagree. */
function recomputeScore(db, match) {
  const goals = db.matchEvents.filter((e) => e.match_id === match.id && e.event_type === 'goal');
  match.home_score = goals.filter((e) => e.team_id === match.home_team_id).length;
  match.away_score = goals.filter((e) => e.team_id === match.away_team_id).length;
}

export const matchService = {
  async list({ search, status, competitionId, teamId, from, to, when, page, pageSize, sort = 'date', dir } = {}) {
    if (!USE_MOCK) return api.get('/matches', { search, status, competitionId, teamId, from, to, when, page, pageSize, sort, dir });
    await delay();
    const db = getDb();
    const teamName = Object.fromEntries(db.teams.map((t) => [t.id, t.name]));
    const rows = db.matches.filter(
      (m) =>
        (!status || m.status === status) &&
        (!competitionId || (competitionId === 'friendly' ? !m.competition_id : m.competition_id === competitionId)) &&
        (!teamId || m.home_team_id === teamId || m.away_team_id === teamId) &&
        (!when || (when === 'upcoming' ? m.status === 'scheduled' || m.status === 'live' : m.status === 'completed' || m.status === 'cancelled')) &&
        inDateRange(m.date, from, to) &&
        matchesSearch(search, teamName[m.home_team_id], teamName[m.away_team_id], m.location, m.referee),
    );
    const direction = dir ?? (when === 'upcoming' ? 'asc' : 'desc');
    const sorted = [...rows].sort((a, b) => {
      const k = `${a[sort] ?? ''}${sort === 'date' ? a.time : ''}`.localeCompare(`${b[sort] ?? ''}${sort === 'date' ? b.time : ''}`);
      return direction === 'desc' ? -k : k;
    });
    return clone(paginate(sorted.map((m) => enrichMatch(db, m)), { page, pageSize }));
  },

  async get(id) {
    if (!USE_MOCK) return api.get(`/matches/${id}`);
    await delay();
    const db = getDb();
    const match = db.matches.find((m) => m.id === id);
    if (!match) throw new ApiError('errors.notFound', { status: 404 });
    const byId = Object.fromEntries(db.players.map((p) => [p.id, p]));
    const events = sortBy(db.matchEvents.filter((e) => e.match_id === id), 'minute').map((e) => ({
      ...e,
      player: playerSummary(db, e.player_id),
      related_player: playerSummary(db, e.related_player_id),
    }));
    const squad = (teamId) =>
      sortBy(db.players.filter((p) => p.team_id === teamId), 'jersey_number').map((p) => ({ ...playerSummary(db, p.id), status: p.status }));
    return clone({
      ...enrichMatch(db, match),
      events,
      player_lines: matchPlayerLines(match, db.matchEvents, byId),
      squads: { home: squad(match.home_team_id), away: squad(match.away_team_id) },
    });
  },

  async create(data) {
    if (!USE_MOCK) return api.post('/matches', data);
    await delay(450);
    const db = getDb();
    const values = pick(data);
    validateFixture(db, values);
    const match = {
      id: uid('m'), round: null, home_score: null, away_score: null, live_minute: null, lineups: null, created_at: nowIso(),
      ...values, status: values.status === 'completed' || values.status === 'live' ? values.status : values.status || 'scheduled',
    };
    if (match.status === 'completed' || match.status === 'live') {
      match.home_score = 0;
      match.away_score = 0;
    }
    db.matches.push(match);
    notifyAdmins(db, {
      type: 'match_scheduled',
      template: 'match_scheduled',
      params: { home: teamSummary(db, match.home_team_id)?.name, away: teamSummary(db, match.away_team_id)?.name, date: match.date },
      link: `/admin/matches/${match.id}`,
    });
    commit();
    return clone(enrichMatch(db, match));
  },

  async update(id, data) {
    if (!USE_MOCK) return api.put(`/matches/${id}`, data);
    await delay(400);
    const db = getDb();
    const match = db.matches.find((m) => m.id === id);
    if (!match) throw new ApiError('errors.notFound', { status: 404 });
    const values = pick(data);
    const next = { ...match, ...values };
    validateFixture(db, next, id);
    const teamsChanged = next.home_team_id !== match.home_team_id || next.away_team_id !== match.away_team_id;
    if (teamsChanged && db.matchEvents.some((e) => e.match_id === id)) throw new ApiError('matches.errors.teamsLocked');
    Object.assign(match, values);
    if (teamsChanged) match.lineups = null;
    if ((match.status === 'completed' || match.status === 'live') && match.home_score === null) {
      match.home_score = 0;
      match.away_score = 0;
    }
    commit();
    return clone(enrichMatch(db, match));
  },

  /** Status + live minute. Manual scores are only allowed when no goal events exist. */
  async updateScore(id, { status, home_score, away_score, live_minute }) {
    if (!USE_MOCK) return api.patch(`/matches/${id}/score`, { status, home_score, away_score, live_minute });
    await delay(350);
    const db = getDb();
    const match = db.matches.find((m) => m.id === id);
    if (!match) throw new ApiError('errors.notFound', { status: 404 });
    const hasGoalEvents = db.matchEvents.some((e) => e.match_id === id && e.event_type === 'goal');
    match.status = status;
    match.live_minute = status === 'live' ? Number(live_minute) || match.live_minute || 1 : null;
    if (status === 'scheduled' || status === 'cancelled') {
      if (!hasGoalEvents) {
        match.home_score = null;
        match.away_score = null;
      }
    } else if (hasGoalEvents) {
      recomputeScore(db, match);
    } else {
      match.home_score = Number(home_score) || 0;
      match.away_score = Number(away_score) || 0;
    }
    if (status === 'completed') {
      notifyAdmins(db, {
        type: 'match_reminder',
        template: 'match_result',
        params: { home: teamSummary(db, match.home_team_id)?.name, away: teamSummary(db, match.away_team_id)?.name, score: `${match.home_score}–${match.away_score}` },
        link: `/admin/matches/${id}`,
      });
    }
    commit();
    return clone(enrichMatch(db, match));
  },

  async addEvent(matchId, data) {
    if (!USE_MOCK) return api.post(`/matches/${matchId}/events`, data);
    await delay(350);
    const db = getDb();
    const match = db.matches.find((m) => m.id === matchId);
    if (!match) throw new ApiError('errors.notFound', { status: 404 });
    if (match.status === 'scheduled' || match.status === 'cancelled') throw new ApiError('matches.errors.notStarted');
    const player = db.players.find((p) => p.id === data.player_id);
    const teamId = data.team_id ?? player?.team_id;
    if (teamId !== match.home_team_id && teamId !== match.away_team_id) throw new ApiError('matches.errors.playerNotInMatch');
    const side = teamId === match.home_team_id ? 'home' : 'away';
    // Anyone who takes part in an event is added to the match squad so minutes are tracked.
    if (!match.lineups) match.lineups = { home: { formation: '4-3-3', starting: [], substitutes: [] }, away: { formation: '4-3-3', starting: [], substitutes: [] } };
    const lineup = match.lineups[side];
    const ensureInSquad = (pid) => {
      if (pid && !lineup.starting.includes(pid) && !lineup.substitutes.includes(pid)) lineup.starting.push(pid);
    };
    if (data.event_type === 'substitution') {
      if (data.related_player_id && !lineup.substitutes.includes(data.related_player_id)) {
        lineup.starting = lineup.starting.filter((pid) => pid !== data.related_player_id);
        lineup.substitutes.push(data.related_player_id);
      }
      ensureInSquad(data.player_id);
    } else ensureInSquad(data.player_id);

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
    if (!USE_MOCK) return api.delete(`/matches/${matchId}/events/${eventId}`);
    await delay(300);
    const db = getDb();
    const match = db.matches.find((m) => m.id === matchId);
    const event = db.matchEvents.find((e) => e.id === eventId);
    if (!match || !event) throw new ApiError('errors.notFound', { status: 404 });
    db.matchEvents = db.matchEvents.filter((e) => e.id !== eventId);
    if (event.event_type === 'goal') {
      // Remove the linked assist recorded at the same minute for the same scorer.
      db.matchEvents = db.matchEvents.filter(
        (e) => !(e.match_id === matchId && e.event_type === 'assist' && e.related_player_id === event.player_id && e.minute === event.minute),
      );
      recomputeScore(db, match);
    }
    commit();
    return { ok: true };
  },

  async saveLineup(matchId, side, { formation, starting, substitutes }) {
    if (!USE_MOCK) return api.put(`/matches/${matchId}/lineups/${side}`, { formation, starting, substitutes });
    await delay(400);
    const db = getDb();
    const match = db.matches.find((m) => m.id === matchId);
    if (!match) throw new ApiError('errors.notFound', { status: 404 });
    if (starting.length !== 11) throw new ApiError('matches.lineup.errors.elevenRequired');
    match.lineups = match.lineups ?? { home: null, away: null };
    match.lineups[side] = { formation, starting, substitutes };
    const teamId = side === 'home' ? match.home_team_id : match.away_team_id;
    notifyAdmins(db, {
      type: 'lineup_announced',
      template: 'lineup_announced',
      params: { team: teamSummary(db, teamId)?.name, home: teamSummary(db, match.home_team_id)?.name, away: teamSummary(db, match.away_team_id)?.name },
      link: `/admin/matches/${matchId}`,
    });
    commit();
    return clone(match.lineups[side]);
  },

  async remove(id) {
    if (!USE_MOCK) return api.delete(`/matches/${id}`);
    await delay(350);
    const db = getDb();
    if (!db.matches.some((m) => m.id === id)) throw new ApiError('errors.notFound', { status: 404 });
    db.matches = db.matches.filter((m) => m.id !== id);
    db.matchEvents = db.matchEvents.filter((e) => e.match_id !== id);
    commit();
    return { ok: true };
  },
};
