import { api, ApiError, USE_MOCK } from './apiClient';
import { authService } from './authService';
import { clone, commit, delay, getDb, nowIso } from './mock/db';
import { teamSummary } from './mock/relations';
import { currentCoach } from './mock/scope';

function profileOf(db, coach) {
  const user = db.users.find((u) => u.id === coach.user_id);
  return {
    id: coach.id,
    user_id: coach.user_id,
    name: coach.name,
    email: coach.email,
    phone: coach.phone,
    photo: coach.photo,
    gender: coach.gender,
    license: coach.license,
    experience: coach.experience,
    status: coach.status,
    account_status: user?.status ?? coach.status,
    member_since: coach.created_at,
    last_login_at: user?.last_login_at ?? null,
    teams: coach.team_ids.map((id) => {
      const summary = teamSummary(db, id);
      const team = db.teams.find((t) => t.id === id);
      return summary && { ...summary, category: team.category, age_group: team.age_group, players_count: db.players.filter((p) => p.team_id === id).length };
    }).filter(Boolean),
  };
}

export const profileService = {
  async get() {
    if (!USE_MOCK) return api.get('/coach/me');
    await delay();
    const db = getDb();
    return clone(profileOf(db, currentCoach(db)));
  },

  /** Name, phone, photo (profile page) and email (account settings). */
  async update(data) {
    if (!USE_MOCK) return api.put('/coach/me', data);
    await delay(450);
    const db = getDb();
    const coach = currentCoach(db);
    const user = db.users.find((u) => u.id === coach.user_id);
    const patch = {};
    if (data.name !== undefined) patch.name = data.name.trim();
    if (data.phone !== undefined) patch.phone = data.phone.trim();
    if (data.photo !== undefined) patch.photo = data.photo;
    if (data.email !== undefined) {
      const email = data.email.trim().toLowerCase();
      if (db.users.some((u) => u.id !== user.id && u.email.toLowerCase() === email)) {
        throw new ApiError('errors.emailTaken', { fields: { email: 'errors.emailTaken' } });
      }
      patch.email = email;
    }
    Object.assign(coach, patch);
    Object.assign(user, { name: coach.name, email: coach.email, phone: coach.phone, avatar: coach.photo, updated_at: nowIso() });
    commit();
    authService.syncUser({ name: coach.name, email: coach.email, phone: coach.phone, avatar: coach.photo });
    return clone(profileOf(db, coach));
  },
};
