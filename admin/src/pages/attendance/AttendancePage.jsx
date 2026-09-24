import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { CalendarCheck, CalendarX2, Clock, ShieldCheck, UserCheck } from 'lucide-react';
import ChartCard from '@/components/charts/ChartCard';
import RateBarChart from '@/components/charts/RateBarChart';
import { AttendanceTrendChart, TeamLegend } from '@/components/charts/TeamCharts';
import PersonCell from '@/components/common/PersonCell';
import { TeamChip } from '@/components/common/TeamLogo';
import TrainingTypeBadge from '@/components/common/TrainingTypeBadge';
import Badge, { StatusBadge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import DataTable from '@/components/ui/DataTable';
import FilterBar from '@/components/ui/FilterBar';
import { Meter } from '@/components/ui/Misc';
import PageHeader from '@/components/ui/PageHeader';
import Pagination from '@/components/ui/Pagination';
import { StatSkeleton } from '@/components/ui/Skeleton';
import StatCard from '@/components/ui/StatCard';
import { EmptyState, ErrorState } from '@/components/ui/States';
import Tabs from '@/components/ui/Tabs';
import { useListParams } from '@/hooks/useListParams';
import { useOptions, usePlayerOptions, useTeamOptions } from '@/hooks/useOptions';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useQuery } from '@/hooks/useQuery';
import { useI18n } from '@/i18n';
import { attendanceService } from '@/services/attendanceService';
import { ATTENDANCE_STATUSES, PAGE_SIZE } from '@/utils/constants';
import { formatNumber, formatPercent, formatShortDate, formatWeekday } from '@/utils/format';

function RateCell({ rate }) {
  const { lang } = useI18n();
  return (
    <div className="flex w-36 items-center gap-2">
      <Meter value={rate} size="sm" className="flex-1" />
      <span className="w-11 text-right text-sm font-semibold text-ink tabular">{formatPercent(rate, lang)}</span>
    </div>
  );
}

