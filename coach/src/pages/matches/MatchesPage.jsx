import { Link } from 'react-router-dom';
import { Goal, MapPin } from 'lucide-react';
import TeamLogo from '@/components/common/TeamLogo';
import { StatusBadge } from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import FilterBar from '@/components/ui/FilterBar';
import PageHeader from '@/components/ui/PageHeader';
import Pagination from '@/components/ui/Pagination';
import { CardSkeleton } from '@/components/ui/Skeleton';
import { EmptyState, ErrorState } from '@/components/ui/States';
import Tabs from '@/components/ui/Tabs';
import { useListParams } from '@/hooks/useListParams';
import { useCompetitionOptions } from '@/hooks/useOptions';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useQuery } from '@/hooks/useQuery';
import { useTeams } from '@/hooks/useTeams';
import { useI18n } from '@/i18n';
import { matchService } from '@/services/matchService';
import { MATCH_STATUSES } from '@/utils/constants';
import { formatTime, formatWeekday } from '@/utils/format';
import { cn } from '@/utils/cn';

const PAGE = 8;

/** Fixture card: competition, date/time, both teams with score, venue and status. My teams are emphasised. */
export function MatchCard({ match, myTeamIds }) {
  const { t, lang } = useI18n();
  const played = match.home_score !== null && (match.status === 'completed' || match.status === 'live');
  const side = (team, score, other) => {
    const mine = myTeamIds.includes(team?.id);
    const won = played && score > other;
    return (
      <div className="flex items-center gap-3">
        <TeamLogo team={team} size="md" />
        <span className={cn('min-w-0 flex-1 truncate text-sm', mine ? 'font-semibold text-ink' : 'text-ink-2', won && 'font-semibold')}>{team?.name}</span>
        {mine && <span className="size-1.5 rounded-full bg-brand-500" title={t('common.mine')} aria-label={t('common.mine')} />}
        <span className={cn('w-8 text-right font-display text-xl font-bold tabular', played ? 'text-ink' : 'text-ink-3')}>{played ? score : '–'}</span>
      </div>
    );
  };
  return (
    <Link to={`/coach/matches/${match.id}`} className={cn('card block p-4 transition-shadow hover:shadow-(--shadow-pop) sm:p-5', match.status === 'cancelled' && 'opacity-70')}>
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

export default function MatchesPage() {
  const { t } = useI18n();
  usePageTitle(t('matches.title'));
  const { teams, teamOptions } = useTeams();
  const { competitionOptions } = useCompetitionOptions();
  const { params, set, reset } = useListParams({ status: 'scheduled' });
  const counts = useQuery(() => matchService.counts(), []);
  const list = useQuery(
    () => matchService.list({ status: params.status, search: params.search, teamId: params.team, competitionId: params.competition, page: params.page, pageSize: PAGE }),
    [params.status, params.search, params.team, params.competition, params.page],
  );
  const myIds = teams.map((tm) => tm.id);
  const filtersActive = params.search || params.team || params.competition;

  return (
    <>
      <PageHeader title={t('matches.title')} description={t('matches.description')} />
      <Tabs
        className="mb-4"
        label={t('matches.title')}
        value={params.status}
        onChange={(v) => set({ status: v })}
        tabs={MATCH_STATUSES.map((s) => ({ value: s, label: t(`matches.statusTabs.${s}`), count: counts.data?.[s] }))}
      />
      <Card className="mb-4 p-3 sm:mb-6 sm:p-4">
        <FilterBar
          search={params.search ?? ''}
          onSearch={(v) => set({ search: v })}
          searchPlaceholder={t('matches.searchPlaceholder')}
          filters={[
            { key: 'team', label: t('common.team'), options: teamOptions, placeholder: t('common.allTeams') },
            { key: 'competition', label: t('common.competition'), options: [...competitionOptions, { value: 'friendly', label: t('matches.friendly') }], placeholder: t('matches.allCompetitions'), className: 'sm:min-w-48' },
          ]}
          values={params}
          onChange={set}
          onReset={() => reset(['team', 'competition', 'search'])}
        />
      </Card>
      {list.error ? (
        <div className="card">
          <ErrorState error={list.error} onRetry={list.refetch} />
        </div>
      ) : list.loading ? (
        <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
          {[0, 1, 2, 3].map((i) => (
            <CardSkeleton key={i} lines={4} />
          ))}
        </div>
      ) : list.data.data.length === 0 ? (
        <div className="card">
          <EmptyState icon={Goal} title={t('matches.empty.title')} description={t('matches.empty.description')} action={filtersActive && <Button variant="secondary" onClick={() => reset(['team', 'competition', 'search'])}>{t('common.reset')}</Button>} />
        </div>
      ) : (
        <>
          <div className={cn('grid gap-4 lg:grid-cols-2 2xl:grid-cols-3', list.fetching && 'opacity-60')}>
            {list.data.data.map((m) => (
              <MatchCard key={m.id} match={m} myTeamIds={myIds} />
            ))}
          </div>
          <div className="card mt-4 px-4 py-3 sm:px-5">
            <Pagination page={list.data.page} pages={list.data.pages} total={list.data.total} pageSize={list.data.pageSize} onChange={(page) => set({ page })} />
          </div>
        </>
      )}
    </>
  );
}
