import { useI18n } from '@/i18n';
import { cn } from '@/utils/cn';

export function Skeleton({ className, style }) {
  return <div className={cn('animate-pulse rounded-md bg-surface-3', className)} style={style} aria-hidden="true" />;
}

export function CardSkeleton({ className, lines = 3 }) {
  return (
    <div className={cn('card p-5', className)} aria-hidden="true">
      <Skeleton className="h-4 w-1/3" />
      <div className="mt-4 space-y-3">
        {Array.from({ length: lines }, (_, i) => (
          <Skeleton key={i} className={cn('h-3', i % 2 ? 'w-4/6' : 'w-full')} />
        ))}
      </div>
    </div>
  );
}

export function StatSkeleton() {
  return (
    <div className="card p-4 sm:p-5" aria-hidden="true">
      <div className="flex items-center justify-between">
        <Skeleton className="h-3.5 w-24" />
        <Skeleton className="size-9 rounded-lg" />
      </div>
      <Skeleton className="mt-4 h-8 w-16" />
      <Skeleton className="mt-3 h-3 w-28" />
    </div>
  );
}

export function TableSkeleton({ rows = 6, columns = 5 }) {
  return (
    <div aria-hidden="true">
      <div className="hidden md:block">
        <div className="flex gap-4 border-b border-line px-5 py-3">
          {Array.from({ length: columns }, (_, i) => (
            <Skeleton key={i} className="h-3 flex-1" />
          ))}
        </div>
        {Array.from({ length: rows }, (_, r) => (
          <div key={r} className="flex items-center gap-4 border-b border-line px-5 py-4 last:border-0">
            <Skeleton className="size-9 shrink-0 rounded-full" />
            {Array.from({ length: columns - 1 }, (_, i) => (
              <Skeleton key={i} className={cn('h-3 flex-1', i === 0 && 'max-w-48')} />
            ))}
          </div>
        ))}
      </div>
      <div className="space-y-3 p-3 md:hidden">
        {Array.from({ length: Math.min(rows, 4) }, (_, r) => (
          <div key={r} className="flex items-center gap-3 rounded-xl border border-line p-3">
            <Skeleton className="size-10 shrink-0 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-3.5 w-2/3" />
              <Skeleton className="h-3 w-1/3" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ChartSkeleton({ height = 260 }) {
  return (
    <div className="flex items-end gap-3 px-2" style={{ height }} aria-hidden="true">
      {[55, 80, 40, 95, 65, 75, 50, 85].map((h, i) => (
        <Skeleton key={i} className="flex-1 rounded-b-none" style={{ height: `${h}%` }} />
      ))}
    </div>
  );
}

/** Full-page placeholder used by lazy routes and detail pages. */
export function PageSkeleton({ variant = 'list' }) {
  const { t } = useI18n();
  return (
    <div className="space-y-6" role="status" aria-live="polite">
      <span className="sr-only">{t('common.loading')}</span>
      <div className="space-y-2">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-72 max-w-full" />
      </div>
      {variant === 'detail' ? (
        <div className="grid gap-6 lg:grid-cols-3">
          <CardSkeleton lines={6} />
          <div className="space-y-6 lg:col-span-2">
            <CardSkeleton lines={4} />
            <CardSkeleton lines={4} />
          </div>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            {Array.from({ length: 4 }, (_, i) => (
              <StatSkeleton key={i} />
            ))}
          </div>
          <div className="card">
            <TableSkeleton />
          </div>
        </>
      )}
    </div>
  );
}
