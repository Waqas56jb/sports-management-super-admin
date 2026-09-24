import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Bell, BellOff, CheckCheck } from 'lucide-react';
import NotificationIcon from '@/components/common/NotificationIcon';
import { useNotificationText } from '@/components/common/useNotificationText';
import { Skeleton } from '@/components/ui/Skeleton';
import { useNotifications } from '@/context/NotificationContext';
import { useI18n } from '@/i18n';
import { notificationService } from '@/services/notificationService';
import { formatRelative } from '@/utils/format';
import { cn } from '@/utils/cn';

/** Top-bar bell with unread count and a quick panel of the latest notifications. */
export default function NotificationBell() {
  const { t, lang } = useI18n();
  const { unread, version } = useNotifications();
  const text = useNotificationText();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState(null);
  const wrapRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    notificationService.list({ pageSize: 6 }).then((r) => setItems(r.data));
  }, [open, version]);

  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => !wrapRef.current?.contains(e.target) && setOpen(false);
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const openItem = async (n) => {
    setOpen(false);
    if (!n.is_read) await notificationService.markRead(n.id);
    navigate(n.link || '/coach/notifications');
  };

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={unread ? t('notifications.bellLabelUnread', { count: unread }) : t('notifications.bellLabel')}
        className="relative grid size-10 place-items-center rounded-xl text-ink-2 hover:bg-surface-3 hover:text-ink"
      >
        <Bell className="size-[18px]" />
        {unread > 0 && (
          <span className="absolute right-1 top-1 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white ring-2 ring-surface tabular" aria-hidden="true">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label={t('nav.notifications')}
          className="fixed inset-x-2 top-[4.25rem] z-50 animate-fade-in overflow-hidden rounded-2xl border border-line bg-surface shadow-(--shadow-pop) sm:absolute sm:inset-x-auto sm:right-0 sm:top-12 sm:w-96"
        >
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-ink">{t('nav.notifications')}</p>
              <p className="text-xs text-ink-3">{t('notifications.unreadCount', { count: unread })}</p>
            </div>
            {unread > 0 && (
              <button
                type="button"
                onClick={() => notificationService.markAllRead()}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium text-brand-700 hover:bg-brand-50 dark:text-brand-300 dark:hover:bg-brand-500/10"
              >
                <CheckCheck className="size-4" aria-hidden="true" />
                {t('notifications.markAllRead')}
              </button>
            )}
          </div>
          <div className="max-h-[60vh] overflow-y-auto scrollbar-thin">
            {!items ? (
              <div className="space-y-3 p-4">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="flex gap-3">
                    <Skeleton className="size-10 rounded-xl" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-3.5 w-2/3" />
                      <Skeleton className="h-3 w-full" />
                    </div>
                  </div>
                ))}
              </div>
            ) : items.length === 0 ? (
              <div className="flex flex-col items-center px-6 py-10 text-center">
                <BellOff className="size-7 text-ink-3" aria-hidden="true" />
                <p className="mt-3 text-sm font-medium text-ink">{t('notifications.empty.title')}</p>
              </div>
            ) : (
              <ul>
                {items.map((n) => {
                  const { title, message } = text(n);
                  return (
                    <li key={n.id}>
                      <button type="button" onClick={() => openItem(n)} className={cn('flex w-full gap-3 border-b border-line px-4 py-3 text-left last:border-0 hover:bg-surface-2', !n.is_read && 'bg-brand-50/40 dark:bg-brand-500/[0.04]')}>
                        <NotificationIcon type={n.type} />
                        <span className="min-w-0 flex-1">
                          <span className="flex items-start gap-2">
                            <span className={cn('flex-1 text-sm leading-snug', n.is_read ? 'text-ink-2' : 'font-semibold text-ink')}>{title}</span>
                            {!n.is_read && <span className="mt-1.5 size-2 shrink-0 rounded-full bg-brand-500" aria-label={t('notifications.unread')} />}
                          </span>
                          <span className="mt-0.5 line-clamp-2 block text-xs text-ink-3">{message}</span>
                          <span className="mt-1 block text-[11px] text-ink-3">{formatRelative(n.created_at, lang)}</span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
          <Link to="/coach/notifications" onClick={() => setOpen(false)} className="block border-t border-line py-3 text-center text-sm font-medium text-brand-700 hover:bg-surface-2 dark:text-brand-300">
            {t('notifications.viewAll')}
          </Link>
        </div>
      )}
    </div>
  );
}
