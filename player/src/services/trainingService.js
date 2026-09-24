import { todayISO } from '@/utils/formatters';
import { api, ApiError, USE_MOCK } from './apiClient';
import { clone, delay, getDb } from './mock/db';
import { inDateRange, paginate } from './mock/query';
import { enrichMatch, teamSummary } from './mock/relations';
import { currentPlayer, involvesMyTeam } from './mock/scope';
import { sessionWithMyAttendance } from './playerService';

export const trainingService = {
  /** tab: upcoming | completed | cancelled — the player's team only, read-only. */
  async getTrainingSessions({ tab = 'upcoming', type, from, to, page, pageSize } = {}) {
    if (!USE_MOCK) return api.get('/player/training-sessions', { tab, type, from, to, page, pageSize });
    await delay();
    const db = getDb();
    const me = currentPlayer(db);
    const today = todayISO();
    const rows = db.trainingSessions.filter((s) => {
      if (s.team_id !== me.team_id) return false;
      if (type && s.training_type !== type) return false;
      if (tab === 'cancelled') return s.status === 'cancelled' && inDateRange(s.date, from, to);
      if (s.status === 'cancelled') return false;
      if (tab === 'upcoming' && s.date < today) return false;
      if (tab === 'completed' && s.date >= today) return false;
      return inDateRange(s.date, from, to);
    });
    const asc = tab === 'upcoming';
    rows.sort((a, b) => {
      const k = `${a.date}${a.start_time}`.localeCompare(`${b.date}${b.start_time}`);
      return asc ? k : -k;
    });
    return clone(paginate(rows.map((s) => sessionWithMyAttendance(db, s, me.id)), { page, pageSize }));
  },

  async counts() {
    if (!USE_MOCK) return api.get('/player/training-sessions/counts');
    await delay(60);
    const db = getDb();
    const me = currentPlayer(db);
    const today = todayISO();
    const mine = db.trainingSessions.filter((s) => s.team_id === me.team_id);
    return {
      upcoming: mine.filter((s) => s.status !== 'cancelled' && s.date >= today).length,
      completed: mine.filter((s) => s.status !== 'cancelled' && s.date < today).length,
      cancelled: mine.filter((s) => s.status === 'cancelled').length,
    };
  },

  async getTrainingSession(id) {
    if (!USE_MOCK) return api.get(`/player/training-sessions/${id}`);
    await delay();
    const db = getDb();
    const me = currentPlayer(db);
    const session = db.trainingSessions.find((s) => s.id === id);
    if (!session) throw new ApiError('errors.notFound', { status: 404 });
    if (session.team_id !== me.team_id) throw new ApiError('errors.forbidden', { status: 403 });
    const { notes: _coachNotes, ...publicSession } = session; // coach notes are private to coaches
    return clone(sessionWithMyAttendance(db, publicSession, me.id));
  },

  /** Calendar feed: training, matches, team events and competition dates for the player's team. */
  async calendar({ from, to } = {}) {
    if (!USE_MOCK) return api.get('/player/calendar', { from, to });
    await delay(200);
    const db = getDb();
    const me = currentPlayer(db);
    const events = [];
    db.trainingSessions
      .filter((s) => s.team_id === me.team_id && inDateRange(s.date, from, to))
      .forEach((s) =>
        events.push({ id: s.id, kind: 'training', date: s.date, start: s.start_time, end: s.end_time, team: teamSummary(db, s.team_id), training_type: s.training_type, cancelled: s.status === 'cancelled', location: s.location, link: `/player/training/${s.id}` }),
      );
    db.matches
      .filter((m) => involvesMyTeam(db, m) && inDateRange(m.date, from, to))
      .forEach((m) => {
        const e = enrichMatch(db, m);
        events.push({ id: m.id, kind: 'match', date: m.date, start: m.time, status: m.status, cancelled: m.status === 'cancelled', home: e.home_team, away: e.away_team, score: m.home_score === null ? null : `${m.home_score}–${m.away_score}`, location: m.location, link: `/player/matches/${m.id}` });
      });
    db.teamEvents
      .filter((ev) => ev.team_id === me.team_id && inDateRange(ev.date, from, to))
      .forEach((ev) => events.push({ id: ev.id, kind: 'event', date: ev.date, start: ev.start, end: ev.end, event_kind: ev.kind, location: ev.location, link: '/player/calendar?view=day' }));
    db.competitions
      .filter((c) => c.team_ids.includes(me.team_id) && (!to || c.start_date <= to) && (!from || c.end_date >= from))
      .forEach((c) => {
        if (inDateRange(c.start_date, from, to)) events.push({ id: `${c.id}-start`, kind: 'competition', date: c.start_date, name: c.name, season: c.season, edge: 'start', link: `/player/competitions/${c.id}` });
        if (inDateRange(c.end_date, from, to)) events.push({ id: `${c.id}-end`, kind: 'competition', date: c.end_date, name: c.name, season: c.season, edge: 'end', link: `/player/competitions/${c.id}` });
      });
    events.sort((a, b) => `${a.date}${a.start ?? '00:00'}`.localeCompare(`${b.date}${b.start ?? '00:00'}`));
    return clone(events);
  },
};
