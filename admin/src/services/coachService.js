import { todayISO } from '@/utils/format';
import { api, ApiError, USE_MOCK } from './apiClient';
import { clone, commit, delay, getDb, nowIso, uid } from './mock/db';
import { matchesSearch, paginate, sortBy } from './mock/query';
import { enrichSession, notifyAdmins, teamSummary } from './mock/relations';
import { attendanceRecordsInScope, computeTeamRecords, summarizeAttendance } from './mock/statsEngine';

const FIELDS = ['name', 'photo', 'email', 'phone', 'gender', 'license', 'experience', 'team_id', 'status'];

function pick(data) {
  const out = {};
  FIELDS.forEach((f) => {
    if (data[f] !== undefined) out[f] = typeof data[f] === 'string' ? data[f].trim() : data[f];
  });
  if (out.email) out.email = out.email.toLowerCase();
  if (out.experience !== undefined) out.experience = Number(out.experience) || 0;
  if (out.team_id === '') out.team_id = null;
  return out;
}

/** Keeps teams.coach_id and coaches.team_id in sync (one head coach per team). */
function linkTeam(db, coach, teamId) {
  db.teams.forEach((t) => {
    if (t.coach_id === coach.id && t.id !== teamId) t.coach_id = null;
  });
  if (teamId) {
    const team = db.teams.find((t) => t.id === teamId);
    if (team) {
      const previous = db.coaches.find((c) => c.id === team.coach_id && c.id !== coach.id);
      if (previous) previous.team_id = null;
      team.coach_id = coach.id;
    }
  }
  coach.team_id = teamId || null;
}

const withTeam = (db, c) => ({ ...c, team: teamSummary(db, c.team_id) });

export const coachService = {
  async list({ search, status, teamId, page, pageSize, sort = 'name', dir = 'asc' } = {}) {
    if (!USE_MOCK) return api.get('/coaches', { search, status, teamId, page, pageSize, sort, dir });
    await delay();
    const db = getDb();
    const rows = db.coaches.filter(
      (c) =>
        (!status || c.status === status) &&
        (!teamId || (teamId === 'none' ? !c.team_id : c.team_id === teamId)) &&
        matchesSearch(search, c.name, c.email, c.license),
    );
    return clone(
      paginate(
        sortBy(rows, sort, dir).map((c) => ({
          ...withTeam(db, c),
          players_count: c.team_id ? db.players.filter((p) => p.team_id === c.team_id).length : 0,
        })),
        { page, pageSize },
      ),
    );
  },

  async options() {
    if (!USE_MOCK) return api.get('/coaches/options');
    await delay(120);
    return clone(sortBy(getDb().coaches, 'name').map((c) => ({ id: c.id, name: c.name, team_id: c.team_id, status: c.status, photo: c.photo })));
  },

  async get(id) {
    if (!USE_MOCK) return api.get(`/coaches/${id}`);
    await delay();
    const db = getDb();
    const coach = db.coaches.find((c) => c.id === id);
    if (!coach) throw new ApiError('errors.notFound', { status: 404 });
    const today = todayISO();
    const sessions = db.trainingSessions.filter((s) => s.coach_id === id);
    const record = coach.team_id ? computeTeamRecords(db).find((r) => r.team_id === coach.team_id) : null;
    const user = db.users.find((u) => u.id === coach.user_id);
    return clone({
      ...withTeam(db, coach),
      last_login_at: user?.last_login_at ?? null,
      players_count: coach.team_id ? db.players.filter((p) => p.team_id === coach.team_id).length : 0,
      sessions_total: sessions.length,
      sessions_completed: sessions.filter((s) => s.date < today).length,
      upcoming_sessions: sortBy(sessions.filter((s) => s.date >= today), 'date').slice(0, 5).map((s) => enrichSession(db, s)),
      attendance: coach.team_id ? summarizeAttendance(attendanceRecordsInScope(db, { teamId: coach.team_id })) : null,
      record,
    });
  },

  async create(data) {
    if (!USE_MOCK) return api.post('/coaches', data);
    await delay(450);
    const db = getDb();
    const values = pick(data);
    if (db.users.some((u) => u.email.toLowerCase() === values.email)) {
      throw new ApiError('errors.emailTaken', { fields: { email: 'errors.emailTaken' } });
    }
    const created = nowIso();
    const userId = uid('u');
    const coach = { id: uid('c'), user_id: userId, created_at: created, photo: null, gender: 'male', ...values, team_id: null };
    db.users.unshift({
      id: userId, name: coach.name, email: coach.email, phone: coach.phone, role: 'coach', status: coach.status,
      avatar: coach.photo, created_at: created, updated_at: created, last_login_at: null,
    });
    db.coaches.unshift(coach);
    linkTeam(db, coach, values.team_id);
    if (values.team_id) notifyAdmins(db, { type: 'account_update', template: 'coach_assigned', params: { name: coach.name, team: teamSummary(db, values.team_id)?.name }, link: `/admin/coaches/${coach.id}` });
    commit();
    return clone(withTeam(db, coach));
  },

  async update(id, data) {
    if (!USE_MOCK) return api.put(`/coaches/${id}`, data);
    await delay(400);
    const db = getDb();
    const coach = db.coaches.find((c) => c.id === id);
    if (!coach) throw new ApiError('errors.notFound', { status: 404 });
    const values = pick(data);
    if (values.email && db.users.some((u) => u.id !== coach.user_id && u.email.toLowerCase() === values.email)) {
      throw new ApiError('errors.emailTaken', { fields: { email: 'errors.emailTaken' } });
    }
    const { team_id: teamId, ...rest } = values;
    Object.assign(coach, rest);
    if (teamId !== undefined && teamId !== coach.team_id) {
      linkTeam(db, coach, teamId);
      if (teamId) notifyAdmins(db, { type: 'account_update', template: 'coach_assigned', params: { name: coach.name, team: teamSummary(db, teamId)?.name }, link: `/admin/coaches/${coach.id}` });
    }
    const user = db.users.find((u) => u.id === coach.user_id);
    if (user) Object.assign(user, { name: coach.name, email: coach.email, phone: coach.phone, status: coach.status, avatar: coach.photo, updated_at: nowIso() });
    commit();
    return clone(withTeam(db, coach));
  },

  async setStatus(id, status) {
    return this.update(id, { status });
  },

  async assignTeam(id, teamId) {
    return this.update(id, { team_id: teamId || null });
  },

  async remove(id) {
    if (!USE_MOCK) return api.delete(`/coaches/${id}`);
    await delay(350);
    const db = getDb();
    const coach = db.coaches.find((c) => c.id === id);
    if (!coach) throw new ApiError('errors.notFound', { status: 404 });
    db.teams.forEach((t) => {
      if (t.coach_id === id) t.coach_id = null;
    });
    db.coaches = db.coaches.filter((c) => c.id !== id);
    db.users = db.users.filter((u) => u.id !== coach.user_id);
    commit();
    return { ok: true };
  },
};
