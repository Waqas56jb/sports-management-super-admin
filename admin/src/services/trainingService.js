import { todayISO } from '@/utils/format';
import { api, ApiError, USE_MOCK } from './apiClient';
import { clone, commit, delay, getDb, nowIso, uid } from './mock/db';
import { inDateRange, matchesSearch, paginate } from './mock/query';
import { enrichSession, notifyAdmins, playerSummary, teamSummary } from './mock/relations';
import { attendanceRecordsInScope, summarizeAttendance } from './mock/statsEngine';

const FIELDS = ['team_id', 'date', 'start_time', 'end_time', 'location', 'training_type', 'description'];

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

export const trainingService = {
  async list({ search, teamId, type, from, to, when, page, pageSize, dir } = {}) {
    if (!USE_MOCK) return api.get('/training-sessions', { search, teamId, type, from, to, when, page, pageSize, dir });
    await delay();
    const db = getDb();
    const today = todayISO();
    const teamName = Object.fromEntries(db.teams.map((t) => [t.id, t.name]));
    const rows = db.trainingSessions.filter(
      (s) =>
        (!teamId || s.team_id === teamId) &&
        (!type || s.training_type === type) &&
        (!when || (when === 'upcoming' ? s.date >= today : s.date < today)) &&
        inDateRange(s.date, from, to) &&
        matchesSearch(search, teamName[s.team_id], s.location, s.description),
    );
    const direction = dir ?? (when === 'completed' ? 'desc' : 'asc');
    rows.sort((a, b) => {
      const k = `${a.date}${a.start_time}`.localeCompare(`${b.date}${b.start_time}`);
      return direction === 'desc' ? -k : k;
    });
    return clone(paginate(rows.map((s) => withAttendance(db, s)), { page, pageSize }));
  },

  async get(id) {
    if (!USE_MOCK) return api.get(`/training-sessions/${id}`);
    await delay();
    const db = getDb();
    const session = db.trainingSessions.find((s) => s.id === id);
    if (!session) throw new ApiError('errors.notFound', { status: 404 });
    const records = attendanceRecordsInScope(db, { sessionId: id });
    const recorded = Object.fromEntries(records.map((r) => [r.player_id, r]));
    const squad = db.players
      .filter((p) => p.team_id === session.team_id && p.status !== 'inactive')
      .map((p) => ({ player: playerSummary(db, p.id), status: recorded[p.id]?.status ?? null, notes: recorded[p.id]?.notes ?? '' }));
    // Players who attended but have since left the team still appear in the register.
    records
      .filter((r) => !squad.some((s) => s.player?.id === r.player_id))
      .forEach((r) => squad.push({ player: playerSummary(db, r.player_id), status: r.status, notes: r.notes }));
    squad.sort((a, b) => (a.player?.jersey_number ?? 99) - (b.player?.jersey_number ?? 99));
    return clone({ ...withAttendance(db, session), register: squad, summary: summarizeAttendance(records) });
  },

  async create(data) {
    if (!USE_MOCK) return api.post('/training-sessions', data);
    await delay(450);
    const db = getDb();
    const values = pick(data);
    const team = db.teams.find((t) => t.id === values.team_id);
    const session = { id: uid('ts'), created_at: nowIso(), coach_id: team?.coach_id ?? null, ...values };
    db.trainingSessions.push(session);
    notifyAdmins(db, { type: 'training_created', template: 'training_created', params: { team: teamSummary(db, session.team_id)?.name, date: session.date }, link: `/admin/training/${session.id}` });
    commit();
    return clone(enrichSession(db, session));
  },

  async update(id, data) {
    if (!USE_MOCK) return api.put(`/training-sessions/${id}`, data);
    await delay(400);
    const db = getDb();
    const session = db.trainingSessions.find((s) => s.id === id);
    if (!session) throw new ApiError('errors.notFound', { status: 404 });
    const values = pick(data);
    if (values.team_id && values.team_id !== session.team_id) {
      db.attendance = db.attendance.filter((a) => a.training_session_id !== id);
      session.coach_id = db.teams.find((t) => t.id === values.team_id)?.coach_id ?? null;
    }
    Object.assign(session, values);
    commit();
    return clone(enrichSession(db, session));
  },

  /** records: [{ player_id, status, notes }] — replaces the register for the session. */
  async saveAttendance(id, records) {
    if (!USE_MOCK) return api.put(`/training-sessions/${id}/attendance`, { records });
    await delay(450);
    const db = getDb();
    if (!db.trainingSessions.some((s) => s.id === id)) throw new ApiError('errors.notFound', { status: 404 });
    db.attendance = db.attendance.filter((a) => a.training_session_id !== id);
    records
      .filter((r) => r.status)
      .forEach((r) => db.attendance.push({ id: uid('a'), training_session_id: id, player_id: r.player_id, status: r.status, notes: r.notes ?? '' }));
    commit();
    return { ok: true };
  },

  async remove(id) {
    if (!USE_MOCK) return api.delete(`/training-sessions/${id}`);
    await delay(350);
    const db = getDb();
    db.trainingSessions = db.trainingSessions.filter((s) => s.id !== id);
    db.attendance = db.attendance.filter((a) => a.training_session_id !== id);
    commit();
    return { ok: true };
  },

  /** Calendar feed: training, matches and competition windows in a date range. */
  async calendar({ from, to, teamId } = {}) {
    if (!USE_MOCK) return api.get('/calendar', { from, to, teamId });
    await delay(200);
    const db = getDb();
    const events = [];
    db.trainingSessions
      .filter((s) => inDateRange(s.date, from, to) && (!teamId || s.team_id === teamId))
      .forEach((s) =>
        events.push({ id: s.id, kind: 'training', date: s.date, start: s.start_time, end: s.end_time, team: teamSummary(db, s.team_id), training_type: s.training_type, location: s.location, link: `/admin/training/${s.id}` }),
      );
    db.matches
      .filter((m) => inDateRange(m.date, from, to) && (!teamId || m.home_team_id === teamId || m.away_team_id === teamId))
      .forEach((m) =>
        events.push({ id: m.id, kind: 'match', date: m.date, start: m.time, status: m.status, home: teamSummary(db, m.home_team_id), away: teamSummary(db, m.away_team_id), score: m.home_score === null ? null : `${m.home_score}–${m.away_score}`, location: m.location, link: `/admin/matches/${m.id}` }),
      );
    db.competitions
      .filter((c) => (!to || c.start_date <= to) && (!from || c.end_date >= from))
      .forEach((c) => {
        if (inDateRange(c.start_date, from, to)) events.push({ id: `${c.id}-start`, kind: 'competition', date: c.start_date, name: c.name, season: c.season, edge: 'start', link: `/admin/competitions/${c.id}` });
        if (inDateRange(c.end_date, from, to)) events.push({ id: `${c.id}-end`, kind: 'competition', date: c.end_date, name: c.name, season: c.season, edge: 'end', link: `/admin/competitions/${c.id}` });
      });
    events.sort((a, b) => `${a.date}${a.start ?? '00:00'}`.localeCompare(`${b.date}${b.start ?? '00:00'}`));
    return clone(events);
  },
};
