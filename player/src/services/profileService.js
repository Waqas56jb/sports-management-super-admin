import { api, ApiError, USE_MOCK } from './apiClient';
import { authService } from './authService';
import { clone, commit, delay, getDb, nowIso } from './mock/db';
import { currentPlayer } from './mock/scope';

/** Fields a player may change themselves. Team, number, position, statistics and status stay with the club. */
const EDITABLE = ['email', 'phone', 'address', 'photo', 'emergency_contact_name', 'emergency_contact_phone', 'emergency_contact_relation'];

export const profileService = {
  async update(data) {
    if (!USE_MOCK) {
      const profile = await api.patch('/player/me/profile', data);
      authService.syncUser({ email: profile.email, phone: profile.phone, avatar: profile.photo });
      return profile;
    }
    await delay(500);
    const db = getDb();
    const p = currentPlayer(db);
    const user = db.users.find((u) => u.id === p.user_id);
    const patch = {};
    EDITABLE.forEach((k) => {
      if (data[k] !== undefined) patch[k] = typeof data[k] === 'string' ? data[k].trim() : data[k];
    });
    if (patch.email) {
      patch.email = patch.email.toLowerCase();
      if (db.users.some((u) => u.id !== user.id && u.email.toLowerCase() === patch.email)) {
        throw new ApiError('errors.emailTaken', { fields: { email: 'errors.emailTaken' } });
      }
    }
    Object.assign(p, patch);
    Object.assign(user, { email: p.email, phone: p.phone, avatar: p.photo, updated_at: nowIso() });
    commit();
    authService.syncUser({ email: p.email, phone: p.phone, avatar: p.photo });
    return clone(p);
  },
};
