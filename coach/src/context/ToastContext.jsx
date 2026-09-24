import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { CheckCircle2, Info, TriangleAlert, X, XCircle } from 'lucide-react';
import { useI18n } from '@/i18n';
import { cn } from '@/utils/cn';

const ToastContext = createContext(null);

const ICONS = {
  success: [CheckCircle2, 'text-emerald-600 dark:text-emerald-400'],
  error: [XCircle, 'text-red-600 dark:text-red-400'],
  warning: [TriangleAlert, 'text-amber-600 dark:text-amber-400'],
  info: [Info, 'text-sky-600 dark:text-sky-400'],
};

export function ToastProvider({ children }) {
  const { t } = useI18n();
  const [toasts, setToasts] = useState([]);
  const timers = useRef({});

  const dismiss = useCallback((id) => {
    setToasts((list) => list.filter((x) => x.id !== id));
    clearTimeout(timers.current[id]);
    delete timers.current[id];
  }, []);

  const push = useCallback(
    (tone, title, description) => {
      const id = `${Date.now()}${Math.random()}`;
      setToasts((list) => [...list.slice(-3), { id, tone, title, description }]);
      timers.current[id] = setTimeout(() => dismiss(id), tone === 'error' ? 6500 : 4000);
      return id;
    },
    [dismiss],
  );

  const api = useMemo(
    () => ({
      success: (title, description) => push('success', title, description),
      error: (title, description) => push('error', title, description),
      warning: (title, description) => push('warning', title, description),
      info: (title, description) => push('info', title, description),
      dismiss,
    }),
    [push, dismiss],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        aria-live="polite"
        aria-atomic="false"
        className="pointer-events-none fixed inset-x-0 top-[max(0.75rem,env(safe-area-inset-top))] z-[100] flex flex-col items-center gap-2 px-4 sm:inset-x-auto sm:right-4 sm:top-4 sm:items-end"
      >
        {toasts.map((toast) => {
          const [Icon, color] = ICONS[toast.tone];
          return (
            <div
              key={toast.id}
              role={toast.tone === 'error' ? 'alert' : 'status'}
              className="pointer-events-auto flex w-full max-w-sm animate-toast-in items-start gap-3 glass rounded-2xl border border-line/80 p-3.5 pr-2 shadow-(--shadow-pop)"
            >
              <Icon className={cn('mt-0.5 size-5 shrink-0', color)} aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-ink">{toast.title}</p>
                {toast.description && <p className="mt-0.5 text-sm text-ink-2">{toast.description}</p>}
              </div>
              <button
                type="button"
                onClick={() => dismiss(toast.id)}
                className="grid size-8 shrink-0 place-items-center rounded-lg text-ink-3 hover:bg-surface-3 hover:text-ink"
                aria-label={t('common.dismiss')}
              >
                <X className="size-4" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
}
