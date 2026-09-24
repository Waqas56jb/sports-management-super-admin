import { cn } from '@/utils/cn';

/** Compact statistic tile used on profile pages. */
export default function MiniStat({ label, value, icon: Icon, accent, className }) {
  return (
    <div className={cn('rounded-xl border border-line bg-surface-2/60 p-3.5', className)}>
      <div className="flex items-center gap-1.5 text-xs font-medium text-ink-3">
        {Icon && <Icon className={cn('size-3.5', accent)} aria-hidden="true" />}
        <span className="truncate">{label}</span>
      </div>
      <p className="mt-1.5 font-display text-[28px] font-bold leading-none text-ink tabular">{value}</p>
    </div>
  );
}
