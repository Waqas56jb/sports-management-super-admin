import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarDays, ClipboardList, Clock, Goal, MapPin } from 'lucide-react';
import TeamLogo from '@/components/common/TeamLogo';
import Button from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/States';
import { useI18n } from '@/i18n';
import { countdown, formatLongDate, formatTime } from '@/utils/format';

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
      <p className="text-[11px] font-semibold uppercase tracking-wider text-white/50">{t('dashboard.nextMatch.kickoffIn')}</p>
      <div className="mt-1.5 flex justify-center gap-2" role="timer" aria-live="off">
        {parts.map(([v, unit]) => (
          <span key={unit} className="min-w-14 rounded-lg bg-white/10 px-2 py-1.5">
            <span className="block font-display text-2xl font-bold leading-none tabular">{v}</span>
            <span className="text-[10px] uppercase text-white/60">{unit}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

/** Dark hero card for the coach's next (or live) fixture. */
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
    <section aria-label={t('dashboard.nextMatch.title')} className="pitch-lines relative flex flex-col overflow-hidden rounded-(--radius-card) bg-[#0b1220] p-5 text-white shadow-(--shadow-card)">
      <div className="absolute -right-20 -top-20 size-64 rounded-full bg-brand-500/15 blur-3xl" aria-hidden="true" />
      <div className="relative flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-white/80">{t('dashboard.nextMatch.title')}</h2>
        {live ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-red-500/20 px-2.5 py-0.5 text-xs font-semibold text-red-200">
            <span className="size-1.5 animate-pulse rounded-full bg-red-400" />
            {t('dashboard.nextMatch.live')} · {match.live_minute}'
          </span>
        ) : (
          <span className="truncate text-xs text-white/60">{match.competition ? `${match.competition.name}` : t('matches.friendly')}</span>
        )}
      </div>
      <div className="relative mt-5 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
        <div className="flex min-w-0 flex-col items-center gap-2 text-center">
          <TeamLogo team={match.home_team} size="lg" />
          <span className="max-w-full truncate text-sm font-semibold">{match.home_team?.name}</span>
        </div>
        <span className="font-display text-3xl font-bold tabular">{live ? `${match.home_score} – ${match.away_score}` : formatTime(match.time)}</span>
        <div className="flex min-w-0 flex-col items-center gap-2 text-center">
          <TeamLogo team={match.away_team} size="lg" />
          <span className="max-w-full truncate text-sm font-semibold">{match.away_team?.name}</span>
        </div>
      </div>
      {!live && <Countdown match={match} />}
      <ul className="relative mt-5 space-y-1.5 text-xs text-white/70">
        <li className="flex items-center gap-2 capitalize">
          <CalendarDays className="size-3.5 shrink-0" aria-hidden="true" />
          {formatLongDate(match.date, lang)}
        </li>
        <li className="flex items-center gap-2">
          <Clock className="size-3.5 shrink-0" aria-hidden="true" />
          {formatTime(match.time)}
        </li>
        <li className="flex min-w-0 items-center gap-2">
          <MapPin className="size-3.5 shrink-0" aria-hidden="true" />
          <span className="truncate">{match.location}</span>
        </li>
      </ul>
      <div className="relative mt-5 grid grid-cols-2 gap-2">
        <Button size="sm" to={`/coach/matches/${match.id}`} className="dark:bg-brand-500">
          {t('dashboard.nextMatch.open')}
        </Button>
        <Link to={`/coach/matches/${match.id}?tab=lineup`} className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-white/15 bg-white/10 px-3 text-sm font-medium text-white hover:bg-white/15">
          <ClipboardList className="size-4" aria-hidden="true" />
          <span className="truncate">{t('dashboard.nextMatch.lineup')}</span>
        </Link>
      </div>
    </section>
  );
}
