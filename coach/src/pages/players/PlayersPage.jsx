import { useNavigate } from 'react-router-dom';
import { Eye, Shirt } from 'lucide-react';
import PersonCell from '@/components/common/PersonCell';
import { TeamChip } from '@/components/common/TeamLogo';
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
import { useOptions } from '@/hooks/useOptions';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useQuery } from '@/hooks/useQuery';
import { useTeams } from '@/hooks/useTeams';
import { useI18n } from '@/i18n';
import { playerService } from '@/services/playerService';
import { ACCOUNT_STATUSES, PAGE_SIZE, POSITIONS } from '@/utils/constants';
import { ageFrom, formatPercent } from '@/utils/format';

export default function PlayersPage() {
  const { t, lang } = useI18n();
  usePageTitle(t('players.title'));
  const navigate = useNavigate();
  const toOptions = useOptions();
  const { teamOptions } = useTeams();
  const { params, set, reset } = useListParams({ sort: 'name', dir: 'asc' });

  const list = useQuery(
    () => playerService.list({ search: params.search, teamId: params.team, position: params.position, status: params.status, page: params.page, pageSize: PAGE_SIZE, sort: params.sort, dir: params.dir }),
    [params.search, params.team, params.position, params.status, params.page, params.sort, params.dir],
  );
  const filtersActive = params.search || params.team || params.position || params.status;

  const columns = [
    { key: 'name', header: t('players.columns.player'), sortable: true, render: (p) => <PersonCell name={p.name} photo={p.photo} sub={t(`positions.${p.position}`)} to={`/coach/players/${p.id}`} /> },
    { key: 'jersey_number', header: t('players.columns.number'), sortable: true, align: 'center', render: (p) => <span className="font-display text-lg font-bold text-ink tabular">{p.jersey_number ?? '—'}</span> },
    { key: 'team_id', header: t('players.columns.team'), render: (p) => <TeamChip team={p.team} /> },
    { key: 'date_of_birth', header: t('players.columns.age'), sortable: true, align: 'right', render: (p) => <span className="tabular">{ageFrom(p.date_of_birth) ?? '—'}</span> },
    { key: 'status', header: t('players.columns.status'), sortable: true, render: (p) => <StatusBadge value={p.status} /> },
    { key: 'goals', header: t('players.columns.goals'), sortable: true, align: 'right', render: (p) => <span className="tabular">{p.goals}</span> },
    {
      key: 'attendance_rate',
      header: t('players.columns.attendance'),
      sortable: true,
      render: (p) =>
        p.attendance_rate != null ? (
          <div className="flex w-28 items-center gap-2">
            <Meter value={p.attendance_rate} size="sm" className="flex-1" />
            <span className="w-10 text-right text-xs font-semibold text-ink tabular">{formatPercent(p.attendance_rate, lang)}</span>
          </div>
        ) : (
          '—'
        ),
    },
    {
      key: 'rating',
      header: t('players.columns.rating'),
      sortable: true,
      align: 'right',
      render: (p) => (p.rating ? <span className="rounded-md bg-brand-50 px-2 py-0.5 font-semibold text-brand-800 tabular dark:bg-brand-500/15 dark:text-brand-200">{p.rating.toFixed(1)}</span> : '—'),
    },
    {
      key: 'view',
      header: <span className="sr-only">{t('common.actions')}</span>,
      align: 'right',
      render: (p) => (
        <Button variant="ghost" size="icon-sm" to={`/coach/players/${p.id}`} aria-label={`${t('players.actions.view')} — ${p.name}`} onClick={(e) => e.stopPropagation()}>
          <Eye className="size-4" />
        </Button>
      ),
    },
  ];

  return (
    <>
      <PageHeader title={t('players.title')} description={t('players.description')} actions={<Badge tone="neutral">{t('common.readOnly')}</Badge>} />
      <Card>
        <div className="border-b border-line p-3 sm:p-4">
          <FilterBar
            search={params.search ?? ''}
            onSearch={(v) => set({ search: v })}
            searchPlaceholder={t('players.searchPlaceholder')}
            filters={[
              { key: 'team', label: t('players.filters.team'), options: teamOptions, placeholder: t('common.allTeams') },
              { key: 'position', label: t('players.filters.position'), options: toOptions(POSITIONS, 'positions'), placeholder: t('players.filters.allPositions') },
              { key: 'status', label: t('players.filters.status'), options: toOptions(ACCOUNT_STATUSES, 'status'), placeholder: t('common.allStatuses'), className: 'sm:min-w-36' },
            ]}
            values={params}
            onChange={set}
            onReset={() => reset(['team', 'position', 'status', 'search'])}
          />
        </div>
        {list.error ? (
          <ErrorState error={list.error} onRetry={list.refetch} />
        ) : (
          <DataTable
            caption={t('players.title')}
            columns={columns}
            rows={list.data?.data}
            loading={list.loading}
            fetching={list.fetching}
            sort={params.sort}
            dir={params.dir}
            onSort={(sort, dir) => set({ sort, dir })}
            onRowClick={(p) => navigate(`/coach/players/${p.id}`)}
            empty={
              filtersActive ? (
                <EmptyState icon={Shirt} title={t('players.empty.title')} description={t('players.empty.description')} action={<Button variant="secondary" onClick={() => reset()}>{t('common.reset')}</Button>} />
              ) : (
                <EmptyState icon={Shirt} title={t('players.empty.firstTitle')} description={t('players.empty.firstDescription')} />
              )
            }
            mobileCard={(p) => (
              <div className="flex items-center gap-3">
                <span className="w-8 shrink-0 text-center font-display text-xl font-bold text-ink-3 tabular">{p.jersey_number ?? '–'}</span>
                <PersonCell className="min-w-0 flex-1" name={p.name} photo={p.photo} sub={`${t(`positions.${p.position}`)} · ${p.team?.short_name ?? ''}${p.attendance_rate != null ? ` · ${formatPercent(p.attendance_rate, lang)}` : ''}`} />
                {p.status !== 'active' ? (
                  <StatusBadge value={p.status} />
                ) : p.rating ? (
                  <span className="rounded-md bg-brand-50 px-2 py-0.5 text-sm font-semibold text-brand-800 tabular dark:bg-brand-500/15 dark:text-brand-200">{p.rating.toFixed(1)}</span>
                ) : null}
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
