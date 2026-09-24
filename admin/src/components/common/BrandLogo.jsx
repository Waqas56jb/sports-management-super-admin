import { useI18n } from '@/i18n';
import { APP_NAME } from '@/utils/constants';
import { cn } from '@/utils/cn';

export function BrandMark({ className }) {
  return (
    <svg viewBox="0 0 40 40" className={cn('size-9', className)} aria-hidden="true">
      <rect width="40" height="40" rx="11" fill="#079075" />
      <circle cx="20" cy="20" r="10.5" fill="none" stroke="#fff" strokeWidth="2.4" />
      <path d="M20 13.2 24.3 16.3 22.7 21.4H17.3L15.7 16.3Z" fill="#fff" />
      <path d="M20 13.2V9.6M24.3 16.3 27.9 15M22.7 21.4 25 24.7M17.3 21.4 15 24.7M15.7 16.3 12.1 15" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export default function BrandLogo({ className, inverted = false, compact = false }) {
  const { t } = useI18n();
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <BrandMark />
      {!compact && (
        <span className="leading-tight">
          <span className={cn('block font-display text-xl font-bold tracking-wide', inverted ? 'text-white' : 'text-ink')}>{APP_NAME}</span>
          <span className={cn('block text-[11px] font-medium uppercase tracking-[0.14em]', inverted ? 'text-white/60' : 'text-ink-3')}>{t('app.tagline')}</span>
        </span>
      )}
    </span>
  );
}
