import { cn } from '@/utils/cn';

/** Horizontal meter. Colour carries severity; the track is a light step of the same hue. */
export function Meter({ value, max = 100, tone, className, label, size = 'md' }) {
  const pct = Math.max(0, Math.min(100, ((value ?? 0) / max) * 100));
  const auto = pct >= 85 ? 'good' : pct >= 70 ? 'warn' : 'bad';
  const t = tone ?? auto;
  const colors = {
    good: ['bg-emerald-500', 'bg-emerald-500/15'],
    warn: ['bg-amber-500', 'bg-amber-500/15'],
    bad: ['bg-red-500', 'bg-red-500/15'],
    brand: ['bg-brand-500', 'bg-brand-500/15'],
  }[t];
  return (
    <div
      role="meter"
      aria-valuenow={Math.round(value ?? 0)}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-label={label}
      className={cn('w-full overflow-hidden rounded-full', size === 'sm' ? 'h-1.5' : 'h-2', colors[1], className)}
    >
      <div className={cn('h-full rounded-full transition-[width] duration-500', colors[0])} style={{ width: `${pct}%` }} />
    </div>
  );
}

/** Label/value pairs for detail pages. items: [{ label, value, icon }] */
export function DescriptionList({ items, className, columns = 1 }) {
  return (
    <dl className={cn('grid gap-x-6 gap-y-4', columns === 2 && 'sm:grid-cols-2', className)}>
      {items.filter(Boolean).map(({ label, value, icon: Icon }) => (
        <div key={label} className="flex min-w-0 items-start gap-3">
          {Icon && (
            <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg bg-surface-3 text-ink-3">
              <Icon className="size-4" aria-hidden="true" />
            </span>
          )}
          <div className="min-w-0">
            <dt className="text-xs font-medium uppercase tracking-wide text-ink-3">{label}</dt>
            <dd className="mt-0.5 break-words text-sm text-ink">{value || '—'}</dd>
          </div>
        </div>
      ))}
    </dl>
  );
}

/** W / D / L pills for team form. */
export function FormGuide({ form = [], labels }) {
  const styles = {
    W: 'bg-emerald-500 text-white',
    D: 'bg-slate-400 text-white dark:bg-slate-500',
    L: 'bg-red-500 text-white',
  };
  return (
    <span className="inline-flex gap-1">
      {form.map((r, i) => (
        <span key={i} title={labels?.[r]} className={cn('grid size-5 place-items-center rounded text-[10px] font-bold', styles[r])}>
          {labels?.[`${r}short`] ?? r}
        </span>
      ))}
    </span>
  );
}
