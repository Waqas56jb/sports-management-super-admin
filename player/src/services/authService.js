import { api, ApiError, USE_MOCK } from './apiClient';
import { authStorage } from './authStorage';
import { clone, commit, delay, getDb, nowIso } from './mock/db';

/**
 * Mock credentials (development only). Every player account uses the demo password;
 * the primary demo login is player@example.com. The real server verifies password hashes.
 */
const DEMO_PASSWORD = 'Player@123';
const CREDS_KEY = 'shf.player.mockcreds';

function passwordOverrides() {
  try {
    return JSON.parse(localStorage.getItem(CREDS_KEY) ?? '{}');
  } catch {
    return {};
  }
}

function passwordFor(email) {
  return passwordOverrides()[email] ?? DEMO_PASSWORD;
}

function setPassword(email, password) {
  try {
    localStorage.setItem(CREDS_KEY, JSON.stringify({ ...passwordOverrides(), [email]: password }));
  } catch {
    /* ignore */
  }
}

const SESSION_HOURS = { remember: 24 * 30, session: 12 };

const publicUser = (u, player) => ({ id: u.id, player_id: player?.id ?? null, name: u.name, email: u.email, phone: u.phone, role: u.role, avatar: player?.photo ?? u.avatar });

function mockToken(userId) {
  return `mock.${btoa(`${userId}:${Date.now()}`)}.${Math.random().toString(36).slice(2)}`;
}

export const authService = {
  /** @returns {Promise<{ user, token, expiresAt }>} */
  async login({ email, password, remember }) {
    let session;
    if (USE_MOCK) {
      await delay(650);
      const db = getDb();
      const normalized = email.trim().toLowerCase();
      const user = db.users.find((u) => u.email.toLowerCase() === normalized);
      if (!user || passwordFor(normalized) !== password) throw new ApiError('auth.errors.invalidCredentials', { status: 401 });
      if (user.role !== 'player') throw new ApiError('auth.errors.notPlayer', { status: 403 });
      const player = db.players.find((pl) => pl.user_id === user.id);
      if (user.status !== 'active' || !player) throw new ApiError('auth.errors.inactive', { status: 403 });
      user.last_login_at = nowIso();
      commit();
      const hours = remember ? SESSION_HOURS.remember : SESSION_HOURS.session;
      session = {
        user: publicUser(user, player),
        token: mockToken(user.id),
        expiresAt: new Date(Date.now() + hours * 3600000).toISOString(),
        signedInAt: nowIso(),
        remember: !!remember,
      };
    } else {
      const res = await api.post('/auth/login', { email, password, remember, portal: 'player' });
      session = { ...res, signedInAt: nowIso(), remember: !!remember };
    }
    authStorage.set(session, remember);
    return session;
  },

  async logout() {
    if (!USE_MOCK && authStorage.getToken()) {
      try {
        await api.post('/auth/logout');
      } catch {
        /* the local session is cleared regardless */
      }
    }
    authStorage.clear();
  },

  getSession() {
    return authStorage.get();
  },

  /** Always resolves the same way so the endpoint cannot be used to discover accounts. */
  async requestPasswordReset(email) {
    if (!USE_MOCK) return api.post('/auth/forgot-password', { email });
    await delay(700);
    return { ok: true };
  },

  /** Keeps the cached session user in sync after a profile change. */
  syncUser(patch) {
    const session = authStorage.get();
    if (!session) return null;
    const user = { ...session.user, ...patch };
    authStorage.update({ user });
    return clone(user);
  },

  async changePassword({ currentPassword, newPassword }) {
    if (!USE_MOCK) return api.post('/auth/change-password', { currentPassword, newPassword });
    await delay(500);
    const email = authStorage.get()?.user?.email?.toLowerCase();
    if (passwordFor(email) !== currentPassword) {
      throw new ApiError('settings.security.wrongPassword', { fields: { currentPassword: 'settings.security.wrongPassword' } });
    }
    setPassword(email, newPassword);
    return { ok: true };
  },
};
