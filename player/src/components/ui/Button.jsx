import { forwardRef } from 'react';
import { Link } from 'react-router-dom';
import { cn } from '@/utils/cn';
import Spinner from './Spinner';

const VARIANTS = {
  primary:
    'bg-brand-600 text-white shadow-sm hover:bg-brand-700 active:bg-brand-800 dark:bg-brand-500 dark:text-brand-950 dark:hover:bg-brand-400',
  secondary:
    'bg-surface text-ink border border-line-strong shadow-sm hover:bg-surface-2 active:bg-surface-3',
  ghost: 'text-ink-2 hover:bg-surface-3 hover:text-ink',
  danger: 'bg-red-600 text-white shadow-sm hover:bg-red-700 active:bg-red-800 dark:bg-red-500 dark:hover:bg-red-600',
  'danger-ghost': 'text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/10',
  dark: 'bg-slate-900 text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100',
};

const SIZES = {
  sm: 'h-9 px-3 text-sm gap-1.5 rounded-lg',
  md: 'h-11 px-4 text-sm gap-2 rounded-xl sm:h-10',
  lg: 'h-12 px-5 text-base gap-2 rounded-xl',
  icon: 'size-11 rounded-xl sm:size-10',
  'icon-sm': 'size-9 rounded-lg',
};

const Button = forwardRef(function Button(
  { variant = 'primary', size = 'md', loading = false, icon: Icon, iconRight: IconRight, to, className, children, disabled, type = 'button', ...rest },
  ref,
) {
  const classes = cn(
    'inline-flex shrink-0 select-none items-center justify-center font-medium whitespace-nowrap transition-colors',
    'focus-visible:outline-2 focus-visible:outline-offset-2 disabled:pointer-events-none disabled:opacity-55',
    VARIANTS[variant],
    SIZES[size],
    className,
  );
  const content = (
    <>
      {loading ? <Spinner className="size-4" /> : Icon && <Icon className="size-4 shrink-0" aria-hidden="true" />}
      {children}
      {IconRight && !loading && <IconRight className="size-4 shrink-0" aria-hidden="true" />}
    </>
  );
  if (to) {
    return (
      <Link ref={ref} to={to} className={classes} {...rest}>
        {content}
      </Link>
    );
  }
  return (
    <button ref={ref} type={type} className={classes} disabled={disabled || loading} aria-busy={loading || undefined} {...rest}>
      {content}
    </button>
  );
});

export default Button;