export default function AttendancePage() {
  const { t, lang } = useI18n();
  usePageTitle(t('attendance.title'));
  const navigate = useNavigate();
  const toOptions = useOptions();
  const { teams, teamOptions } = useTeamOptions();
  const { params, set, reset } = useListParams({ tab: 'players' });
  const players = usePlayerOptions({ teamId: params.team }, [params.team]);
  const scope = { teamId: params.team, playerId: params.player, from: params.from, to: params.to };

  const overview = useQuery(() => attendanceService.overview(scope), [params.team, params.player, params.from, params.to]);
  const records = useQuery(
    () => attendanceService.records({ ...scope, status: params.status, page: params.page, pageSize: PAGE_SIZE }),
    [params.team, params.player, params.from, params.to, params.status, params.page],
    { enabled: params.tab === 'records' },
  );

  const data = overview.data;
  const trendTeams = useMemo(() => (params.team ? teams.filter((tm) => tm.id === params.team) : teams), [teams, params.team]);

  const playerColumns = [
    { key: 'player', header: t('attendance.columns.player'), render: (r) => <PersonCell name={r.player.name} photo={r.player.photo} to={`/admin/players/${r.player.id}`} sub={t(`positions.${r.player.position}`)} size="sm" /> },
    { key: 'team', header: t('attendance.columns.team'), render: (r) => <TeamChip team={r.team} /> },
    { key: 'total', header: t('attendance.columns.sessions'), align: 'right', render: (r) => <span className="tabular">{r.total}</span> },
    ...['present', 'late', 'excused', 'absent'].map((k) => ({ key: k, header: t(`status.${k}`), align: 'right', render: (r) => <span className="tabular">{r[k]}</span> })),
    { key: 'rate', header: t('attendance.columns.rate'), render: (r) => (
      <div className="flex items-center gap-2">
        <RateCell rate={r.rate} />
        {r.rate < 75 && <Badge tone="danger">{t('attendance.needsAttention')}</Badge>}
      </div>
    ) },
  ];

  const sessionColumns = [
    { key: 'date', header: t('attendance.columns.date'), render: (r) => <span className="capitalize">{formatWeekday(r.session.date, lang)}</span> },
    { key: 'team', header: t('attendance.columns.team'), render: (r) => <TeamChip team={r.session.team} /> },
    { key: 'session', header: t('attendance.columns.session'), render: (r) => <TrainingTypeBadge type={r.session.training_type} /> },
    ...['present', 'late', 'excused', 'absent'].map((k) => ({ key: k, header: t(`status.${k}`), align: 'right', render: (r) => <span className="tabular">{r[k]}</span> })),
    { key: 'rate', header: t('attendance.columns.rate'), render: (r) => <RateCell rate={r.rate} /> },
  ];

  const recordColumns = [
    { key: 'date', header: t('attendance.columns.date'), render: (r) => <span className="capitalize">{formatWeekday(r.session.date, lang)}</span> },
    { key: 'player', header: t('attendance.columns.player'), render: (r) => <PersonCell name={r.player?.name} photo={r.player?.photo} size="sm" /> },
    { key: 'team', header: t('attendance.columns.team'), render: (r) => <TeamChip team={r.session.team} /> },
    { key: 'session', header: t('attendance.columns.session'), render: (r) => t(`trainingTypes.${r.session.training_type}`) },
    { key: 'status', header: t('attendance.columns.status'), render: (r) => <StatusBadge value={r.status} /> },
    { key: 'notes', header: t('attendance.columns.notes'), className: 'max-w-60', render: (r) => <span className="line-clamp-2 text-ink-3">{r.notes || '—'}</span> },
  ];

  const empty = <EmptyState icon={CalendarCheck} title={t('attendance.empty.title')} description={t('attendance.empty.description')} />;
  const s = data?.summary;

  return (
    <>
      <PageHeader title={t('attendance.title')} description={t('attendance.description')} />

      <Card className="mb-4 p-3 sm:mb-6 sm:p-4">
        <FilterBar
          filters={[
            { key: 'team', label: t('common.team'), options: teamOptions, placeholder: t('common.allTeams') },
            { key: 'player', label: t('attendance.filters.player'), options: players.map((p) => ({ value: p.id, label: p.name })), placeholder: t('attendance.filters.allPlayers'), className: 'sm:min-w-48' },
            { key: 'status', label: t('common.status'), options: toOptions(ATTENDANCE_STATUSES, 'status'), placeholder: t('common.allStatuses') },
            { key: 'from', label: t('common.from'), type: 'date', className: 'sm:w-40' },
            { key: 'to', label: t('common.to'), type: 'date', className: 'sm:w-40' },
          ]}
          values={params}
          onChange={(patch) => set(patch.team !== undefined && patch.team !== params.team ? { ...patch, player: '' } : patch)}
          onReset={() => reset(['team', 'player', 'status', 'from', 'to'])}
        />
        {params.status && params.tab !== 'records' && <p className="mt-2 text-xs text-ink-3">{t('attendance.statusFilterHint')}</p>}
      </Card>

      {overview.error ? (
        <div className="card">
          <ErrorState error={overview.error} onRetry={overview.refetch} />
        </div>
      ) : (
        <>
          <section className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-5" aria-label={t('attendance.kpi.rate')}>
            {!s ? (
              Array.from({ length: 5 }, (_, i) => <StatSkeleton key={i} />)
            ) : (
              <>
                <StatCard className="col-span-2 lg:col-span-1" label={t('attendance.kpi.rate')} value={s.rate != null ? formatPercent(s.rate, lang) : '—'} icon={CalendarCheck} sub={t('attendance.kpi.rateSub')} />
                <StatCard label={t('attendance.kpi.present')} value={formatNumber(s.present, lang)} icon={UserCheck} tone="brand" />
                <StatCard label={t('attendance.kpi.late')} value={formatNumber(s.late, lang)} icon={Clock} tone="amber" />
                <StatCard label={t('attendance.kpi.excused')} value={formatNumber(s.excused, lang)} icon={ShieldCheck} tone="sky" />
                <StatCard label={t('attendance.kpi.absent')} value={formatNumber(s.absent, lang)} icon={CalendarX2} tone="rose" />
              </>
            )}
          </section>

          <div className="mt-4 grid gap-4 sm:mt-6 sm:gap-6 xl:grid-cols-3">
            <ChartCard
              className="xl:col-span-2"
              title={t('attendance.charts.trend')}
              subtitle={t('attendance.charts.trendSub')}
              loading={!data}
              empty={data && !data.trend.length}
              legend={<TeamLegend teams={trendTeams} />}
              table={
                data && {
                  columns: [{ key: 'week', label: t('common.date') }, ...trendTeams.map((tm) => ({ key: tm.id, label: tm.short_name, align: 'right' }))],
                  rows: data.trend.map((r) => ({ week: formatShortDate(r.week, lang), ...Object.fromEntries(trendTeams.map((tm) => [tm.id, r[tm.id] != null ? formatPercent(r[tm.id], lang) : '—'])) })),
                }
              }
            >
              {data && <AttendanceTrendChart data={data.trend} teams={trendTeams} />}
            </ChartCard>
            <ChartCard
              title={t('attendance.charts.byTeam')}
              subtitle={t('attendance.charts.byTeamSub')}
              loading={!data}
              empty={data && !data.byTeam.length}
              table={data && { columns: [{ key: 'team', label: t('common.team') }, { key: 'rate', label: t('attendance.charts.rate'), align: 'right' }], rows: data.byTeam.map((r) => ({ team: r.team.name, rate: formatPercent(r.rate, lang) })) }}
            >
              {data && <RateBarChart data={data.byTeam} label={t('attendance.charts.rate')} />}
            </ChartCard>
          </div>

          <Tabs
            className="mt-6"
            label={t('attendance.title')}
            value={params.tab}
            onChange={(v) => set({ tab: v })}
            tabs={[
              { value: 'players', label: t('attendance.tabs.players'), count: data?.players.length },
              { value: 'sessions', label: t('attendance.tabs.sessions'), count: data?.sessions.length },
              { value: 'records', label: t('attendance.tabs.records') },
            ]}
          />
          <Card className="mt-4">
            {params.tab === 'players' && (
              <DataTable
                caption={t('attendance.tabs.players')}
                columns={playerColumns}
                rows={data?.players.slice(0, 50)}
                loading={!data}
                rowKey={(r) => r.player.id}
                empty={empty}
                onRowClick={(r) => navigate(`/admin/players/${r.player.id}`)}
                mobileCard={(r) => (
                  <div className="flex items-center gap-3">
                    <PersonCell name={r.player.name} photo={r.player.photo} sub={`${r.team?.name ?? ''} · ${r.total} ${t('attendance.columns.sessions').toLowerCase()}`} className="flex-1" />
                    <span className="text-sm font-semibold text-ink tabular">{formatPercent(r.rate, lang)}</span>
                  </div>
                )}
              />
            )}
            {params.tab === 'sessions' && (
              <DataTable
                caption={t('attendance.tabs.sessions')}
                columns={sessionColumns}
                rows={data?.sessions.slice(0, 50)}
                loading={!data}
                rowKey={(r) => r.session.id}
                empty={empty}
                onRowClick={(r) => navigate(`/admin/training/${r.session.id}`)}
                mobileCard={(r) => (
                  <div className="flex items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <TeamChip team={r.session.team} link={false} />
                      <p className="mt-1 text-xs capitalize text-ink-3">
                        {formatWeekday(r.session.date, lang)} · {t(`trainingTypes.${r.session.training_type}`)}
                      </p>
                    </div>
                    <span className="text-sm font-semibold text-ink tabular">{formatPercent(r.rate, lang)}</span>
                  </div>
                )}
              />
            )}
            {params.tab === 'records' &&
              (records.error ? (
                <ErrorState error={records.error} onRetry={records.refetch} />
              ) : (
                <>
                  <DataTable
                    caption={t('attendance.tabs.records')}
                    columns={recordColumns}
                    rows={records.data?.data}
                    loading={records.loading}
                    fetching={records.fetching}
                    empty={empty}
                    mobileCard={(r) => (
                      <div className="flex items-center gap-3">
                        <PersonCell name={r.player?.name} photo={r.player?.photo} sub={`${formatShortDate(r.session.date, lang)} · ${t(`trainingTypes.${r.session.training_type}`)}${r.notes ? ` · ${r.notes}` : ''}`} className="flex-1" />
                        <StatusBadge value={r.status} />
                      </div>
                    )}
                  />
                  {records.data && records.data.total > 0 && (
                    <div className="border-t border-line px-4 py-3 sm:px-5">
                      <Pagination page={records.data.page} pages={records.data.pages} total={records.data.total} pageSize={records.data.pageSize} onChange={(page) => set({ page })} />
                    </div>
                  )}
                </>
              ))}
          </Card>
        </>
      )}
    </>
  );
}
