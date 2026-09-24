import { CheckCircle2 } from 'lucide-react';
import BrandLogo from '@/components/common/BrandLogo';
import LanguageSwitcher from '@/components/common/LanguageSwitcher';
import ThemeToggle from '@/components/common/ThemeToggle';
import { useI18n } from '@/i18n';

/** Pitch diagram used as the visual on the auth screens (pure SVG, no image assets). */
function PitchArt() {
  return (
    <svg viewBox="0 0 400 260" className="w-full max-w-md" aria-hidden="true">
      <defs>
        <linearGradient id="pitch" x1="0" x2="1">
          <stop offset="0" stopColor="#0a7361" stopOpacity="0.55" />
          <stop offset="1" stopColor="#079075" stopOpacity="0.25" />
        </linearGradient>
      </defs>
      <rect x="1" y="1" width="398" height="258" rx="14" fill="url(#pitch)" stroke="#34cda7" strokeOpacity="0.45" />
      {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
        <rect key={i} x={1 + i * 49.75} y="1" width="24.9" height="258" fill="#fff" fillOpacity="0.025" />
      ))}
      <g fill="none" stroke="#fff" strokeOpacity="0.5" strokeWidth="1.5">
        <line x1="200" y1="1" x2="200" y2="259" />
        <circle cx="200" cy="130" r="36" />
        <rect x="1" y="70" width="60" height="120" />
        <rect x="1" y="102" width="22" height="56" />
        <rect x="339" y="70" width="60" height="120" />
        <rect x="377" y="102" width="22" height="56" />
        <path d="M61 108a24 24 0 0 1 0 44M339 108a24 24 0 0 0 0 44" />
      </g>
      <circle cx="200" cy="130" r="3" fill="#fff" fillOpacity="0.7" />
      {[
        [95, 60], [110, 130], [95, 200], [150, 95], [150, 165], [178, 130],
        [250, 80], [262, 180], [300, 130], [320, 60], [320, 200],
      ].map(([x, y], i) => (
        <g key={i}>
          <circle cx={x} cy={y} r="9" fill={i < 6 ? '#34cda7' : '#f8fafc'} fillOpacity={i < 6 ? 0.95 : 0.85} />
          <circle cx={x} cy={y} r="13" fill="none" stroke={i < 6 ? '#34cda7' : '#f8fafc'} strokeOpacity="0.3" />
        </g>
      ))}
      <path d="M178 130 Q 215 100 250 80" fill="none" stroke="#fde68a" strokeWidth="2" strokeDasharray="4 5" />
    </svg>
  );
}

export default function AuthLayout({ children }) {
  const { t } = useI18n();
  const features = ['matches', 'players', 'reports'];
  return (
    <div className="grid min-h-dvh lg:grid-cols-[1.05fr_1fr]">
      <aside className="pitch-lines hero-aurora relative hidden overflow-hidden bg-[#0b1220] text-white lg:flex lg:flex-col lg:justify-between lg:gap-10 lg:p-12 xl:p-16">
        <div className="absolute -right-40 -top-40 size-[520px] rounded-full bg-brand-500/15 blur-3xl" aria-hidden="true" />
        <div className="absolute -bottom-48 -left-24 size-[420px] rounded-full bg-sky-500/10 blur-3xl" aria-hidden="true" />
        <BrandLogo inverted compact size="2xl" className="relative" />
        <div className="relative max-w-xl">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-300">{t('auth.hero.eyebrow')}</p>
          <h1 className="mt-4 font-display text-5xl font-bold leading-[1.02] tracking-tight xl:text-6xl">{t('auth.hero.title')}</h1>
          <p className="mt-5 max-w-lg text-base leading-relaxed text-slate-300">{t('auth.hero.body')}</p>
          <ul className="mt-8 space-y-3">
            {features.map((f) => (
              <li key={f} className="flex items-center gap-3 text-sm text-slate-200">
                <CheckCircle2 className="size-5 shrink-0 text-brand-400" aria-hidden="true" />
                {t(`auth.hero.features.${f}`)}
              </li>
            ))}
          </ul>
        </div>
        <div className="relative">
          <PitchArt />
        </div>
      </aside>

      <main className="safe-top relative isolate flex flex-col overflow-hidden">
        {/* Phones and tablets: soft brand light behind the form (the desktop has the side panel). */}
        <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[460px] lg:hidden" aria-hidden="true">
          <div className="absolute -left-28 -top-36 size-[400px] rounded-full bg-brand-400/25 blur-3xl dark:bg-brand-500/20" />
          <div className="absolute -right-32 -top-12 size-[340px] rounded-full bg-sky-400/20 blur-3xl dark:bg-sky-500/10" />
          <div className="pitch-lines absolute inset-0 opacity-[0.35] [mask-image:linear-gradient(to_bottom,black,transparent)] dark:opacity-100" />
        </div>
        <div className="flex items-center justify-between gap-3 p-4 sm:p-6">
          <BrandLogo size="lg" className="lg:invisible" />
          <div className="flex items-center gap-1">
            <ThemeToggle />
            <LanguageSwitcher variant="pill" />
          </div>
        </div>
        <div className="flex flex-1 items-center justify-center px-4 pb-[max(2.5rem,env(safe-area-inset-bottom))] sm:px-6">
          <div className="glass w-full max-w-[440px] rounded-[1.75rem] border border-white/70 p-5 shadow-(--shadow-pop) sm:p-8 dark:border-white/10 lg:border-0 lg:bg-transparent lg:p-0 lg:shadow-none lg:backdrop-blur-none">{children}</div>
        </div>
      </main>
    </div>
  );
}
