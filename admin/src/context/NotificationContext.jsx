import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { notificationService } from '@/services/notificationService';
import { on } from '@/services/events';
import { useAuth } from './AuthContext';

const NotificationContext = createContext(null);

/** Shares the unread count between the top-bar bell, sidebar badge and notifications page. */
export function NotificationProvider({ children }) {
  const { isAuthenticated } = useAuth();
  const [unread, setUnread] = useState(0);
  const [version, setVersion] = useState(0);

  const refresh = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      setUnread(await notificationService.unreadCount());
    } catch {
      /* non-critical */
    }
  }, [isAuthenticated]);

  useEffect(() => {
    refresh();
    const off = on('notifications:changed', () => {
      refresh();
      setVersion((v) => v + 1);
    });
    const interval = setInterval(refresh, 60000);
    return () => {
      off();
      clearInterval(interval);
    };
  }, [refresh]);

  const value = useMemo(() => ({ unread, refresh, version }), [unread, refresh, version]);
  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
}

export function useNotifications() {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error('useNotifications must be used inside <NotificationProvider>');
  return ctx;
}
