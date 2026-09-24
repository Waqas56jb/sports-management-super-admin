import { Link } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';
import { cn } from '@/utils/cn';

const TONES = {
  brand: 'bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-300',
  sky: 'bg-sky-50 text-sky-700 dark:bg-sky-500/10 dark:text-sky-300',
  amber: 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300',
  violet: 'bg-violet-50 text-violet-700 dark:bg-violet-500/10 dark:text-violet-300',
  rose: 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300',
  slate: 'bg-surface-3 text-ink-2',
};

/** KPI tile: label · value · supporting line. Becomes a link when `to` is set. */
export default function StatCard({ label, value, sub, icon: Icon, tone = 'brand', to, className, children }) {
  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-ink-2">{label}</p>
        {Icon && (
          <span className={cn('grid size-9 shrink-0 place-items-center rounded-lg', TONES[tone])}>
            <Icon className="size-[18px]" aria-hidden="true" />
          </span>
        )}
      </div>
      <p className="mt-2 font-display text-[32px] font-bold leading-none tracking-tight text-ink sm:text-[36px]">{value}</p>
      {sub && <p className="mt-2 flex items-center gap-1 text-xs text-ink-3">{sub}</p>}
      {children}
      {to && <ArrowUpRight className="absolute bottom-4 right-4 size-4 text-ink-3 opacity-0 transition-opacity group-hover:opacity-100" aria-hidden="true" />}
    </>
  );
  const classes = cn('card group relative block p-4 sm:p-5', to && 'transition-shadow hover:shadow-(--shadow-pop)', className);
  return to ? (
    <Link to={to} className={classes}>
      {body}
    </Link>
  ) : (
    <div className={classes}>{body}</div>
  );
}
