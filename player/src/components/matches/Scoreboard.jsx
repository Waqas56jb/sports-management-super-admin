import { Link } from 'react-router-dom';
import { CalendarDays, Clock, MapPin, UserRound } from 'lucide-react';
import TeamLogo from '@/components/common/TeamLogo';
import { StatusBadge } from '@/components/ui/Badge';
import { useI18n } from '@/i18n';
import { formatLongDate, formatTime } from '@/utils/formatters';
import { cn } from '@/utils/cn';

function Side({ team, scorers, linkable }) {
  const L = linkable ? Link : 'span';
  const to = linkable ? { to: '/player/team' } : {};
  return (
    <div className={cn('flex min-w-0 flex-col items-center gap-2 text-center sm:gap-3')}>
      <L {...to} className="rounded-2xl bg-white/5 p-2 ring-1 ring-white/10 transition-colors hover:bg-white/10 sm:p-3">
        <TeamLogo team={team} size="xl" className="size-14 sm:size-20" />
      </L>
      <L {...to} className="max-w-full truncate text-sm font-semibold text-white hover:underline sm:text-lg">
        {team?.name}
      </L>
      {scorers.length > 0 && (
        <ul className="hidden space-y-0.5 text-center text-xs text-white/60 sm:block">
          {scorers.map((s) => (
            <li key={s.id} className="tabular">
              {s.player?.name?.split(' ').slice(-1)[0]} {s.minute}'
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Match centre header: HOME — score — AWAY on a dark pitch background. */
export default function Scoreboard({ match, actions }) {
  const { t, lang } = useI18n();
  const played = match.home_score !== null && match.status !== 'scheduled' && match.status !== 'cancelled';
  const goals = match.events.filter((e) => e.event_type === 'goal');
  const statusLine =
    match.status === 'live'
      ? `${match.live_minute}'`
      : match.status === 'completed'
        ? t('matches.centre.fullTime')
        : match.status === 'cancelled'
          ? t('status.cancelled')
          : t('matches.centre.notStarted');

  return (
    <section className="pitch-lines hero-aurora relative overflow-hidden rounded-(--radius-card) bg-[#0b1220] text-white shadow-(--shadow-card)">
      <div className="absolute -left-24 -top-24 size-80 rounded-full bg-brand-500/10 blur-3xl" aria-hidden="true" />
      <div className="absolute -bottom-24 -right-24 size-80 rounded-full bg-sky-500/10 blur-3xl" aria-hidden="true" />
      <div className="relative px-4 pb-5 pt-4 sm:px-8 sm:pb-8 sm:pt-6">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs sm:text-sm">
          <span className="truncate font-medium text-white/70">
            {match.competition ? (
              <Link to={`/player/competitions/${match.competition.id}`} className="hover:text-white hover:underline">
                {match.competition.name} {match.competition.season}
              </Link>
            ) : (
              t('matches.friendly')
            )}
            {match.round && ` · ${t('matches.round', { round: match.round })}`}
          </span>
          <StatusBadge value={match.status} />
        </div>

        <div className="mt-5 grid grid-cols-[1fr_auto_1fr] items-start gap-2 sm:mt-6 sm:gap-8">
          <Side team={match.home_team} scorers={goals.filter((g) => g.team_id === match.home_team_id)} linkable={match.my_side === 'home'} />
          <div className="flex flex-col items-center pt-3 sm:pt-6">
            <h1 className="sr-only">
              {match.home_team?.name} {t('matches.vs')} {match.away_team?.name}
            </h1>
            <p className="font-display text-5xl font-bold leading-none tracking-tight tabular sm:text-7xl" aria-live="polite">
              {played ? (
                <>
                  {match.home_score}
                  <span className="mx-2 text-white/40 sm:mx-4">—</span>
                  {match.away_score}
                </>
              ) : (
                <span className="text-4xl text-white/80 sm:text-5xl">{formatTime(match.time)}</span>
              )}
            </p>
            <p className={cn('mt-3 rounded-full px-3 py-0.5 text-xs font-semibold tabular', match.status === 'live' ? 'bg-red-500/20 text-red-200' : 'bg-white/10 text-white/70')}>{statusLine}</p>
          </div>
          <Side team={match.away_team} scorers={goals.filter((g) => g.team_id === match.away_team_id)} linkable={match.my_side === 'away'} />
        </div>

        <dl className="mt-6 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 border-t border-white/10 pt-4 text-xs text-white/70 sm:text-sm">
          <div className="flex items-center gap-1.5">
            <dt className="sr-only">{t('common.date')}</dt>
            <CalendarDays className="size-4" aria-hidden="true" />
            <dd className="capitalize">{formatLongDate(match.date, lang)}</dd>
          </div>
          <div className="flex items-center gap-1.5">
            <dt className="sr-only">{t('matches.centre.kickoff')}</dt>
            <Clock className="size-4" aria-hidden="true" />
            <dd className="tabular">{formatTime(match.time)}</dd>
          </div>
          <div className="flex min-w-0 items-center gap-1.5">
            <dt className="sr-only">{t('matches.centre.venue')}</dt>
            <MapPin className="size-4 shrink-0" aria-hidden="true" />
            <dd className="truncate">{match.location}</dd>
          </div>
          {match.referee && (
            <div className="flex items-center gap-1.5">
              <dt className="sr-only">{t('matches.centre.referee')}</dt>
              <UserRound className="size-4" aria-hidden="true" />
              <dd>
                {t('matches.centre.referee')}: {match.referee}
              </dd>
            </div>
          )}
        </dl>
        {actions && <div className="mt-5 flex flex-wrap justify-center gap-2">{actions}</div>}
      </div>
    </section>
  );
}
