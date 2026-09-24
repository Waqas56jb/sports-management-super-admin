import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CalendarPlus, Goal, MapPin } from 'lucide-react';
import RowActions from '@/components/common/RowActions';
import TeamLogo from '@/components/common/TeamLogo';
import { StatusBadge } from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import DataTable from '@/components/ui/DataTable';
import FilterBar from '@/components/ui/FilterBar';
import PageHeader from '@/components/ui/PageHeader';
import Pagination from '@/components/ui/Pagination';
import { EmptyState, ErrorState } from '@/components/ui/States';
import Tabs from '@/components/ui/Tabs';
import { useListParams } from '@/hooks/useListParams';
import { useCompetitionOptions, useOptions, useTeamOptions } from '@/hooks/useOptions';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useQuery } from '@/hooks/useQuery';
import { useI18n } from '@/i18n';
import { matchService } from '@/services/matchService';
import { MATCH_STATUSES, PAGE_SIZE } from '@/utils/constants';
import { formatTime, formatWeekday } from '@/utils/format';
import { cn } from '@/utils/cn';
import { useMatchActions } from './useMatchActions';

export function Fixture({ match, compact }) {
  const played = match.home_score !== null && (match.status === 'completed' || match.status === 'live');
  const homeWon = played && match.home_score > match.away_score;
  const awayWon = played && match.away_score > match.home_score;
  return (
    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 sm:gap-3">
      <span className={cn('flex min-w-0 items-center justify-end gap-2 text-right', homeWon ? 'font-semibold text-ink' : 'text-ink-2')}>
        <span className="truncate">{compact ? match.home_team?.short_name : match.home_team?.name}</span>
        <TeamLogo team={match.home_team} size="sm" />
      </span>
      <span className={cn('min-w-14 rounded-lg px-2 py-0.5 text-center font-display text-base font-bold tabular', played ? 'bg-surface-3 text-ink' : 'text-ink-3')}>
        {played ? `${match.home_score}–${match.away_score}` : '–'}
      </span>
      <span className={cn('flex min-w-0 items-center gap-2', awayWon ? 'font-semibold text-ink' : 'text-ink-2')}>
        <TeamLogo team={match.away_team} size="sm" />
        <span className="truncate">{compact ? match.away_team?.short_name : match.away_team?.name}</span>
      </span>
    </div>
  );
}

