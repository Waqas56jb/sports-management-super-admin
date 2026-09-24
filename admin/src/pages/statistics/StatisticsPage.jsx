import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Activity, BarChart3, CalendarCheck, Goal, Info, Square, Star, Timer } from 'lucide-react';
import ChartCard from '@/components/charts/ChartCard';
import { ChartLegend } from '@/components/charts/ChartParts';
import { GroupedTeamBars } from '@/components/charts/TeamCharts';
import TopPlayersChart from '@/components/charts/TopPlayersChart';
import PersonCell from '@/components/common/PersonCell';
import { TeamChip } from '@/components/common/TeamLogo';
import { Card } from '@/components/ui/Card';
import DataTable from '@/components/ui/DataTable';
import FilterBar from '@/components/ui/FilterBar';
import PageHeader from '@/components/ui/PageHeader';
import Pagination from '@/components/ui/Pagination';
import { StatSkeleton } from '@/components/ui/Skeleton';
import StatCard from '@/components/ui/StatCard';
import { EmptyState, ErrorState } from '@/components/ui/States';
import { useListParams } from '@/hooks/useListParams';
import { useCompetitionOptions, useOptions, useSeasonOptions, useTeamOptions } from '@/hooks/useOptions';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useQuery } from '@/hooks/useQuery';
import { useI18n } from '@/i18n';
import { statisticsService } from '@/services/statisticsService';
import { PAGE_SIZE, POSITIONS } from '@/utils/constants';
import { formatNumber, formatPercent } from '@/utils/format';

