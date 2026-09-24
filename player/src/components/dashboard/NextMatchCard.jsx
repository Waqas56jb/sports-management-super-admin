import { useEffect, useState } from 'react';
import { CalendarDays, Clock, Goal, MapPin, Trophy } from 'lucide-react';
import TeamLogo from '@/components/common/TeamLogo';
import Button from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/States';
import { useI18n } from '@/i18n';
import { countdown, formatLongDate, formatTime } from '@/utils/formatters';

function Countdown({ match }) {
  const { t } = useI18n();
  const [left, setLeft] = useState(() => countdown(match.date, match.time));
  useEffect(() => {
    const id = setInterval(() => setLeft(countdown(match.date, match.time)), 30000);
    return () => clearInterval(id);
  }, [match.date, match.time]);
  if (!left) return null;
  const parts = [
    [left.days, t('dashboard.nextMatch.days')],
    [left.hours, t('dashboard.nextMatch.hours')],
    [left.minutes, t('dashboard.nextMatch.minutes')],
  ];
  return (
    <div className="mt-4 text-center">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-3">{t('dashboard.nextMatch.kickoffIn')}</p>
      <div className="mt-1.5 flex justify-center gap-2" role="timer">
        {parts.map(([v, unit]) => (
          <span key={unit} className="min-w-14 rounded-lg bg-surface-3 px-2 py-1.5">
            <span className="block font-display text-2xl font-bold leading-none text-ink tabular">{v}</span>
            <span className="text-[10px] uppercase text-ink-3">{unit}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

/** Next (or live) match of the player's team with countdown and venue. */
export default function NextMatchCard({ match }) {
  const { t, lang } = useI18n();
  if (!match) {
    return (
      <section className="card flex flex-col">
        <h2 className="px-5 pt-5 text-[15px] font-semibold text-ink">{t('dashboard.nextMatch.title')}</h2>
        <EmptyState compact icon={Goal} title={t('dashboard.nextMatch.none')} description={t('dashboard.nextMatch.noneHint')} />
      </section>
    );
  }
  const live = match.status === 'live';
  return (
    <section aria-label={t('dashboard.nextMatch.title')} className="card flex flex-col p-5">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-[15px] font-semibold text-ink">{t('dashboard.nextMatch.title')}</h2>
        {live ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-red-600 px-2.5 py-0.5 text-xs font-semibold text-white">
            <span className="size-1.5 animate-pulse rounded-full bg-white" />
            {t('dashboard.nextMatch.live')} · {match.live_minute}'
          </span>
        ) : (
          <span className="inline-flex min-w-0 items-center gap-1 truncate text-xs text-ink-3">
            <Trophy className="size-3.5 shrink-0" aria-hidden="true" />
            <span className="truncate">{match.competition ? match.competition.name : t('matches.friendly')}</span>
          </span>
        )}
      </div>
      <div className="mt-5 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
        <div className="flex min-w-0 flex-col items-center gap-2 text-center">
          <TeamLogo team={match.home_team} size="lg" />
          <span className="max-w-full truncate text-sm font-semibold text-ink">{match.home_team?.name}</span>
        </div>
        <span className="font-display text-3xl font-bold text-ink tabular">{live ? `${match.home_score} – ${match.away_score}` : t('matches.vs')}</span>
        <div className="flex min-w-0 flex-col items-center gap-2 text-center">
          <TeamLogo team={match.away_team} size="lg" />
          <span className="max-w-full truncate text-sm font-semibold text-ink">{match.away_team?.name}</span>
        </div>
      </div>
      {!live && <Countdown match={match} />}
      <ul className="mt-5 space-y-1.5 text-sm text-ink-2">
        <li className="flex items-center gap-2 capitalize">
          <CalendarDays className="size-4 shrink-0 text-ink-3" aria-hidden="true" />
          {formatLongDate(match.date, lang)}
        </li>
        <li className="flex items-center gap-2">
          <Clock className="size-4 shrink-0 text-ink-3" aria-hidden="true" />
          {formatTime(match.time)}
        </li>
        <li className="flex min-w-0 items-center gap-2">
          <MapPin className="size-4 shrink-0 text-ink-3" aria-hidden="true" />
          <span className="truncate">{match.location}</span>
        </li>
      </ul>
      <Button to={`/player/matches/${match.id}`} className="mt-5 w-full">
        {t('dashboard.nextMatch.view')}
      </Button>
    </section>
  );
}
