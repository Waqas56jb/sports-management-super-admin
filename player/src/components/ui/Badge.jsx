import { useI18n } from '@/i18n';
import { STATUS_TONES } from '@/utils/constants';
import { cn } from '@/utils/cn';

const TONES = {
  neutral: 'bg-surface-3 text-ink-2 ring-line-strong/60',
  success: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-400/25',
  warning: 'bg-amber-50 text-amber-800 ring-amber-600/25 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-400/25',
  danger: 'bg-red-50 text-red-700 ring-red-600/20 dark:bg-red-500/10 dark:text-red-300 dark:ring-red-400/25',
  info: 'bg-sky-50 text-sky-700 ring-sky-600/20 dark:bg-sky-500/10 dark:text-sky-300 dark:ring-sky-400/25',
  brand: 'bg-brand-50 text-brand-700 ring-brand-600/20 dark:bg-brand-500/10 dark:text-brand-300 dark:ring-brand-400/25',
  live: 'bg-red-600 text-white ring-red-600 dark:bg-red-500 dark:ring-red-500',
};

const DOTS = {
  neutral: 'bg-ink-3',
  success: 'bg-emerald-500',
  warning: 'bg-amber-500',
  danger: 'bg-red-500',
  info: 'bg-sky-500',
  brand: 'bg-brand-500',
  live: 'bg-white',
};

export default function Badge({ tone = 'neutral', dot = false, className, children }) {
  return (
    <span
      className={cn(
        'inline-flex h-6 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 text-xs font-medium ring-1 ring-inset',
        TONES[tone],
        className,
      )}
    >
      {dot && <span className={cn('size-1.5 rounded-full', DOTS[tone], tone === 'live' && 'animate-pulse')} aria-hidden="true" />}
      {children}
    </span>
  );
}

/** Translated status pill: <StatusBadge value="active" /> */
export function StatusBadge({ value, className }) {
  const { t } = useI18n();
  if (!value) return null;
  const tone = STATUS_TONES[value] ?? 'neutral';
  return (
    <Badge tone={tone} dot className={className}>
      {t(`status.${value}`)}
    </Badge>
  );
}