export default function StatisticsPage() {
  const { t, lang } = useI18n();
  usePageTitle(t('statistics.title'));
  const navigate = useNavigate();
  const toOptions = useOptions();
  const { teams, teamOptions } = useTeamOptions();
  const { competitionOptions } = useCompetitionOptions();
  const seasons = useSeasonOptions();
  const { params, set, reset } = useListParams({ sort: 'goals', dir: 'desc' });

  const query = useQuery(
    () =>
      statisticsService.players({
        teamId: params.team,
        competitionId: params.competition,
        season: params.season,
        position: params.position,
        search: params.search,
        sort: params.sort,
        dir: params.dir,
        page: params.page,
        pageSize: PAGE_SIZE,
      }),
    [params.team, params.competition, params.season, params.position, params.search, params.sort, params.dir, params.page],
  );
  const d = query.data;

  const series = [
    { key: 'goals', label: t('statistics.charts.goals'), color: 'var(--chart-1)' },
    { key: 'assists', label: t('statistics.charts.assists'), color: 'var(--chart-2)' },
  ];
  const topScorers = useMemo(() => (d?.all ?? []).filter((r) => r.goals + r.assists > 0).sort((a, b) => b.goals - a.goals || b.assists - a.assists).slice(0, 8), [d]);
  const byTeam = useMemo(() => {
    const visible = params.team ? teams.filter((tm) => tm.id === params.team) : teams;
    return visible.map((tm) => {
      const rows = (d?.all ?? []).filter((r) => r.team?.id === tm.id);
      return { team: tm, goals: rows.reduce((s, r) => s + r.goals, 0), assists: rows.reduce((s, r) => s + r.assists, 0) };
    });
  }, [d, teams, params.team]);

  const num = (key, strong) => (r) => <span className={strong ? 'font-semibold text-ink tabular' : 'tabular'}>{r[key]}</span>;
  const abbr = (short, full) => <abbr title={full} className="no-underline">{short}</abbr>;
  const columns = [
    { key: 'player', header: t('statistics.columns.player'), render: (r) => <PersonCell name={r.player.name} photo={r.player.photo} sub={t(`positions.${r.player.position}`)} to={`/admin/players/${r.player.id}`} size="sm" /> },
    { key: 'team', header: t('statistics.columns.team'), render: (r) => <TeamChip team={r.team} /> },
    { key: 'matches_played', header: abbr(t('statistics.columns.matchesShort'), t('statistics.columns.matches')), sortable: true, align: 'right', render: num('matches_played') },
    { key: 'minutes_played', header: t('statistics.columns.minutes'), sortable: true, align: 'right', render: (r) => <span className="tabular">{formatNumber(r.minutes_played, lang)}</span> },
    { key: 'goals', header: abbr(t('statistics.columns.goalsShort'), t('statistics.columns.goals')), sortable: true, align: 'right', render: num('goals', true) },
    { key: 'assists', header: abbr(t('statistics.columns.assistsShort'), t('statistics.columns.assists')), sortable: true, align: 'right', render: num('assists') },
    { key: 'yellow_cards', header: abbr(t('statistics.columns.yellowShort'), t('statistics.columns.yellow')), sortable: true, align: 'right', render: num('yellow_cards') },
    { key: 'red_cards', header: abbr(t('statistics.columns.redShort'), t('statistics.columns.red')), sortable: true, align: 'right', render: num('red_cards') },
    { key: 'rating', header: t('statistics.columns.rating'), sortable: true, align: 'right', render: (r) => <span className="inline-block min-w-11 rounded-md bg-brand-50 px-2 py-0.5 text-center font-semibold text-brand-800 tabular dark:bg-brand-500/15 dark:text-brand-200">{r.rating?.toFixed(1) ?? '—'}</span> },
    { key: 'attendance_rate', header: t('statistics.columns.attendance'), sortable: true, align: 'right', render: (r) => <span className="tabular">{r.attendance_rate != null ? formatPercent(r.attendance_rate, lang) : '—'}</span> },
  ];

  const filtersActive = params.team || params.competition || params.season || params.position || params.search;

  return (
    <>
      <PageHeader title={t('statistics.title')} description={t('statistics.description')} />
      <Card className="mb-4 p-3 sm:mb-6 sm:p-4">
        <FilterBar
          search={params.search ?? ''}
          onSearch={(v) => set({ search: v })}
          searchPlaceholder={t('statistics.searchPlaceholder')}
          filters={[
            { key: 'team', label: t('common.team'), options: teamOptions, placeholder: t('common.allTeams'), className: 'sm:min-w-36' },
            { key: 'competition', label: t('common.competition'), options: competitionOptions, placeholder: t('statistics.allCompetitions'), className: 'sm:min-w-44' },
            { key: 'season', label: t('common.season'), options: seasons, placeholder: t('statistics.allSeasons'), className: 'sm:min-w-36' },
            { key: 'position', label: t('common.position'), options: toOptions(POSITIONS, 'positions'), placeholder: t('statistics.allPositions'), className: 'sm:min-w-36' },
          ]}
          values={params}
          onChange={set}
          onReset={() => reset(['team', 'competition', 'season', 'position', 'search'])}
        />
      </Card>

      {query.error ? (
        <div className="card">
          <ErrorState error={query.error} onRetry={query.refetch} />
        </div>
      ) : (
        <>
          <section className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-6" aria-label={t('statistics.title')}>
            {!d ? (
              Array.from({ length: 6 }, (_, i) => <StatSkeleton key={i} />)
            ) : (
              <>
                <StatCard label={t('statistics.kpi.goals')} value={formatNumber(d.totals.goals, lang)} icon={Goal} tone="brand" sub={t('statistics.kpi.players', { count: d.totals.players })} />
                <StatCard label={t('statistics.kpi.assists')} value={formatNumber(d.totals.assists, lang)} icon={Star} tone="sky" />
                <StatCard label={t('statistics.kpi.appearances')} value={formatNumber(d.totals.appearances, lang)} icon={Activity} tone="violet" />
                <StatCard label={t('statistics.kpi.minutes')} value={formatNumber(d.totals.minutes_played, lang)} icon={Timer} tone="slate" />
                <StatCard label={t('statistics.kpi.cards')} value={`${d.totals.yellow_cards} / ${d.totals.red_cards}`} icon={Square} tone="amber" />
                <StatCard label={t('statistics.kpi.rating')} value={d.totals.avg_rating?.toFixed(2) ?? '—'} icon={BarChart3} tone="rose" sub={d.totals.avg_attendance != null ? `${t('statistics.kpi.attendance')} ${formatPercent(d.totals.avg_attendance, lang)}` : undefined} />
              </>
            )}
          </section>

          <div className="mt-4 grid gap-4 sm:mt-6 sm:gap-6 xl:grid-cols-2">
            <ChartCard
              title={t('statistics.charts.topScorers')}
              subtitle={t('statistics.charts.topScorersSub')}
              loading={!d}
              empty={d && !topScorers.length}
              height={300}
              legend={<ChartLegend items={series.map((s) => ({ label: s.label, color: s.color }))} />}
              table={{
                columns: [{ key: 'player', label: t('statistics.columns.player') }, { key: 'goals', label: t('statistics.columns.goals'), align: 'right' }, { key: 'assists', label: t('statistics.columns.assists'), align: 'right' }],
                rows: topScorers.map((r) => ({ player: r.player.name, goals: r.goals, assists: r.assists })),
              }}
            >
              <TopPlayersChart rows={topScorers} series={series} />
            </ChartCard>
            <ChartCard
              title={t('statistics.charts.teamOutput')}
              subtitle={t('statistics.charts.teamOutputSub')}
              loading={!d}
              empty={d && !byTeam.some((r) => r.goals + r.assists)}
              height={300}
              legend={<ChartLegend items={series.map((s) => ({ label: s.label, color: s.color }))} />}
              table={{
                columns: [{ key: 'team', label: t('common.team') }, { key: 'goals', label: t('statistics.columns.goals'), align: 'right' }, { key: 'assists', label: t('statistics.columns.assists'), align: 'right' }],
                rows: byTeam.map((r) => ({ team: r.team.name, goals: r.goals, assists: r.assists })),
              }}
            >
              <GroupedTeamBars data={byTeam} series={series} />
            </ChartCard>
          </div>

          <Card className="mt-4 sm:mt-6">
            <DataTable
              caption={t('statistics.title')}
              columns={columns}
              rows={d?.data}
              loading={!d}
              fetching={query.fetching}
              rowKey={(r) => r.player_id}
              sort={params.sort}
              dir={params.dir}
              onSort={(sort, dir) => set({ sort, dir })}
              onRowClick={(r) => navigate(`/admin/players/${r.player_id}`)}
              empty={<EmptyState icon={BarChart3} title={t('statistics.empty.title')} description={t('statistics.empty.description')} action={filtersActive && <button type="button" className="text-sm font-medium text-brand-700 hover:underline dark:text-brand-300" onClick={() => reset()}>{t('common.reset')}</button>} />}
              mobileCard={(r) => (
                <div className="flex items-center gap-3">
                  <PersonCell name={r.player.name} photo={r.player.photo} sub={r.team?.name} className="flex-1" />
                  <dl className="grid grid-cols-3 gap-3 text-center text-xs">
                    <div>
                      <dt className="text-ink-3">{t('statistics.columns.goalsShort')}</dt>
                      <dd className="font-semibold text-ink tabular">{r.goals}</dd>
                    </div>
                    <div>
                      <dt className="text-ink-3">{t('statistics.columns.assistsShort')}</dt>
                      <dd className="font-semibold text-ink tabular">{r.assists}</dd>
                    </div>
                    <div>
                      <dt className="text-ink-3">{t('statistics.columns.rating')}</dt>
                      <dd className="font-semibold text-ink tabular">{r.rating?.toFixed(1) ?? '—'}</dd>
                    </div>
                  </dl>
                </div>
              )}
            />
            {d && d.total > 0 && (
              <div className="border-t border-line px-4 py-3 sm:px-5">
                <Pagination page={d.page} pages={d.pages} total={d.total} pageSize={d.pageSize} onChange={(page) => set({ page })} />
              </div>
            )}
          </Card>
          <p className="mt-3 flex items-start gap-2 text-xs text-ink-3">
            <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
            {t('statistics.note')}
          </p>
        </>
      )}
    </>
  );
}
