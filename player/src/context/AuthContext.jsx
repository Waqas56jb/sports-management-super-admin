import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { authService } from '@/services/authService';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(() => authService.getSession());
  const [expired, setExpired] = useState(false);

  // The API client (or the mock scope) raises auth:expired on 401 — drop the session and tell the user.
  useEffect(() => {
    const expire = () => {
      authService.logout();
      setExpired(true);
      setSession(null);
    };
    window.addEventListener('auth:expired', expire);
    return () => window.removeEventListener('auth:expired', expire);
  }, []);

  const login = useCallback(async (credentials) => {
    const next = await authService.login(credentials);
    setExpired(false);
    setSession(next);
    return next;
  }, []);

  const logout = useCallback(async () => {
    await authService.logout();
    setSession(null);
  }, []);

  /** Refresh the cached user after profile edits (name, phone, photo…). */
  const refreshUser = useCallback(() => setSession(authService.getSession()), []);

  const value = useMemo(
    () => ({
      session,
      user: session?.user ?? null,
      isAuthenticated: !!session?.token,
      expired,
      login,
      logout,
      refreshUser,
      changePassword: authService.changePassword,
    }),
    [session, expired, login, logout, refreshUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
