import { todayISO } from '@/utils/format';
import { api, ApiError, USE_MOCK } from './apiClient';
import { clone, commit, delay, getDb, nowIso, uid } from './mock/db';
import { matchesSearch, paginate, sortBy } from './mock/query';

const linkedProfile = (db, user) =>
  user.role === 'player'
    ? db.players.find((p) => p.user_id === user.id)
    : user.role === 'coach'
      ? db.coaches.find((c) => c.user_id === user.id)
      : null;

const withProfile = (db, u) => {
  const profile = linkedProfile(db, u);
  return { ...u, profile: profile ? { type: u.role, id: profile.id } : null };
};

function assertUniqueEmail(db, email, exceptId) {
  if (db.users.some((u) => u.id !== exceptId && u.email.toLowerCase() === email)) {
    throw new ApiError('errors.emailTaken', { fields: { email: 'errors.emailTaken' } });
  }
}

export const userService = {
  async list({ search, role, status, page, pageSize, sort = 'created_at', dir = 'desc' } = {}) {
    if (!USE_MOCK) return api.get('/users', { search, role, status, page, pageSize, sort, dir });
    await delay();
    const db = getDb();
    const rows = db.users
      .filter((u) => (!role || u.role === role) && (!status || u.status === status) && matchesSearch(search, u.name, u.email))
      .map((u) => withProfile(db, u));
    return clone(paginate(sortBy(rows, sort, dir), { page, pageSize }));
  },

  async counts() {
    if (!USE_MOCK) return api.get('/users/counts');
    await delay(120);
    const db = getDb();
    const by = (k, v) => db.users.filter((u) => u[k] === v).length;
    return {
      total: db.users.length,
      super_admin: by('role', 'super_admin'),
      coach: by('role', 'coach'),
      player: by('role', 'player'),
      active: by('status', 'active'),
      inactive: by('status', 'inactive'),
      suspended: by('status', 'suspended'),
    };
  },

  /** Creating a coach/player account also creates the matching (empty) profile. */
  async create(data) {
    if (!USE_MOCK) return api.post('/users', data);
    await delay(450);
    const db = getDb();
    const email = data.email.trim().toLowerCase();
    assertUniqueEmail(db, email);
    const created = nowIso();
    const user = {
      id: uid('u'),
      name: data.name.trim(),
      email,
      phone: data.phone ?? '',
      role: data.role,
      status: data.status,
      avatar: null,
      created_at: created,
      updated_at: created,
      last_login_at: null,
    };
    db.users.unshift(user);
    if (user.role === 'coach') {
      db.coaches.unshift({
        id: uid('c'), user_id: user.id, name: user.name, photo: null, email, phone: user.phone, gender: 'male',
        license: '', experience: 0, team_id: null, status: user.status === 'active' ? 'active' : 'inactive', created_at: created,
      });
    }
    if (user.role === 'player') {
      db.players.unshift({
        id: uid('p'), user_id: user.id, name: user.name, photo: null, date_of_birth: '', gender: 'male', phone: user.phone, email,
        address: '', position: 'midfielder', jersey_number: null, team_id: null, emergency_contact_name: '',
        emergency_contact_phone: '', emergency_contact_relation: '', status: user.status, registration_date: todayISO(),
      });
    }
    commit();
    return clone(withProfile(db, user));
  },

  async update(id, data) {
    if (!USE_MOCK) return api.put(`/users/${id}`, data);
    await delay(400);
    const db = getDb();
    const user = db.users.find((u) => u.id === id);
    if (!user) throw new ApiError('errors.notFound', { status: 404 });
    const email = data.email.trim().toLowerCase();
    assertUniqueEmail(db, email, id);
    const profile = linkedProfile(db, user);
    if (profile && data.role !== user.role) throw new ApiError('users.errors.roleLocked');
    Object.assign(user, { name: data.name.trim(), email, role: data.role, status: data.status, updated_at: nowIso() });
    if (profile) Object.assign(profile, { name: user.name, email, status: user.role === 'coach' && user.status === 'suspended' ? 'inactive' : user.status });
    commit();
    return clone(withProfile(db, user));
  },

  async setStatus(id, status) {
    if (!USE_MOCK) return api.patch(`/users/${id}/status`, { status });
    await delay(300);
    const db = getDb();
    const user = db.users.find((u) => u.id === id);
    if (!user) throw new ApiError('errors.notFound', { status: 404 });
    user.status = status;
    user.updated_at = nowIso();
    const profile = linkedProfile(db, user);
    if (profile) profile.status = user.role === 'coach' && status === 'suspended' ? 'inactive' : status;
    commit();
    return clone(withProfile(db, user));
  },

  /** The server emails a reset link, or sets the temporary password supplied by the admin. */
  async resetPassword(id, { mode, password }) {
    if (!USE_MOCK) return api.post(`/users/${id}/reset-password`, { mode, password });
    await delay(500);
    const user = getDb().users.find((u) => u.id === id);
    if (!user) throw new ApiError('errors.notFound', { status: 404 });
    user.updated_at = nowIso();
    commit();
    return { ok: true };
  },

  async remove(id, currentUserId) {
    if (!USE_MOCK) return api.delete(`/users/${id}`);
    await delay(350);
    const db = getDb();
    if (id === currentUserId) throw new ApiError('users.errors.cannotDeleteSelf');
    const user = db.users.find((u) => u.id === id);
    if (!user) throw new ApiError('errors.notFound', { status: 404 });
    if (user.role === 'super_admin' && db.users.filter((u) => u.role === 'super_admin').length === 1) {
      throw new ApiError('users.errors.lastAdmin');
    }
    const profile = linkedProfile(db, user);
    if (profile && user.role === 'player') {
      db.players = db.players.filter((p) => p.id !== profile.id);
      db.attendance = db.attendance.filter((a) => a.player_id !== profile.id);
    }
    if (profile && user.role === 'coach') {
      db.coaches = db.coaches.filter((c) => c.id !== profile.id);
      db.teams.forEach((t) => {
        if (t.coach_id === profile.id) t.coach_id = null;
      });
    }
    db.users = db.users.filter((u) => u.id !== id);
    commit();
    return { ok: true };
  },
};
