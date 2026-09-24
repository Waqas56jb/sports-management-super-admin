import { Link } from 'react-router-dom';
import { MapPin } from 'lucide-react';
import TeamLogo from '@/components/common/TeamLogo';
import { StatusBadge } from '@/components/ui/Badge';
import { useI18n } from '@/i18n';
import { formatTime, formatWeekday } from '@/utils/formatters';
import { cn } from '@/utils/cn';

/** Fixture card: competition, both teams with score, date, time, venue and status. The player's team is emphasised. */
export default function MatchCard({ match, myTeamId }) {
  const { t, lang } = useI18n();
  const played = match.home_score !== null && (match.status === 'completed' || match.status === 'live');
  const side = (team, score, other) => {
    const mine = team?.id === myTeamId;
    const won = played && score > other;
    return (
      <div className="flex items-center gap-3">
        <TeamLogo team={team} size="md" />
        <span className={cn('min-w-0 flex-1 truncate text-sm', mine || won ? 'font-semibold text-ink' : 'text-ink-2')}>{team?.name}</span>
        <span className={cn('w-8 text-right font-display text-xl font-bold tabular', played ? 'text-ink' : 'text-ink-3')}>{played ? score : '–'}</span>
      </div>
    );
  };
  return (
    <Link to={`/player/matches/${match.id}`} className={cn('card block p-4 transition-shadow hover:shadow-(--shadow-pop) sm:p-5', match.status === 'cancelled' && 'opacity-75')}>
      <div className="mb-3 flex items-center justify-between gap-2 text-xs text-ink-3">
        <span className="truncate">
          {match.competition ? `${match.competition.name}${match.round ? ` · ${t('matches.round', { round: match.round })}` : ''}` : t('matches.friendly')}
        </span>
        {match.status === 'live' ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-red-600 px-2 py-0.5 font-semibold text-white">
            <span className="size-1.5 animate-pulse rounded-full bg-white" />
            {match.live_minute}'
          </span>
        ) : (
          <StatusBadge value={match.status} />
        )}
      </div>
      <div className="space-y-2.5">
        {side(match.home_team, match.home_score, match.away_score)}
        {side(match.away_team, match.away_score, match.home_score)}
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-line pt-3 text-xs text-ink-3">
        <span className="capitalize">{formatWeekday(match.date, lang)}</span>
        <span className="tabular">{formatTime(match.time)}</span>
        <span className="flex min-w-0 items-center gap-1">
          <MapPin className="size-3 shrink-0" aria-hidden="true" />
          <span className="truncate">{match.location}</span>
        </span>
      </div>
    </Link>
  );
}
