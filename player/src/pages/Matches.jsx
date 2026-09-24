import { Goal } from 'lucide-react';
import MatchCard from '@/components/matches/MatchCard';
import Button from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import FilterBar from '@/components/ui/FilterBar';
import PageHeader from '@/components/ui/PageHeader';
import Pagination from '@/components/ui/Pagination';
import { CardSkeleton } from '@/components/ui/Skeleton';
import { EmptyState, ErrorState } from '@/components/ui/States';
import Tabs from '@/components/ui/Tabs';
import { useListParams } from '@/hooks/useListParams';
import { useMatchCounts, useMatches } from '@/hooks/useMatches';
import { useCompetitionOptions, useOptions } from '@/hooks/useOptions';
import { usePageTitle } from '@/hooks/usePageTitle';
import { usePlayer } from '@/hooks/usePlayer';
import { useI18n } from '@/i18n';
import { cn } from '@/utils/cn';

const TABS = ['upcoming', 'completed', 'cancelled'];
const FILTER_KEYS = ['search', 'competition', 'from', 'to', 'status'];

export default function Matches() {
  const { t } = useI18n();
  usePageTitle(t('matches.title'));
  const toOptions = useOptions();
  const competitionOptions = useCompetitionOptions();
  const { data: me } = usePlayer();
  const { params, set, reset } = useListParams({ tab: 'upcoming' });
  const tab = TABS.includes(params.tab) ? params.tab : 'upcoming';
  const counts = useMatchCounts();
  const list = useMatches({ tab, search: params.search, competitionId: params.competition, from: params.from, to: params.to, status: params.status, page: params.page, pageSize: 8 });
  const filtersActive = FILTER_KEYS.some((k) => params[k]);

  return (
    <>
      <PageHeader title={t('matches.title')} description={t('matches.description')} />
      <Tabs
        className="mb-4"
        label={t('matches.title')}
        value={tab}
        onChange={(v) => set({ tab: v, status: '' })}
        tabs={TABS.map((k) => ({ value: k, label: t(`matches.playerTabs.${k}`), count: counts.data?.[k] }))}
      />
      <Card className="mb-4 p-3 sm:mb-6 sm:p-4">
        <FilterBar
          search={params.search ?? ''}
          onSearch={(v) => set({ search: v })}
          searchPlaceholder={t('matches.searchPlaceholder')}
          filters={[
            { key: 'competition', label: t('matches.filters.competition'), options: [...competitionOptions, { value: 'friendly', label: t('matches.friendly') }], placeholder: t('matches.allCompetitions'), className: 'sm:min-w-48' },
            ...(tab === 'upcoming' ? [{ key: 'status', label: t('matches.filters.status'), options: toOptions(['scheduled', 'live'], 'status'), placeholder: t('common.allStatuses') }] : []),
            { key: 'from', label: t('matches.filters.from'), type: 'date', className: 'sm:w-40' },
            { key: 'to', label: t('matches.filters.to'), type: 'date', className: 'sm:w-40' },
          ]}
          values={params}
          onChange={set}
          onReset={() => reset(FILTER_KEYS)}
        />
      </Card>
      {list.error ? (
        <div className="card">
          <ErrorState error={list.error} onRetry={list.refetch} />
        </div>
      ) : list.loading ? (
        <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3" role="status" aria-label={t('common.loading')}>
          {[0, 1, 2, 3].map((i) => (
            <CardSkeleton key={i} lines={4} />
          ))}
        </div>
      ) : list.data.data.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={Goal}
            title={filtersActive ? t('matches.empty.title') : t(tab === 'upcoming' ? 'matches.empty.upcomingTitle' : 'matches.empty.title')}
            description={filtersActive ? t('matches.empty.description') : undefined}
            action={filtersActive && <Button variant="secondary" onClick={() => reset(FILTER_KEYS)}>{t('common.reset')}</Button>}
          />
        </div>
      ) : (
        <>
          <div className={cn('grid gap-4 lg:grid-cols-2 2xl:grid-cols-3', list.fetching && 'opacity-60')}>
            {list.data.data.map((m) => (
              <MatchCard key={m.id} match={m} myTeamId={me?.team?.id} />
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
