import { useNavigate } from 'react-router-dom';
import { MapPin, Plus, Trophy } from 'lucide-react';
import RowActions from '@/components/common/RowActions';
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
import { useOptions, useSeasonOptions, useTeamOptions } from '@/hooks/useOptions';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useQuery } from '@/hooks/useQuery';
import { useI18n } from '@/i18n';
import { competitionService } from '@/services/competitionService';
import { COMPETITION_STATUSES, COMPETITION_TYPES, PAGE_SIZE } from '@/utils/constants';
import { formatDate } from '@/utils/format';
import { useCompetitionActions } from './useCompetitionActions';

const TYPE_TONE = { league: 'brand', cup: 'warning', tournament: 'info' };

function TeamStack({ teams }) {
  return (
    <span className="flex -space-x-1.5">
      {teams.slice(0, 5).map((tm) => (
        <span key={tm.id} className="rounded-full bg-surface p-0.5" title={tm.name}>
          <TeamLogo team={tm} size="sm" />
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
  const { teams } = useTeamOptions();
  const { params, set, reset } = useListParams({ sort: 'start_date', dir: 'desc' });
  const list = useQuery(
    () => competitionService.list({ search: params.search, status: params.status, type: params.type, season: params.season, page: params.page, pageSize: PAGE_SIZE, sort: params.sort, dir: params.dir }),
    [params.search, params.status, params.type, params.season, params.page, params.sort, params.dir],
  );
  const { actionsFor, modals, openCreate } = useCompetitionActions({ teams, onChanged: list.refetch });

  const dates = (c) => `${formatDate(c.start_date, lang, { day: 'numeric', month: 'short' })} – ${formatDate(c.end_date, lang)}`;
  const progress = (c) => (
    <div className="w-28">
      <p className="mb-1 text-xs text-ink-3 tabular">{t('competitions.progress', { played: c.matches_completed, total: c.matches_total })}</p>
      <Meter value={c.matches_total ? (c.matches_completed / c.matches_total) * 100 : 0} tone="brand" size="sm" label={t('competitions.columns.progress')} />
    </div>
  );

  const columns = [
    {
      key: 'name',
      header: t('competitions.columns.competition'),
      sortable: true,
      render: (c) => (
        <div className="flex items-center gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-300">
            <Trophy className="size-5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="truncate font-medium text-ink">{c.name}</p>
            <p className="flex items-center gap-1 truncate text-xs text-ink-3">
              {c.season} · <MapPin className="size-3 shrink-0" aria-hidden="true" />
              <span className="truncate">{c.location}</span>
            </p>
          </div>
        </div>
      ),
    },
    { key: 'type', header: t('competitions.columns.type'), sortable: true, render: (c) => <Badge tone={TYPE_TONE[c.type]}>{t(`competitionTypes.${c.type}`)}</Badge> },
    { key: 'start_date', header: t('competitions.columns.dates'), sortable: true, render: (c) => <span className="whitespace-nowrap tabular">{dates(c)}</span> },
    { key: 'teams', header: t('competitions.columns.teams'), render: (c) => <TeamStack teams={c.teams} /> },
    { key: 'progress', header: t('competitions.columns.progress'), render: progress },
    { key: 'status', header: t('competitions.columns.status'), sortable: true, render: (c) => <StatusBadge value={c.status} /> },
    { key: 'actions', header: <span className="sr-only">{t('common.actions')}</span>, align: 'right', render: (c) => <RowActions items={actionsFor(c)} /> },
  ];

  const filtersActive = params.search || params.status || params.type || params.season;

  return (
    <>
      <PageHeader
        title={t('competitions.title')}
        description={t('competitions.description')}
        actions={
          <Button icon={Plus} onClick={openCreate}>
            {t('competitions.add')}
          </Button>
        }
      />
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
            onReset={() => reset(['type', 'season', 'status', 'search'])}
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
            sort={params.sort}
            dir={params.dir}
            onSort={(sort, dir) => set({ sort, dir })}
            onRowClick={(c) => navigate(`/admin/competitions/${c.id}`)}
            empty={
              <EmptyState
                icon={Trophy}
                title={t('competitions.empty.title')}
                description={t('competitions.empty.description')}
                action={filtersActive ? <Button variant="secondary" onClick={() => reset()}>{t('common.reset')}</Button> : <Button icon={Plus} onClick={openCreate}>{t('competitions.add')}</Button>}
              />
            }
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
                    <Badge tone={TYPE_TONE[c.type]}>{t(`competitionTypes.${c.type}`)}</Badge>
                    <TeamStack teams={c.teams} />
                  </div>
                </div>
                <RowActions items={actionsFor(c)} />
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
