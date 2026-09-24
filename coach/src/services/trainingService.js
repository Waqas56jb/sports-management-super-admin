import { todayISO } from '@/utils/format';
import { api, ApiError, USE_MOCK } from './apiClient';
import { clone, commit, delay, getDb, nowIso, uid } from './mock/db';
import { inDateRange, matchesSearch, paginate } from './mock/query';
import { enrichSession, playerSummary, teamSummary } from './mock/relations';
import { assertMyTeam, currentCoach, involvesMyTeam, myTeamIds } from './mock/scope';
import { attendanceRecordsInScope, summarizeAttendance } from './mock/statsEngine';

const FIELDS = ['team_id', 'date', 'start_time', 'end_time', 'location', 'training_type', 'description', 'notes'];

function pick(data) {
  const out = {};
  FIELDS.forEach((f) => {
    if (data[f] !== undefined) out[f] = typeof data[f] === 'string' ? data[f].trim() : data[f];
  });
  return out;
}

function withAttendance(db, s) {
  const recs = db.attendance.filter((a) => a.training_session_id === s.id);
  return { ...enrichSession(db, s), attendance_rate: summarizeAttendance(recs).rate, attendance_recorded: recs.length > 0 };
}

function findOwned(db, id) {
  const session = db.trainingSessions.find((s) => s.id === id);
  if (!session) throw new ApiError('errors.notFound', { status: 404 });
  assertMyTeam(db, session.team_id);
  return session;
}

/** Same team cannot have two overlapping sessions on the same day. */
function assertNoOverlap(db, values, exceptId) {
  const clash = db.trainingSessions.find(
    (s) => s.id !== exceptId && s.status !== 'cancelled' && s.team_id === values.team_id && s.date === values.date && s.start_time < values.end_time && values.start_time < s.end_time,
  );
  if (clash) throw new ApiError('training.errors.overlap', { fields: { start_time: 'training.errors.overlap' } });
}