export default function MatchesPage() {
  const { t, lang } = useI18n();
  usePageTitle(t('matches.title'));
  const navigate = useNavigate();
  const toOptions = useOptions();
  const { teamOptions } = useTeamOptions();
  const { competitions, competitionOptions } = useCompetitionOptions();
  const { params, set, reset } = useListParams({ when: 'upcoming' });
  const [searchParams, setSearchParams] = useSearchParams();

  const when = params.when === 'all' ? undefined : params.when;
  const list = useQuery(
    () =>
      matchService.list({
        search: params.search,
        status: params.status,
        competitionId: params.competition,
        teamId: params.team,
        from: params.from,
        to: params.to,
        when,
        page: params.page,
        pageSize: PAGE_SIZE,
        dir: params.when === 'all' ? 'desc' : undefined,
      }),
    [params.search, params.status, params.competition, params.team, params.from, params.to, params.when, params.page],
  );
  const { actionsFor, modals, openCreate } = useMatchActions({ competitions, onChanged: list.refetch });

  useEffect(() => {
    if (searchParams.get('new') === '1') {
      openCreate({ competition_id: searchParams.get('competition') ?? '' });
      searchParams.delete('new');
      searchParams.delete('competition');
      setSearchParams(searchParams, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const columns = [
    {
      key: 'date',
      header: t('matches.columns.date'),
      className: 'w-40',
      render: (m) => (
        <div>
          <p className="font-medium capitalize text-ink">{formatWeekday(m.date, lang)}</p>
          <p className="text-xs text-ink-3 tabular">{formatTime(m.time)}</p>
        </div>
      ),
    },
    { key: 'fixture', header: t('matches.columns.fixture'), className: 'min-w-80', render: (m) => <Fixture match={m} /> },
    {
      key: 'competition',
      header: t('matches.columns.competition'),
      render: (m) => (
        <div className="min-w-0">
          <p className="truncate text-ink-2">{m.competition ? m.competition.name : t('matches.friendly')}</p>
          {m.round && <p className="text-xs text-ink-3">{t('matches.round', { round: m.round })}</p>}
        </div>
      ),
    },
    { key: 'venue', header: t('matches.columns.venue'), className: 'max-w-52', render: (m) => <span className="line-clamp-2 text-sm">{m.location}</span> },
    { key: 'status', header: t('matches.columns.status'), render: (m) => (m.status === 'live' ? <StatusBadge value="live" className="tabular" /> : <StatusBadge value={m.status} />) },
    { key: 'actions', header: <span className="sr-only">{t('common.actions')}</span>, align: 'right', render: (m) => <RowActions items={actionsFor(m)} /> },
  ];

  const filtersActive = params.search || params.status || params.competition || params.team || params.from || params.to;

  return (
    <>
      <PageHeader
        title={t('matches.title')}
        description={t('matches.description')}
        actions={
          <Button icon={CalendarPlus} onClick={() => openCreate()}>
            {t('matches.add')}
          </Button>
        }
      />
      <Tabs
        className="mb-4"
        label={t('matches.title')}
        value={params.when}
        onChange={(v) => set({ when: v })}
        tabs={[
          { value: 'upcoming', label: t('matches.tabs.upcoming') },
          { value: 'past', label: t('matches.tabs.past') },
          { value: 'all', label: t('matches.tabs.all') },
        ]}
      />
      <Card>
        <div className="border-b border-line p-3 sm:p-4">
          <FilterBar
            search={params.search ?? ''}
            onSearch={(v) => set({ search: v })}
            searchPlaceholder={t('matches.searchPlaceholder')}
            filters={[
              { key: 'competition', label: t('common.competition'), options: [...competitionOptions, { value: 'friendly', label: t('matches.friendly') }], placeholder: t('matches.allCompetitions') },
              { key: 'team', label: t('common.team'), options: teamOptions, placeholder: t('common.allTeams'), className: 'sm:min-w-36' },
              { key: 'status', label: t('common.status'), options: toOptions(MATCH_STATUSES, 'status'), placeholder: t('common.allStatuses'), className: 'sm:min-w-32' },
              { key: 'from', label: t('common.from'), type: 'date', className: 'sm:w-40' },
              { key: 'to', label: t('common.to'), type: 'date', className: 'sm:w-40' },
            ]}
            values={params}
            onChange={set}
            onReset={() => reset(['competition', 'team', 'status', 'from', 'to', 'search'])}
          />
        </div>
        {list.error ? (
          <ErrorState error={list.error} onRetry={list.refetch} />
        ) : (
          <DataTable
            caption={t('matches.title')}
            columns={columns}
            rows={list.data?.data}
            loading={list.loading}
            fetching={list.fetching}
            onRowClick={(m) => navigate(`/admin/matches/${m.id}`)}
            empty={
              <EmptyState
                icon={Goal}
                title={params.when === 'upcoming' && !filtersActive ? t('matches.empty.upcomingTitle') : t('matches.empty.title')}
                description={params.when === 'upcoming' && !filtersActive ? t('matches.empty.upcomingDescription') : t('matches.empty.description')}
                action={filtersActive ? <Button variant="secondary" onClick={() => reset(['competition', 'team', 'status', 'from', 'to', 'search'])}>{t('common.reset')}</Button> : <Button icon={CalendarPlus} onClick={() => openCreate()}>{t('matches.add')}</Button>}
              />
            }
            mobileCard={(m) => (
              <div>
                <div className="mb-2 flex items-center justify-between gap-2 text-xs text-ink-3">
                  <span className="truncate">
                    <span className="capitalize">{formatWeekday(m.date, lang)}</span> · {formatTime(m.time)} · {m.competition ? m.competition.name : t('matches.friendly')}
                  </span>
                  <StatusBadge value={m.status} />
                </div>
                <Fixture match={m} compact />
                <p className="mt-2 flex items-center justify-center gap-1 truncate text-xs text-ink-3">
                  <MapPin className="size-3 shrink-0" aria-hidden="true" />
                  <span className="truncate">{m.location}</span>
                </p>
              </div>
            )}
          />
        )}
        {list.data && list.data.total > 0 && (
          <div className="border-t border-line px-4 py-3 sm:px-5">
            <Pagination page={list.data.page} pages={list.data.pages} total={list.data.total} pageSize={list.data.pageSize} onChange={(page) => set({ page })} />
          </div>
        )}
      </Card>
      {modals}
    </>
  );
}
