import { AlertOctagon, RefreshCw, SearchX } from 'lucide-react';
import { useErrorMessage, useI18n } from '@/i18n';
import { cn } from '@/utils/cn';
import Button from './Button';

/** Friendly empty state with icon, message and optional action. */
export function EmptyState({ icon: Icon = SearchX, title, description, action, className, compact = false }) {
  return (
    <div className={cn('flex flex-col items-center justify-center text-center', compact ? 'px-4 py-8' : 'px-6 py-14', className)}>
      <div className="relative">
        <div className="absolute inset-0 -m-3 rounded-full bg-brand-500/5" aria-hidden="true" />
        <span className={cn('relative grid place-items-center rounded-2xl border border-line bg-surface-2 text-ink-3 shadow-sm', compact ? 'size-11' : 'size-14')}>
          <Icon className={compact ? 'size-5' : 'size-6'} aria-hidden="true" />
        </span>
      </div>
      <h3 className={cn('font-semibold text-ink', compact ? 'mt-4 text-sm' : 'mt-5 text-base')}>{title}</h3>
      {description && <p className="mt-1.5 max-w-sm text-sm text-ink-3">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

/** Inline error block for failed requests, with retry. */
export function ErrorState({ error, onRetry, title, className, compact }) {
  const { t } = useI18n();
  const errorMessage = useErrorMessage();
  return (
    <div role="alert" className={cn('flex flex-col items-center justify-center text-center', compact ? 'px-4 py-8' : 'px-6 py-14', className)}>
      <span className="grid size-14 place-items-center rounded-2xl bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400">
        <AlertOctagon className="size-6" aria-hidden="true" />
      </span>
      <h3 className="mt-5 text-base font-semibold text-ink">{title ?? t('errors.loadFailed')}</h3>
      <p className="mt-1.5 max-w-sm text-sm text-ink-3">{error?.code ? errorMessage(error) : t('errors.generic')}</p>
      {onRetry && (
        <Button variant="secondary" icon={RefreshCw} onClick={onRetry} className="mt-5">
          {t('common.retry')}
        </Button>
      )}
    </div>
  );
}
