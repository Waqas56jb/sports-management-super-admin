import { api, USE_MOCK } from './apiClient';
import { authStorage } from './authStorage';
import { emit } from './events';
import { clone, commit, delay, getDb } from './mock/db';
import { paginate } from './mock/query';

const currentUserId = () => authStorage.get()?.user?.id;

/** Filter chips on the notifications page map to notification types. */
export const CATEGORIES = {
  matches: ['match_reminder', 'match_result'],
  training: ['training_reminder', 'attendance_update'],
  team: ['team_announcement', 'competition_update'],
  system: ['system'],
};

export const DEFAULT_PREFERENCES = { match_reminders: true, training_reminders: true, team_announcements: true, system_notifications: false };

export const notificationService = {
  async list({ status, type, category, page, pageSize } = {}) {
    if (!USE_MOCK) return api.get('/player/notifications', { status, type, category, page, pageSize });
    await delay();
    const uidNow = currentUserId();
    const rows = getDb()
      .notifications.filter(
        (n) =>
          n.user_id === uidNow &&
          (!type || n.type === type) &&
          (!category || (CATEGORIES[category] ?? []).includes(n.type)) &&
          (!status || (status === 'unread' ? !n.is_read : n.is_read)),
      )
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
    return clone(paginate(rows, { page, pageSize }));
  },

  async unreadCount() {
    if (!USE_MOCK) return (await api.get('/player/notifications/unread-count')).count;
    await delay(60);
    const uidNow = currentUserId();
    return getDb().notifications.filter((n) => n.user_id === uidNow && !n.is_read).length;
  },

  async markRead(id, isRead = true) {
    if (!USE_MOCK) {
      await api.patch(`/player/notifications/${id}`, { is_read: isRead });
    } else {
      await delay(120);
      const n = getDb().notifications.find((x) => x.id === id);
      if (n) n.is_read = isRead;
      commit();
    }
    emit('notifications:changed');
  },

  async markAllRead() {
    if (!USE_MOCK) {
      await api.post('/player/notifications/mark-all-read');
    } else {
      await delay(250);
      const uidNow = currentUserId();
      getDb().notifications.forEach((n) => {
        if (n.user_id === uidNow) n.is_read = true;
      });
      commit();
    }
    emit('notifications:changed');
  },

  async remove(id) {
    if (!USE_MOCK) {
      await api.delete(`/player/notifications/${id}`);
    } else {
      await delay(200);
      const db = getDb();
      db.notifications = db.notifications.filter((n) => n.id !== id);
      commit();
    }
    emit('notifications:changed');
  },

  /** Which notifications the player wants to receive (PATCH /player/notification-preferences). */
  async getPreferences() {
    if (!USE_MOCK) return api.get('/player/notification-preferences');
    await delay(120);
    const db = getDb();
    return { ...DEFAULT_PREFERENCES, ...(db.preferences?.[currentUserId()] ?? {}) };
  },

  async updatePreferences(patch) {
    if (!USE_MOCK) return api.patch('/player/notification-preferences', patch);
    await delay(250);
    const db = getDb();
    db.preferences = db.preferences ?? {};
    db.preferences[currentUserId()] = { ...DEFAULT_PREFERENCES, ...(db.preferences[currentUserId()] ?? {}), ...patch };
    commit();
    return { ...db.preferences[currentUserId()] };
  },
};
