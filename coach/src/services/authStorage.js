/**
 * Session persistence. "Remember me" keeps the session in localStorage;
 * otherwise it lives in sessionStorage and ends when the browser closes.
 */
const KEY = 'shf.coach.session';

function read(storage) {
  try {
    const raw = storage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export const authStorage = {
  get() {
    const session = read(localStorage) ?? read(sessionStorage);
    if (session?.expiresAt && Date.parse(session.expiresAt) < Date.now()) {
      this.clear();
      return null;
    }
    return session;
  },
  getToken() {
    return this.get()?.token ?? null;
  },
  set(session, remember) {
    this.clear();
    try {
      (remember ? localStorage : sessionStorage).setItem(KEY, JSON.stringify(session));
    } catch {
      /* ignore */
    }
  },
  update(patch) {
    const current = this.get();
    if (!current) return;
    const remember = !!read(localStorage);
    this.set({ ...current, ...patch }, remember);
  },
  clear() {
    try {
      localStorage.removeItem(KEY);
      sessionStorage.removeItem(KEY);
    } catch {
      /* ignore */
    }
  },
};
