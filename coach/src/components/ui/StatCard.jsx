import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';
import { cn } from '@/utils/cn';

const TONES = {
  brand: 'bg-brand-50 text-brand-700 ring-brand-600/10 dark:bg-brand-500/10 dark:text-brand-300 dark:ring-brand-400/15',
  sky: 'bg-sky-50 text-sky-700 ring-sky-600/10 dark:bg-sky-500/10 dark:text-sky-300 dark:ring-sky-400/15',
  amber: 'bg-amber-50 text-amber-700 ring-amber-600/10 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-400/15',
  violet: 'bg-violet-50 text-violet-700 ring-violet-600/10 dark:bg-violet-500/10 dark:text-violet-300 dark:ring-violet-400/15',
  rose: 'bg-rose-50 text-rose-700 ring-rose-600/10 dark:bg-rose-500/10 dark:text-rose-300 dark:ring-rose-400/15',
  slate: 'bg-surface-3 text-ink-2 ring-line',
};

// Soft colour wash in the corner of each tile, matching its icon chip.
const GLOWS = {
  brand: 'from-brand-500/25',
  sky: 'from-sky-500/25',
  amber: 'from-amber-500/25',
  violet: 'from-violet-500/25',
  rose: 'from-rose-500/25',
  slate: 'from-ink-3/15',
};

const NUMERIC = /^(-?\d+(?:[.,]\d+)?)(\s*%?)$/;

/** Counts up from 0 to a numeric value (e.g. 42, 87.5, "93%"); anything else renders as-is. */
function CountUp({ value }) {
  const match = typeof value === 'number' ? [null, String(value), ''] : typeof value === 'string' ? NUMERIC.exec(value.trim()) : null;
  const target = match ? Number(match[1].replace(',', '.')) : null;
  const decimals = match && /[.,]/.test(match[1]) ? match[1].split(/[.,]/)[1].length : 0;
  const [shown, setShown] = useState(target === null ? null : 0);
  const played = useRef(false);
  useEffect(() => {
    if (target === null || !Number.isFinite(target)) return undefined;
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduced || played.current) {
      setShown(target);
      return undefined;
    }
    played.current = true;
    let frame;
    const start = performance.now();
    const duration = 1100;
    const tick = (now) => {
      const p = Math.min(1, (now - start) / duration);
      setShown(target * (1 - (1 - p) ** 4));
      if (p < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target]);
  if (target === null || !Number.isFinite(target)) return value;
  const text = (shown ?? target).toFixed(decimals);
  return (
    <>
      <span aria-hidden="true">{match[1].includes(',') ? text.replace('.', ',') : text}{match[2]}</span>
      <span className="sr-only">{value}</span>
    </>
  );
}

/** KPI tile: label · value · supporting line. Becomes a link when `to` is set. */
export default function StatCard({ label, value, sub, icon: Icon, tone = 'brand', to, className, children }) {
  const body = (
    <>
      <span
        className={cn('pointer-events-none absolute -right-10 -top-12 size-36 rounded-full bg-radial to-transparent to-70% opacity-80 transition-opacity duration-300 group-hover:opacity-100', GLOWS[tone])}
        aria-hidden="true"
      />
      <div className="relative flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-ink-2">{label}</p>
        {Icon && (
          <span className={cn('grid size-10 shrink-0 place-items-center rounded-xl shadow-xs ring-1 ring-inset transition-transform duration-300 ease-(--ease-spring) group-hover:-rotate-6 group-hover:scale-110', TONES[tone])}>
            <Icon className="size-[18px]" aria-hidden="true" />
          </span>
        )}
      </div>
      <p className="relative mt-2 font-display text-[32px] font-bold leading-none tracking-tight text-ink tabular sm:text-[36px]">
        <CountUp value={value} />
      </p>
      {sub && <p className="relative mt-2 flex items-center gap-1 text-xs text-ink-3">{sub}</p>}
      {children}
      {to && <ArrowUpRight className="absolute bottom-4 right-4 size-4 text-ink-3 opacity-0 transition-opacity group-hover:opacity-100" aria-hidden="true" />}
    </>
  );
  const classes = cn('card stat-card group relative block overflow-hidden p-4 sm:p-5', to && 'card-interactive', className);
  return to ? (
    <Link to={to} className={classes}>
      {body}
    </Link>
  ) : (
    <div className={classes}>{body}</div>
  );
}
