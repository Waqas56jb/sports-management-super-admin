import { api, ApiError, USE_MOCK } from './apiClient';
import { authStorage } from './authStorage';
import { clone, commit, delay, getDb, nowIso } from './mock/db';

/**
 * Mock credentials (development only). The real server verifies bcrypt hashes;
 * passwords never leave this module and are never stored in the session.
 */
const CREDS_KEY = 'shf.mockcreds';
const MOCK_PASSWORDS = new Map([
  ['admin@example.com', 'Admin@123'],
  ['f.ahmed@sporthub.dj', 'Admin@123'],
]);
try {
  Object.entries(JSON.parse(localStorage.getItem(CREDS_KEY) ?? '{}')).forEach(([k, v]) => MOCK_PASSWORDS.set(k, v));
} catch {
  /* ignore */
}
function persistCreds() {
  try {
    localStorage.setItem(CREDS_KEY, JSON.stringify(Object.fromEntries(MOCK_PASSWORDS)));
  } catch {
    /* ignore */
  }
}

const SESSION_HOURS = { remember: 24 * 30, session: 12 };

const publicUser = (u) => ({ id: u.id, name: u.name, email: u.email, phone: u.phone, role: u.role, avatar: u.avatar });

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
      const stored = MOCK_PASSWORDS.get(normalized);
      if (!user || !stored || stored !== password) throw new ApiError('auth.errors.invalidCredentials', { status: 401 });
      if (user.role !== 'admin') throw new ApiError('auth.errors.notAdmin', { status: 403 });
      if (user.status !== 'active') throw new ApiError('auth.errors.inactive', { status: 403 });
      user.last_login_at = nowIso();
      commit();
      const hours = remember ? SESSION_HOURS.remember : SESSION_HOURS.session;
      session = {
        user: publicUser(user),
        token: mockToken(user.id),
        expiresAt: new Date(Date.now() + hours * 3600000).toISOString(),
        signedInAt: nowIso(),
      };
    } else {
      const res = await api.post('/auth/login', { email, password, remember, portal: 'admin' });
      session = { ...res, signedInAt: nowIso() };
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

  async updateProfile(data) {
    let user;
    if (USE_MOCK) {
      await delay();
      const db = getDb();
      const session = authStorage.get();
      const record = db.users.find((u) => u.id === session?.user?.id);
      if (!record) throw new ApiError('errors.notFound', { status: 404 });
      const email = data.email.trim().toLowerCase();
      if (db.users.some((u) => u.id !== record.id && u.email.toLowerCase() === email)) {
        throw new ApiError('errors.emailTaken', { fields: { email: 'errors.emailTaken' } });
      }
      const previousEmail = record.email.toLowerCase();
      Object.assign(record, { name: data.name.trim(), email, phone: data.phone, avatar: data.avatar ?? record.avatar, updated_at: nowIso() });
      if (previousEmail !== email && MOCK_PASSWORDS.has(previousEmail)) {
        MOCK_PASSWORDS.set(email, MOCK_PASSWORDS.get(previousEmail));
        MOCK_PASSWORDS.delete(previousEmail);
        persistCreds();
      }
      commit();
      user = clone(publicUser(record));
    } else {
      user = await api.put('/auth/me', data);
    }
    authStorage.update({ user });
    return user;
  },

  async changePassword({ currentPassword, newPassword }) {
    if (!USE_MOCK) return api.post('/auth/change-password', { currentPassword, newPassword });
    await delay(500);
    const email = authStorage.get()?.user?.email?.toLowerCase();
    if (MOCK_PASSWORDS.get(email) !== currentPassword) {
      throw new ApiError('settings.security.wrongPassword', { fields: { currentPassword: 'settings.security.wrongPassword' } });
    }
    MOCK_PASSWORDS.set(email, newPassword);
    persistCreds();
    return { ok: true };
  },
};
