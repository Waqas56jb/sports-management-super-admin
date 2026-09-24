import { todayISO } from '@/utils/format';
import { api, ApiError, USE_MOCK } from './apiClient';
import { clone, commit, delay, getDb, nowIso, uid } from './mock/db';
import { matchesSearch, paginate, sortBy } from './mock/query';
import { coachSummary, enrichMatch, notifyAdmins, teamSummary } from './mock/relations';
import { attendanceRecordsInScope, computePlayerStats, matchPlayerLines, summarizeAttendance } from './mock/statsEngine';

const FIELDS = [
  'name', 'photo', 'date_of_birth', 'gender', 'phone', 'email', 'address', 'position', 'jersey_number', 'team_id',
  'emergency_contact_name', 'emergency_contact_phone', 'emergency_contact_relation', 'status', 'registration_date',
];

function pick(data) {
  const out = {};
  FIELDS.forEach((f) => {
    if (data[f] !== undefined) out[f] = typeof data[f] === 'string' ? data[f].trim() : data[f];
  });
  if (out.email) out.email = out.email.toLowerCase();
  if (out.jersey_number !== undefined) out.jersey_number = out.jersey_number === '' || out.jersey_number === null ? null : Number(out.jersey_number);
  if (out.team_id === '') out.team_id = null;
  return out;
}

function validateUnique(db, values, exceptId) {
  const fields = {};
  const exceptUser = db.players.find((p) => p.id === exceptId)?.user_id;
  if (values.email && db.users.some((u) => u.id !== exceptUser && u.email.toLowerCase() === values.email)) {
    fields.email = 'errors.emailTaken';
  }
  if (values.team_id && values.jersey_number) {
    const clash = db.players.find((p) => p.id !== exceptId && p.team_id === values.team_id && p.jersey_number === values.jersey_number);
    if (clash) fields.jersey_number = 'players.errors.jerseyTaken';
  }
  if (Object.keys(fields).length) throw new ApiError(Object.values(fields)[0], { fields });
}

const withTeam = (db, p) => ({ ...p, team: teamSummary(db, p.team_id) });

export const playerService = {
  async list({ search, teamId, position, status, page, pageSize, sort = 'name', dir = 'asc' } = {}) {
    if (!USE_MOCK) return api.get('/players', { search, teamId, position, status, page, pageSize, sort, dir });
    await delay();
    const db = getDb();
    const rows = db.players.filter(
      (p) =>
        (!teamId || (teamId === 'none' ? !p.team_id : p.team_id === teamId)) &&
        (!position || p.position === position) &&
        (!status || p.status === status) &&
        matchesSearch(search, p.name, p.email, p.jersey_number),
    );
    return clone(paginate(sortBy(rows, sort, dir).map((p) => withTeam(db, p)), { page, pageSize }));
  },

  /** Lightweight list for selects/pickers. */
  async options({ teamId, status } = {}) {
    if (!USE_MOCK) return api.get('/players/options', { teamId, status });
    await delay(120);
    const db = getDb();
    return clone(
      sortBy(
        db.players.filter((p) => (!teamId || p.team_id === teamId) && (!status || p.status === status)),
        'name',
      ).map((p) => ({ id: p.id, name: p.name, team_id: p.team_id, position: p.position, jersey_number: p.jersey_number, photo: p.photo, status: p.status })),
    );
  },

  async get(id) {
    if (!USE_MOCK) return api.get(`/players/${id}`);
    await delay();
    const db = getDb();
    const player = db.players.find((p) => p.id === id);
    if (!player) throw new ApiError('errors.notFound', { status: 404 });
    const team = db.teams.find((t) => t.id === player.team_id);
    const stats = computePlayerStats(db).find((s) => s.player_id === id);
    const attendanceRecords = attendanceRecordsInScope(db, { playerId: id }).sort((a, b) => b.session.date.localeCompare(a.session.date));
    const byId = Object.fromEntries(db.players.map((p) => [p.id, p]));
    const recentMatches = db.matches
      .filter((m) => m.status === 'completed' && m.lineups && (m.home_team_id === player.team_id || m.away_team_id === player.team_id))
      .sort((a, b) => b.date.localeCompare(a.date))
      .map((m) => ({ match: enrichMatch(db, m), line: matchPlayerLines(m, db.matchEvents, byId)[id] ?? null }))
      .filter((r) => r.line)
      .slice(0, 6);
    return clone({
      ...withTeam(db, player),
      coach: team ? coachSummary(db, team.coach_id) : null,
      statistics: stats,
      attendance: {
        ...summarizeAttendance(attendanceRecords),
        recent: attendanceRecords.slice(0, 8).map((r) => ({ id: r.id, status: r.status, notes: r.notes, date: r.session.date, training_type: r.session.training_type, session_id: r.session.id })),
      },
      recent_matches: recentMatches,
    });
  },

  async create(data) {
    if (!USE_MOCK) return api.post('/players', data);
    await delay(450);
    const db = getDb();
    const values = pick(data);
    validateUnique(db, values);
    const created = nowIso();
    const userId = uid('u');
    const player = { id: uid('p'), user_id: userId, registration_date: todayISO(), photo: null, ...values };
    db.users.unshift({
      id: userId, name: player.name, email: player.email, phone: player.phone, role: 'player', status: player.status,
      avatar: player.photo, created_at: created, updated_at: created, last_login_at: null,
    });
    db.players.unshift(player);
    notifyAdmins(db, { type: 'account_update', template: 'player_registered', params: { name: player.name, team: teamSummary(db, player.team_id)?.name ?? '—' }, link: `/admin/players/${player.id}` });
    commit();
    return clone(withTeam(db, player));
  },

  async update(id, data) {
    if (!USE_MOCK) return api.put(`/players/${id}`, data);
    await delay(400);
    const db = getDb();
    const player = db.players.find((p) => p.id === id);
    if (!player) throw new ApiError('errors.notFound', { status: 404 });
    const values = pick(data);
    validateUnique(db, { ...player, ...values }, id);
    Object.assign(player, values);
    const user = db.users.find((u) => u.id === player.user_id);
    if (user) Object.assign(user, { name: player.name, email: player.email, phone: player.phone, status: player.status, avatar: player.photo, updated_at: nowIso() });
    commit();
    return clone(withTeam(db, player));
  },

  async setStatus(id, status) {
    return this.update(id, { status });
  },

  async assignTeam(id, teamId) {
    return this.update(id, { team_id: teamId || null });
  },

  async remove(id) {
    if (!USE_MOCK) return api.delete(`/players/${id}`);
    await delay(350);
    const db = getDb();
    const player = db.players.find((p) => p.id === id);
    if (!player) throw new ApiError('errors.notFound', { status: 404 });
    db.players = db.players.filter((p) => p.id !== id);
    db.users = db.users.filter((u) => u.id !== player.user_id);
    db.attendance = db.attendance.filter((a) => a.player_id !== id);
    commit();
    return { ok: true };
  },
};
