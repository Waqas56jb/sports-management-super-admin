import { initials } from '@/utils/format';
import { cn } from '@/utils/cn';

const SIZES = {
  xs: 'size-6 text-[10px]',
  sm: 'size-8 text-xs',
  md: 'size-10 text-sm',
  lg: 'size-14 text-base',
  xl: 'size-20 text-xl',
  '2xl': 'size-28 text-3xl',
};

const PALETTE = [
  'bg-sky-100 text-sky-800 dark:bg-sky-500/20 dark:text-sky-200',
  'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-200',
  'bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-200',
  'bg-violet-100 text-violet-800 dark:bg-violet-500/20 dark:text-violet-200',
  'bg-rose-100 text-rose-800 dark:bg-rose-500/20 dark:text-rose-200',
  'bg-teal-100 text-teal-800 dark:bg-teal-500/20 dark:text-teal-200',
  'bg-indigo-100 text-indigo-800 dark:bg-indigo-500/20 dark:text-indigo-200',
];

function colorFor(name = '') {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return PALETTE[h % PALETTE.length];
}

/** Photo when available, otherwise initials on a stable per-name colour. Decorative by default. */
export default function Avatar({ name, src, size = 'md', className, ring = false }) {
  return (
    <span
      className={cn(
        'relative inline-grid shrink-0 place-items-center overflow-hidden rounded-full font-semibold uppercase',
        SIZES[size],
        !src && colorFor(name),
        ring && 'ring-2 ring-surface',
        className,
      )}
      aria-hidden="true"
    >
      {src ? <img src={src} alt="" className="size-full object-cover" loading="lazy" /> : initials(name)}
    </span>
  );
}
