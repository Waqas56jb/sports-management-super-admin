import { Link } from 'react-router-dom';
import { ArrowRight, MapPin } from 'lucide-react';
import TeamLogo from '@/components/common/TeamLogo';
import { useI18n } from '@/i18n';

/** Prominent strip for matches currently in play. */
export default function LiveMatchBanner({ match }) {
  const { t } = useI18n();
  return (
    <Link
      to={`/coach/matches/${match.id}`}
      className="pitch-lines group relative block overflow-hidden rounded-(--radius-card) bg-[#0b1220] p-4 text-white shadow-(--shadow-card) sm:p-5"
    >
      <div className="absolute -right-24 -top-24 size-72 rounded-full bg-red-500/15 blur-3xl" aria-hidden="true" />
      <div className="relative flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider">
          <span className="relative flex size-2.5">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-red-500 opacity-75" />
            <span className="relative inline-flex size-2.5 rounded-full bg-red-500" />
          </span>
          <span className="text-red-300">{t('dashboard.live.label')}</span>
          <span className="text-white/50">·</span>
          <span className="truncate font-medium normal-case tracking-normal text-white/70">{match.competition?.name ?? t('matches.friendly')}</span>
        </div>
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 md:flex-1 md:px-6">
          <span className="flex min-w-0 items-center justify-end gap-2.5 text-right">
            <span className="truncate text-sm font-semibold sm:text-base">{match.home_team?.name}</span>
            <TeamLogo team={match.home_team} size="md" />
          </span>
          <span className="flex flex-col items-center">
            <span className="font-display text-3xl font-bold tabular leading-none sm:text-4xl">
              {match.home_score} – {match.away_score}
            </span>
            <span className="mt-1 rounded-full bg-red-500/20 px-2 text-xs font-semibold text-red-200 tabular">{t('dashboard.live.minute', { minute: match.live_minute })}</span>
          </span>
          <span className="flex min-w-0 items-center gap-2.5">
            <TeamLogo team={match.away_team} size="md" />
            <span className="truncate text-sm font-semibold sm:text-base">{match.away_team?.name}</span>
          </span>
        </div>
        <div className="flex items-center justify-between gap-3 text-sm md:justify-end">
          <span className="flex min-w-0 items-center gap-1.5 text-white/60 md:hidden">
            <MapPin className="size-3.5 shrink-0" aria-hidden="true" />
            <span className="truncate">{match.location}</span>
          </span>
          <span className="inline-flex shrink-0 items-center gap-1.5 font-medium text-brand-300 group-hover:text-brand-200">
            {t('dashboard.live.open')}
            <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
          </span>
        </div>
      </div>
    </Link>
  );
}
