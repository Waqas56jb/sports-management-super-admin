import { todayISO } from '@/utils/format';
import { api, ApiError, USE_MOCK } from './apiClient';
import { clone, commit, delay, getDb, nowIso, uid } from './mock/db';
import { matchesSearch, paginate, sortBy } from './mock/query';
import { coachSummary, enrichMatch, enrichSession } from './mock/relations';
import { attendanceRecordsInScope, computePlayerStats, computeTeamRecords, summarizeAttendance } from './mock/statsEngine';

const FIELDS = ['name', 'short_name', 'logo', 'category', 'age_group', 'gender', 'coach_id', 'description', 'home_ground', 'founded', 'status'];

function pick(data) {
  const out = {};
  FIELDS.forEach((f) => {
    if (data[f] !== undefined) out[f] = typeof data[f] === 'string' ? data[f].trim() : data[f];
  });
  if (out.coach_id === '') out.coach_id = null;
  if (out.short_name) out.short_name = out.short_name.toUpperCase();
  if (out.founded !== undefined) out.founded = out.founded ? Number(out.founded) : null;
  return out;
}

function assignCoach(db, team, coachId) {
  const previous = db.coaches.find((c) => c.id === team.coach_id);
  if (previous && previous.id !== coachId) previous.team_id = null;
  if (coachId) {
    const coach = db.coaches.find((c) => c.id === coachId);
    if (coach) {
      db.teams.forEach((t) => {
        if (t.id !== team.id && t.coach_id === coachId) t.coach_id = null;
      });
      coach.team_id = team.id;
    }
  }
  team.coach_id = coachId || null;
}

function uniqueName(db, name, exceptId) {
  if (db.teams.some((t) => t.id !== exceptId && t.name.toLowerCase() === name.toLowerCase())) {
    throw new ApiError('teams.errors.nameTaken', { fields: { name: 'teams.errors.nameTaken' } });
  }
}

