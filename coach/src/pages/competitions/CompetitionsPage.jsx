import { useNavigate } from 'react-router-dom';
import { MapPin, Trophy } from 'lucide-react';
import TeamLogo from '@/components/common/TeamLogo';
import Badge, { StatusBadge } from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import DataTable from '@/components/ui/DataTable';
import FilterBar from '@/components/ui/FilterBar';
import { Meter } from '@/components/ui/Misc';
import PageHeader from '@/components/ui/PageHeader';
import Pagination from '@/components/ui/Pagination';
import { EmptyState, ErrorState } from '@/components/ui/States';
import { useListParams } from '@/hooks/useListParams';
import { useOptions, useSeasonOptions } from '@/hooks/useOptions';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useQuery } from '@/hooks/useQuery';
import { useI18n } from '@/i18n';
import { competitionService } from '@/services/competitionService';
import { COMPETITION_STATUSES, COMPETITION_TYPES, PAGE_SIZE } from '@/utils/constants';
import { formatDate } from '@/utils/format';

const TYPE_TONE = { league: 'brand', cup: 'warning', tournament: 'info' };

function MyTeams({ teams }) {
  return (
    <span className="flex flex-wrap gap-1.5">
      {teams.map((tm) => (
        <span key={tm.id} className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-800 dark:bg-brand-500/10 dark:text-brand-200">
          <TeamLogo team={tm} size="xs" className="size-4" />
          {tm.short_name}
        </span>
      ))}
    </span>
  );
}

export default function CompetitionsPage() {
  const { t, lang } = useI18n();
  usePageTitle(t('competitions.title'));
  const navigate = useNavigate();
  const toOptions = useOptions();
  const seasons = useSeasonOptions();
  const { params, set, reset } = useListParams();
  const list = useQuery(
    () => competitionService.list({ search: params.search, status: params.status, type: params.type, season: params.season, page: params.page, pageSize: PAGE_SIZE }),
    [params.search, params.status, params.type, params.season, params.page],
  );

  const dates = (c) => `${formatDate(c.start_date, lang, { day: 'numeric', month: 'short' })} – ${formatDate(c.end_date, lang)}`;
  const columns = [
    {
      key: 'name',
      header: t('competitions.columns.competition'),
      render: (c) => (
        <div className="flex items-center gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-300">
            <Trophy className="size-5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="truncate font-medium text-ink">
              {c.name} <span className="text-ink-3">{c.season}</span>
            </p>
            <p className="flex items-center gap-1 truncate text-xs text-ink-3">
              <MapPin className="size-3 shrink-0" aria-hidden="true" />
              <span className="truncate">{c.location}</span>
            </p>
          </div>
        </div>
      ),
    },
    { key: 'type', header: t('competitions.columns.type'), render: (c) => <Badge tone={TYPE_TONE[c.type]}>{t(`competitionTypes.${c.type}`)}</Badge> },
    { key: 'dates', header: t('competitions.columns.dates'), render: (c) => <span className="whitespace-nowrap tabular">{dates(c)}</span> },
    { key: 'mine', header: t('competitions.myTeams'), render: (c) => <MyTeams teams={c.my_teams} /> },
    {
      key: 'progress',
      header: t('competitions.columns.progress'),
      render: (c) => (
        <div className="w-28">
          <p className="mb-1 text-xs text-ink-3 tabular">{t('competitions.progress', { played: c.matches_completed, total: c.matches_total })}</p>
          <Meter value={c.matches_total ? (c.matches_completed / c.matches_total) * 100 : 0} tone="brand" size="sm" label={t('competitions.columns.progress')} />
        </div>
      ),
    },
    { key: 'status', header: t('competitions.columns.status'), render: (c) => <StatusBadge value={c.status} /> },
  ];
  const filtersActive = params.search || params.status || params.type || params.season;

  return (
    <>
      <PageHeader title={t('competitions.title')} description={t('competitions.description')} actions={<Badge tone="neutral">{t('common.readOnly')}</Badge>} />
      <Card>
        <div className="border-b border-line p-3 sm:p-4">
          <FilterBar
            search={params.search ?? ''}
            onSearch={(v) => set({ search: v })}
            searchPlaceholder={t('competitions.searchPlaceholder')}
            filters={[
              { key: 'type', label: t('competitions.columns.type'), options: toOptions(COMPETITION_TYPES, 'competitionTypes'), placeholder: t('competitions.allTypes') },
              { key: 'season', label: t('common.season'), options: seasons, placeholder: t('competitions.allSeasons') },
              { key: 'status', label: t('common.status'), options: toOptions(COMPETITION_STATUSES, 'status'), placeholder: t('common.allStatuses') },
            ]}
            values={params}
            onChange={set}
            onReset={() => reset()}
          />
        </div>
        {list.error ? (
          <ErrorState error={list.error} onRetry={list.refetch} />
        ) : (
          <DataTable
            caption={t('competitions.title')}
            columns={columns}
            rows={list.data?.data}
            loading={list.loading}
            fetching={list.fetching}
            onRowClick={(c) => navigate(`/coach/competitions/${c.id}`)}
            empty={<EmptyState icon={Trophy} title={t('competitions.empty.title')} description={t('competitions.empty.description')} action={filtersActive && <Button variant="secondary" onClick={() => reset()}>{t('common.reset')}</Button>} />}
            mobileCard={(c) => (
              <div className="flex items-start gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-300">
                  <Trophy className="size-5" aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-ink">
                    {c.name} <span className="text-ink-3">{c.season}</span>
                  </p>
                  <p className="text-xs text-ink-3 tabular">{dates(c)}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <StatusBadge value={c.status} />
                    <MyTeams teams={c.my_teams} />
                  </div>
                </div>
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
    </>
  );
}
