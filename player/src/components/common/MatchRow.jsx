import { Link } from 'react-router-dom';
import { MapPin } from 'lucide-react';
import { StatusBadge } from '@/components/ui/Badge';
import { useI18n } from '@/i18n';
import { formatTime, formatWeekday } from '@/utils/formatters';
import { cn } from '@/utils/cn';
import TeamLogo from './TeamLogo';

/** Compact fixture/result row: home — score/time — away. Links to the match centre. */
export default function MatchRow({ match, showCompetition = true, className, linkable = true }) {
  const { t, lang } = useI18n();
  const played = match.status === 'completed' || match.status === 'live';
  const homeWon = played && match.home_score > match.away_score;
  const awayWon = played && match.away_score > match.home_score;
  const Wrapper = linkable ? Link : 'div';
  return (
    <Wrapper
      {...(linkable ? { to: `/player/matches/${match.id}` } : {})}
      className={cn('group block rounded-xl px-3 py-3 sm:px-4', linkable && 'transition-colors hover:bg-surface-2 focus-visible:bg-surface-2', className)}
    >
      <div className="mb-2 flex items-center justify-between gap-2 text-xs text-ink-3">
        <span className="truncate">
          {showCompetition && (match.competition ? `${match.competition.name} · ` : `${t('matches.friendly')} · `)}
          {formatWeekday(match.date, lang)}
        </span>
        {match.status === 'live' ? (
          <StatusBadge value="live" />
        ) : match.status === 'cancelled' ? (
          <StatusBadge value="cancelled" />
        ) : null}
      </div>
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
        <span className={cn('flex min-w-0 items-center justify-end gap-2 text-right text-sm', homeWon ? 'font-semibold text-ink' : 'text-ink-2')}>
          <span className="truncate">{match.home_team?.name}</span>
          <TeamLogo team={match.home_team} size="sm" />
        </span>
        <span className={cn('min-w-16 rounded-lg px-2 py-1 text-center font-display text-lg font-bold tabular leading-6', played ? 'bg-surface-3 text-ink' : 'text-ink-2 text-base')}>
          {played ? `${match.home_score} – ${match.away_score}` : formatTime(match.time)}
        </span>
        <span className={cn('flex min-w-0 items-center gap-2 text-sm', awayWon ? 'font-semibold text-ink' : 'text-ink-2')}>
          <TeamLogo team={match.away_team} size="sm" />
          <span className="truncate">{match.away_team?.name}</span>
        </span>
      </div>
      {!played && match.location && (
        <p className="mt-2 flex items-center justify-center gap-1 truncate text-xs text-ink-3">
          <MapPin className="size-3 shrink-0" aria-hidden="true" />
          <span className="truncate">{match.location}</span>
        </p>
      )}
    </Wrapper>
  );
}