export const teamService = {
  async list({ search, status, category, page, pageSize = 'all', sort = 'name', dir = 'asc' } = {}) {
    if (!USE_MOCK) return api.get('/teams', { search, status, category, page, pageSize, sort, dir });
    await delay();
    const db = getDb();
    const records = Object.fromEntries(computeTeamRecords(db).map((r) => [r.team_id, r]));
    const rows = db.teams
      .filter((t) => (!status || t.status === status) && (!category || t.category === category) && matchesSearch(search, t.name, t.short_name))
      .map((t) => {
        const roster = db.players.filter((p) => p.team_id === t.id);
        return {
          ...t,
          coach: coachSummary(db, t.coach_id),
          players_count: roster.length,
          active_players: roster.filter((p) => p.status === 'active').length,
          record: records[t.id],
          attendance_rate: summarizeAttendance(attendanceRecordsInScope(db, { teamId: t.id })).rate,
        };
      });
    return clone(paginate(sortBy(rows, sort, dir), { page, pageSize }));
  },

  async options() {
    if (!USE_MOCK) return api.get('/teams/options');
    await delay(100);
    return clone(sortBy(getDb().teams, 'name').map((t) => ({ id: t.id, name: t.name, short_name: t.short_name, color: t.color, logo: t.logo, status: t.status })));
  },

  async get(id) {
    if (!USE_MOCK) return api.get(`/teams/${id}`);
    await delay();
    const db = getDb();
    const team = db.teams.find((t) => t.id === id);
    if (!team) throw new ApiError('errors.notFound', { status: 404 });
    const today = todayISO();
    const stats = Object.fromEntries(computePlayerStats(db).map((s) => [s.player_id, s]));
    const roster = sortBy(db.players.filter((p) => p.team_id === id), 'jersey_number').map((p) => ({ ...p, statistics: stats[p.id] }));
    const teamMatches = db.matches.filter((m) => m.home_team_id === id || m.away_team_id === id);
    const sessions = db.trainingSessions.filter((s) => s.team_id === id);
    return clone({
      ...team,
      coach: team.coach_id ? db.coaches.find((c) => c.id === team.coach_id) ?? null : null,
      roster,
      record: computeTeamRecords(db).find((r) => r.team_id === id),
      attendance: summarizeAttendance(attendanceRecordsInScope(db, { teamId: id })),
      recent_matches: sortBy(teamMatches.filter((m) => m.status === 'completed'), 'date', 'desc').slice(0, 5).map((m) => enrichMatch(db, m)),
      upcoming_matches: sortBy(teamMatches.filter((m) => m.status === 'scheduled' || m.status === 'live'), 'date').slice(0, 5).map((m) => enrichMatch(db, m)),
      upcoming_sessions: sortBy(sessions.filter((s) => s.date >= today), 'date').slice(0, 5).map((s) => enrichSession(db, s)),
      recent_sessions: sortBy(sessions.filter((s) => s.date < today), 'date', 'desc').slice(0, 5).map((s) => enrichSession(db, s)),
    });
  },

  async create(data) {
    if (!USE_MOCK) return api.post('/teams', data);
    await delay(450);
    const db = getDb();
    const values = pick(data);
    uniqueName(db, values.name);
    const usedColors = new Set(db.teams.map((t) => t.color));
    const color = [0, 1, 2, 3, 4, 5].find((c) => !usedColors.has(c)) ?? db.teams.length % 6;
    const team = { id: uid('t'), color, logo: null, created_at: nowIso(), ...values, coach_id: null };
    db.teams.push(team);
    assignCoach(db, team, values.coach_id);
    commit();
    return clone(team);
  },

  async update(id, data) {
    if (!USE_MOCK) return api.put(`/teams/${id}`, data);
    await delay(400);
    const db = getDb();
    const team = db.teams.find((t) => t.id === id);
    if (!team) throw new ApiError('errors.notFound', { status: 404 });
    const values = pick(data);
    if (values.name) uniqueName(db, values.name, id);
    const { coach_id: coachId, ...rest } = values;
    Object.assign(team, rest);
    if (coachId !== undefined) assignCoach(db, team, coachId);
    commit();
    return clone(team);
  },

  async assignCoach(id, coachId) {
    return this.update(id, { coach_id: coachId || null });
  },

  async addPlayers(id, playerIds) {
    if (!USE_MOCK) return api.post(`/teams/${id}/players`, { playerIds });
    await delay(350);
    const db = getDb();
    if (!db.teams.some((t) => t.id === id)) throw new ApiError('errors.notFound', { status: 404 });
    const taken = new Set(db.players.filter((p) => p.team_id === id).map((p) => p.jersey_number));
    db.players.forEach((p) => {
      if (!playerIds.includes(p.id)) return;
      p.team_id = id;
      if (p.jersey_number && taken.has(p.jersey_number)) p.jersey_number = null;
      if (p.jersey_number) taken.add(p.jersey_number);
    });
    commit();
    return { ok: true };
  },

  async removePlayer(id, playerId) {
    if (!USE_MOCK) return api.delete(`/teams/${id}/players/${playerId}`);
    await delay(300);
    const player = getDb().players.find((p) => p.id === playerId && p.team_id === id);
    if (!player) throw new ApiError('errors.notFound', { status: 404 });
    player.team_id = null;
    commit();
    return { ok: true };
  },

  /** Teams that already have fixtures cannot be deleted — deactivate them instead. */
  async remove(id) {
    if (!USE_MOCK) return api.delete(`/teams/${id}`);
    await delay(350);
    const db = getDb();
    if (db.matches.some((m) => m.home_team_id === id || m.away_team_id === id)) {
      throw new ApiError('teams.errors.hasMatches', { status: 409 });
    }
    db.players.forEach((p) => {
      if (p.team_id === id) p.team_id = null;
    });
    db.coaches.forEach((c) => {
      if (c.team_id === id) c.team_id = null;
    });
    const sessionIds = new Set(db.trainingSessions.filter((s) => s.team_id === id).map((s) => s.id));
    db.trainingSessions = db.trainingSessions.filter((s) => s.team_id !== id);
    db.attendance = db.attendance.filter((a) => !sessionIds.has(a.training_session_id));
    db.competitions.forEach((c) => {
      c.team_ids = c.team_ids.filter((t) => t !== id);
    });
    db.teams = db.teams.filter((t) => t.id !== id);
    commit();
    return { ok: true };
  },
};
