import { useI18n } from '@/i18n';
import { cn } from '@/utils/cn';

/**
 * The WOLF logo. The artwork is white-on-black, so two transparent versions are shipped:
 *   /brand/logo-white.png  — for dark surfaces (sidebar, dark hero, dark mode)
 *   /brand/logo-dark.png   — for light surfaces (light pages and cards)
 * tone: 'light' = always the white version, 'dark' = always the dark version,
 *       'auto'  = follows the theme (dark version in light mode, white version in dark mode).
 */
const SIZES = {
  xs: 'h-7',
  sm: 'h-8',
  md: 'h-10',
  lg: 'h-12',
  nav: 'h-14',
  xl: 'h-16',
  '2xl': 'h-24',
};

// Intrinsic size of the exported artwork (keeps layout stable while the image loads).
const IMG = { width: 720, height: 467 };

export function LogoImage({ tone = 'auto', size = 'md', className }) {
  const cls = cn('w-auto max-w-none shrink-0 select-none object-contain', SIZES[size] ?? size, className);
  const img = (src, extra, decorative) => (
    <img src={src} alt={decorative ? '' : 'WOLF'} aria-hidden={decorative || undefined} {...IMG} draggable="false" className={cn(cls, extra)} />
  );
  if (tone === 'light') return img('/brand/logo-white.png');
  if (tone === 'dark') return img('/brand/logo-dark.png');
  return (
    <>
      {img('/brand/logo-dark.png', 'block dark:hidden')}
      {img('/brand/logo-white.png', 'hidden dark:block', true)}
    </>
  );
}

/** Logo only (collapsed navigation rail, compact bars). Defaults to the white version for dark surfaces. */
export function BrandMark({ className, tone = 'light', size = 'sm' }) {
  return <LogoImage tone={tone} size={size} className={className} />;
}

/**
 * Logo + panel name (e.g. "WOLF | Player space").
 * inverted: the logo sits on a dark surface (sidebar, auth hero) → white artwork.
 */
export default function BrandLogo({ className, inverted = false, compact = false, size = 'md' }) {
  const { t } = useI18n();
  return (
    <span className={cn('inline-flex items-center gap-3', className)}>
      <LogoImage tone={inverted ? 'light' : 'auto'} size={size} />
      {!compact && (
        <span
          className={cn(
            'border-l py-1 pl-3 text-[10.5px] font-semibold uppercase leading-tight tracking-[0.16em]',
            inverted ? 'border-white/15 text-white/70' : 'border-line-strong text-ink-3',
          )}
        >
          {t('app.tagline')}
        </span>
      )}
    </span>
  );
}