export const trainingService = {
  /** when: 'upcoming' | 'completed' | 'cancelled' */
  async list({ search, teamId, type, from, to, when, page, pageSize, dir } = {}) {
    if (!USE_MOCK) return api.get('/coach/training-sessions', { search, teamId, type, from, to, when, page, pageSize, dir });
    await delay();
    const db = getDb();
    const ids = myTeamIds(db);
    const today = todayISO();
    const teamName = Object.fromEntries(db.teams.map((t) => [t.id, t.name]));
    const rows = db.trainingSessions.filter((s) => {
      if (!ids.includes(s.team_id)) return false;
      if (teamId && s.team_id !== teamId) return false;
      if (type && s.training_type !== type) return false;
      if (when === 'cancelled' && s.status !== 'cancelled') return false;
      if (when === 'upcoming' && (s.status === 'cancelled' || s.date < today)) return false;
      if (when === 'completed' && (s.status === 'cancelled' || s.date >= today)) return false;
      return inDateRange(s.date, from, to) && matchesSearch(search, teamName[s.team_id], s.location, s.description, s.notes);
    });
    const direction = dir ?? (when === 'upcoming' ? 'asc' : 'desc');
    rows.sort((a, b) => {
      const k = `${a.date}${a.start_time}`.localeCompare(`${b.date}${b.start_time}`);
      return direction === 'desc' ? -k : k;
    });
    return clone(paginate(rows.map((s) => withAttendance(db, s)), { page, pageSize }));
  },

  /** Sessions for pickers (attendance filters). */
  async options({ teamId } = {}) {
    if (!USE_MOCK) return api.get('/coach/training-sessions/options', { teamId });
    await delay(80);
    const db = getDb();
    const ids = myTeamIds(db);
    const today = todayISO();
    return clone(
      db.trainingSessions
        .filter((s) => ids.includes(s.team_id) && (!teamId || s.team_id === teamId) && s.status !== 'cancelled' && s.date <= today)
        .sort((a, b) => b.date.localeCompare(a.date))
        .slice(0, 60)
        .map((s) => ({ id: s.id, date: s.date, start_time: s.start_time, team: teamSummary(db, s.team_id), training_type: s.training_type })),
    );
  },

  async get(id) {
    if (!USE_MOCK) return api.get(`/coach/training-sessions/${id}`);
    await delay();
    const db = getDb();
    const session = findOwned(db, id);
    const records = attendanceRecordsInScope(db, { sessionId: id });
    const recorded = Object.fromEntries(records.map((r) => [r.player_id, r]));
    const register = db.players
      .filter((p) => p.team_id === session.team_id && p.status !== 'inactive')
      .map((p) => ({ player: playerSummary(db, p.id), player_status: p.status, status: recorded[p.id]?.status ?? null, notes: recorded[p.id]?.notes ?? '' }));
    records
      .filter((r) => !register.some((x) => x.player?.id === r.player_id))
      .forEach((r) => register.push({ player: playerSummary(db, r.player_id), status: r.status, notes: r.notes }));
    register.sort((a, b) => (a.player?.jersey_number ?? 99) - (b.player?.jersey_number ?? 99));
    return clone({ ...withAttendance(db, session), register, summary: summarizeAttendance(records) });
  },

  async create(data) {
    if (!USE_MOCK) return api.post('/coach/training-sessions', data);
    await delay(450);
    const db = getDb();
    const values = pick(data);
    assertMyTeam(db, values.team_id);
    assertNoOverlap(db, values);
    const session = { id: uid('ts'), created_at: nowIso(), coach_id: currentCoach(db).id, status: 'scheduled', cancellation_reason: '', notes: '', ...values };
    db.trainingSessions.push(session);
    commit();
    return clone(enrichSession(db, session));
  },

  async update(id, data) {
    if (!USE_MOCK) return api.put(`/coach/training-sessions/${id}`, data);
    await delay(400);
    const db = getDb();
    const session = findOwned(db, id);
    const values = pick(data);
    if (values.team_id) assertMyTeam(db, values.team_id);
    assertNoOverlap(db, { ...session, ...values }, id);
    if (values.team_id && values.team_id !== session.team_id) db.attendance = db.attendance.filter((a) => a.training_session_id !== id);
    Object.assign(session, values);
    commit();
    return clone(enrichSession(db, session));
  },

  /** Cancelling keeps the session (and its history) but removes it from schedules. */
  async cancel(id, reason = '') {
    if (!USE_MOCK) return api.post(`/coach/training-sessions/${id}/cancel`, { reason });
    await delay(350);
    const db = getDb();
    const session = findOwned(db, id);
    session.status = 'cancelled';
    session.cancellation_reason = reason.trim();
    commit();
    return clone(enrichSession(db, session));
  },

  async restore(id) {
    if (!USE_MOCK) return api.post(`/coach/training-sessions/${id}/restore`);
    await delay(300);
    const db = getDb();
    const session = findOwned(db, id);
    session.status = 'scheduled';
    session.cancellation_reason = '';
    commit();
    return clone(enrichSession(db, session));
  },

  /** records: [{ player_id, status, notes }] — replaces the register for the session. */
  async saveAttendance(id, records) {
    if (!USE_MOCK) return api.put(`/coach/training-sessions/${id}/attendance`, { records });
    await delay(450);
    const db = getDb();
    const session = findOwned(db, id);
    if (session.status === 'cancelled') throw new ApiError('training.errors.cancelled');
    if (session.date > todayISO()) throw new ApiError('training.errors.future');
    db.attendance = db.attendance.filter((a) => a.training_session_id !== id);
    records
      .filter((r) => r.status)
      .forEach((r) => db.attendance.push({ id: uid('a'), training_session_id: id, player_id: r.player_id, status: r.status, notes: r.notes ?? '' }));
    commit();
    return { ok: true };
  },

  /** Calendar feed: training, matches and competition dates for the coach's teams. */
  async calendar({ from, to, teamId } = {}) {
    if (!USE_MOCK) return api.get('/coach/calendar', { from, to, teamId });
    await delay(200);
    const db = getDb();
    const ids = teamId ? [teamId] : myTeamIds(db);
    const events = [];
    db.trainingSessions
      .filter((s) => ids.includes(s.team_id) && inDateRange(s.date, from, to))
      .forEach((s) =>
        events.push({ id: s.id, kind: 'training', date: s.date, start: s.start_time, end: s.end_time, team: teamSummary(db, s.team_id), training_type: s.training_type, cancelled: s.status === 'cancelled', location: s.location, link: `/coach/training/${s.id}` }),
      );
    db.matches
      .filter((m) => involvesMyTeam(db, m) && (!teamId || m.home_team_id === teamId || m.away_team_id === teamId) && inDateRange(m.date, from, to))
      .forEach((m) =>
        events.push({ id: m.id, kind: 'match', date: m.date, start: m.time, status: m.status, cancelled: m.status === 'cancelled', home: teamSummary(db, m.home_team_id), away: teamSummary(db, m.away_team_id), score: m.home_score === null ? null : `${m.home_score}–${m.away_score}`, location: m.location, link: `/coach/matches/${m.id}` }),
      );
    db.competitions
      .filter((c) => c.team_ids.some((t) => ids.includes(t)) && (!to || c.start_date <= to) && (!from || c.end_date >= from))
      .forEach((c) => {
        if (inDateRange(c.start_date, from, to)) events.push({ id: `${c.id}-start`, kind: 'competition', date: c.start_date, name: c.name, season: c.season, edge: 'start', link: `/coach/competitions/${c.id}` });
        if (inDateRange(c.end_date, from, to)) events.push({ id: `${c.id}-end`, kind: 'competition', date: c.end_date, name: c.name, season: c.season, edge: 'end', link: `/coach/competitions/${c.id}` });
      });
    events.sort((a, b) => `${a.date}${a.start ?? '00:00'}`.localeCompare(`${b.date}${b.start ?? '00:00'}`));
    return clone(events);
  },
};
