import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Plus, Shirt } from 'lucide-react';
import PersonCell from '@/components/common/PersonCell';
import RowActions from '@/components/common/RowActions';
import { TeamChip } from '@/components/common/TeamLogo';
import { StatusBadge } from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import DataTable from '@/components/ui/DataTable';
import FilterBar from '@/components/ui/FilterBar';
import PageHeader from '@/components/ui/PageHeader';
import Pagination from '@/components/ui/Pagination';
import { EmptyState, ErrorState } from '@/components/ui/States';
import { useListParams } from '@/hooks/useListParams';
import { useOptions, useTeamOptions } from '@/hooks/useOptions';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useQuery } from '@/hooks/useQuery';
import { useI18n } from '@/i18n';
import { playerService } from '@/services/playerService';
import { ACCOUNT_STATUSES, PAGE_SIZE, POSITIONS } from '@/utils/constants';
import { ageFrom, formatDate } from '@/utils/format';
import { usePlayerActions } from './usePlayerActions';

export default function PlayersPage() {
  const { t, lang } = useI18n();
  usePageTitle(t('players.title'));
  const navigate = useNavigate();
  const toOptions = useOptions();
  const { teams, teamOptions } = useTeamOptions();
  const { params, set, reset } = useListParams({ sort: 'name', dir: 'asc' });
  const [searchParams, setSearchParams] = useSearchParams();

  const list = useQuery(
    () =>
      playerService.list({
        search: params.search,
        teamId: params.team,
        position: params.position,
        status: params.status,
        page: params.page,
        pageSize: PAGE_SIZE,
        sort: params.sort,
        dir: params.dir,
      }),
    [params.search, params.team, params.position, params.status, params.page, params.sort, params.dir],
  );

  const { actionsFor, modals, openCreate } = usePlayerActions({ teams, onChanged: list.refetch });

  // Deep link from the dashboard quick action: /admin/players?new=1
  useEffect(() => {
    if (searchParams.get('new') === '1') {
      openCreate();
      searchParams.delete('new');
      setSearchParams(searchParams, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtersActive = params.search || params.team || params.position || params.status;

  const columns = [
    {
      key: 'name',
      header: t('players.columns.player'),
      sortable: true,
      render: (p) => <PersonCell name={p.name} photo={p.photo} sub={p.email} to={`/admin/players/${p.id}`} />,
    },
    { key: 'jersey_number', header: t('players.columns.number'), sortable: true, align: 'center', render: (p) => <span className="font-display text-lg font-bold text-ink tabular">{p.jersey_number ?? '—'}</span> },
    { key: 'position', header: t('players.columns.position'), sortable: true, render: (p) => t(`positions.${p.position}`) },
    { key: 'team_id', header: t('players.columns.team'), render: (p) => (p.team ? <TeamChip team={p.team} /> : <span className="text-ink-3">{t('players.noTeam')}</span>) },
    { key: 'date_of_birth', header: t('players.columns.age'), sortable: true, render: (p) => <span className="tabular">{ageFrom(p.date_of_birth) ?? '—'}</span> },
    { key: 'status', header: t('players.columns.status'), sortable: true, render: (p) => <StatusBadge value={p.status} /> },
    { key: 'registration_date', header: t('players.columns.registered'), sortable: true, render: (p) => <span className="tabular">{formatDate(p.registration_date, lang)}</span> },
    { key: 'actions', header: <span className="sr-only">{t('common.actions')}</span>, align: 'right', render: (p) => <RowActions items={actionsFor(p)} /> },
  ];

  return (
    <>
      <PageHeader
        title={t('players.title')}
        description={t('players.description')}
        actions={
          <Button icon={Plus} onClick={() => openCreate(params.team && params.team !== 'none' ? params.team : undefined)}>
            {t('players.add')}
          </Button>
        }
      />

      <Card>
        <div className="border-b border-line p-3 sm:p-4">
          <FilterBar
            search={params.search ?? ''}
            onSearch={(v) => set({ search: v })}
            searchPlaceholder={t('players.searchPlaceholder')}
            filters={[
              { key: 'team', label: t('players.filters.team'), options: [...teamOptions, { value: 'none', label: t('players.filters.withoutTeam') }], placeholder: t('common.allTeams') },
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
            onRowClick={(p) => navigate(`/admin/players/${p.id}`)}
            empty={
              filtersActive ? (
                <EmptyState icon={Shirt} title={t('players.empty.title')} description={t('players.empty.description')} action={<Button variant="secondary" onClick={() => reset()}>{t('common.reset')}</Button>} />
              ) : (
                <EmptyState icon={Shirt} title={t('players.empty.firstTitle')} description={t('players.empty.firstDescription')} action={<Button icon={Plus} onClick={() => openCreate()}>{t('players.add')}</Button>} />
              )
            }
            mobileCard={(p) => (
              <div className="flex items-center gap-3">
                <span className="w-8 shrink-0 text-center font-display text-xl font-bold text-ink-3 tabular">{p.jersey_number ?? '–'}</span>
                <div className="min-w-0 flex-1">
                  <PersonCell
                    name={p.name}
                    photo={p.photo}
                    sub={`${t(`positions.${p.position}`)} · ${p.team?.name ?? t('players.noTeam')}`}
                  />
                </div>
                <StatusBadge value={p.status} className="hidden min-[400px]:inline-flex" />
                <span onClick={(e) => e.stopPropagation()}>
                  <RowActions items={actionsFor(p)} />
                </span>
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
