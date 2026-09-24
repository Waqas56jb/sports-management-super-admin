import { useNavigate } from 'react-router-dom';
import { Activity, BarChart3, Goal, Info, Square, Star, Timer } from 'lucide-react';
import ChartCard from '@/components/charts/ChartCard';
import { ChartLegend } from '@/components/charts/ChartParts';
import MatchGoalsChart from '@/components/charts/MatchGoalsChart';
import RateBarChart from '@/components/charts/RateBarChart';
import { MatchResultsChart, ResultsLegend, teamColor } from '@/components/charts/TeamCharts';
import TrendLineChart from '@/components/charts/TrendLineChart';
import PersonCell from '@/components/common/PersonCell';
import { TeamChip } from '@/components/common/TeamLogo';
import Button from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import DataTable from '@/components/ui/DataTable';
import FilterBar from '@/components/ui/FilterBar';
import { FormGuide } from '@/components/ui/Misc';
import PageHeader from '@/components/ui/PageHeader';
import Pagination from '@/components/ui/Pagination';
import { StatSkeleton } from '@/components/ui/Skeleton';
import StatCard from '@/components/ui/StatCard';
import { EmptyState, ErrorState } from '@/components/ui/States';
import Tabs from '@/components/ui/Tabs';
import { useListParams } from '@/hooks/useListParams';
import { useCompetitionOptions, useSeasonOptions } from '@/hooks/useOptions';
import { usePageTitle } from '@/hooks/usePageTitle';
import { usePlayers } from '@/hooks/usePlayers';
import { useQuery } from '@/hooks/useQuery';
import { useTeams } from '@/hooks/useTeams';
import { useI18n } from '@/i18n';
import { statisticsService } from '@/services/statisticsService';
import { PAGE_SIZE } from '@/utils/constants';
import { formatNumber, formatPercent, formatShortDate } from '@/utils/format';
import { useResultLabels } from '@/pages/teams/TeamsPage';

export default function StatisticsPage() {
  const { t, lang } = useI18n();
  usePageTitle(t('statistics.title'));
  const navigate = useNavigate();
  const labels = useResultLabels();
  const { teamOptions } = useTeams();
  const { players } = usePlayers({ teamId: undefined });
  const { competitionOptions } = useCompetitionOptions();
  const seasons = useSeasonOptions();
  const { params, set, reset } = useListParams({ tab: 'players', sort: 'goals', dir: 'desc' });
  const scope = { teamId: params.team, competitionId: params.competition, season: params.season, from: params.from, to: params.to };
  const deps = [params.team, params.competition, params.season, params.from, params.to];

  const playerStats = useQuery(
    () => statisticsService.players({ ...scope, playerId: params.player, sort: params.sort, dir: params.dir, page: params.page, pageSize: PAGE_SIZE }),
    [...deps, params.player, params.sort, params.dir, params.page],
  );
  const teamStats = useQuery(() => statisticsService.teams(scope), deps);
  const trend = useQuery(() => statisticsService.trend({ ...scope, playerId: params.player }), [...deps, params.player]);

  const d = playerStats.data;
  const tr = (trend.data ?? []).map((m) => ({ ...m, label: formatShortDate(m.date, lang), title: `${formatShortDate(m.date, lang)} · ${m.team.short_name} ${t('statistics.trend.vs', { team: m.opponent?.name })}` }));
  const goalSeries = [
    { key: 'goals_for', label: t('statistics.trend.scored'), color: 'var(--chart-1)' },
    { key: 'goals_against', label: t('statistics.trend.conceded'), color: 'var(--chart-2)' },
  ];
  const num = (key, strong) => (r) => <span className={strong ? 'font-semibold text-ink tabular' : 'tabular'}>{r[key]}</span>;
  const abbr = (short, full) => <abbr title={full} className="no-underline">{short}</abbr>;

  const playerColumns = [
    { key: 'player', header: t('statistics.columns.player'), render: (r) => <PersonCell name={r.player.name} photo={r.player.photo} sub={t(`positions.${r.player.position}`)} to={`/coach/players/${r.player.id}`} size="sm" /> },
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

  const teamColumns = [
    { key: 'team', header: t('statistics.teamColumns.team'), render: (r) => <TeamChip team={r.team} /> },
    { key: 'played', header: t('statistics.teamColumns.matches'), align: 'right', render: num('played') },
    { key: 'won', header: t('statistics.teamColumns.wins'), align: 'right', render: num('won') },
    { key: 'drawn', header: t('statistics.teamColumns.draws'), align: 'right', render: num('drawn') },
    { key: 'lost', header: t('statistics.teamColumns.losses'), align: 'right', render: num('lost') },
    { key: 'goals_for', header: t('statistics.teamColumns.scored'), align: 'right', render: num('goals_for', true) },
    { key: 'goals_against', header: t('statistics.teamColumns.conceded'), align: 'right', render: num('goals_against') },
    { key: 'points', header: t('statistics.teamColumns.points'), align: 'right', render: num('points', true) },
    { key: 'attendance_rate', header: t('statistics.teamColumns.attendance'), align: 'right', render: (r) => <span className="tabular">{r.attendance_rate != null ? formatPercent(r.attendance_rate, lang) : '—'}</span> },
    { key: 'form', header: t('statistics.teamColumns.form'), render: (r) => <FormGuide form={r.form} labels={labels} /> },
  ];

  const filtersActive = params.team || params.player || params.competition || params.season || params.from || params.to;
  const filteredPlayers = params.team ? players.filter((p) => p.team_id === params.team) : players;

  return (
    <>
      <PageHeader title={t('statistics.title')} description={t('statistics.description')} />
      <Card className="mb-4 p-3 sm:mb-6 sm:p-4">
        <FilterBar
          filters={[
            { key: 'team', label: t('common.team'), options: teamOptions, placeholder: t('common.allTeams'), className: 'sm:min-w-36' },
            { key: 'player', label: t('common.player'), options: filteredPlayers.map((p) => ({ value: p.id, label: p.name })), placeholder: t('statistics.allPlayers'), className: 'sm:min-w-40' },
            { key: 'competition', label: t('common.competition'), options: competitionOptions, placeholder: t('statistics.allCompetitions'), className: 'sm:min-w-44' },
            { key: 'season', label: t('common.season'), options: seasons, placeholder: t('statistics.allSeasons'), className: 'sm:min-w-32' },
            { key: 'from', label: t('common.from'), type: 'date', className: 'sm:w-40' },
            { key: 'to', label: t('common.to'), type: 'date', className: 'sm:w-40' },
          ]}
          values={params}
          onChange={(patch) => set(patch.team !== undefined && patch.team !== params.team ? { ...patch, player: '' } : patch)}
          onReset={() => reset(['team', 'player', 'competition', 'season', 'from', 'to'])}
        />
      </Card>

      {playerStats.error ? (
        <div className="card">
          <ErrorState error={playerStats.error} onRetry={playerStats.refetch} />
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
                <StatCard label={t('statistics.kpi.minutes')} value={formatNumber(d.totals.minutes_played, lang)} icon={Timer} tone="slate" />
                <StatCard label={t('statistics.kpi.cards')} value={`${d.totals.yellow_cards} / ${d.totals.red_cards}`} icon={Square} tone="amber" />
                <StatCard label={t('statistics.kpi.rating')} value={d.totals.avg_rating?.toFixed(2) ?? '—'} icon={BarChart3} tone="rose" />
                <StatCard label={t('statistics.kpi.attendance')} value={d.totals.avg_attendance != null ? formatPercent(d.totals.avg_attendance, lang) : '—'} icon={Activity} tone="violet" />
              </>
            )}
          </section>

          <div className="mt-4 grid gap-4 sm:mt-6 sm:gap-6 xl:grid-cols-2">
            <ChartCard
              title={t('statistics.trend.title')}
              subtitle={t('statistics.trend.subtitle')}
              loading={!trend.data}
              empty={trend.data && !tr.some((m) => m.rating != null)}
              height={240}
              table={{ columns: [{ key: 'title', label: t('common.date') }, { key: 'rating', label: t('statistics.trend.rating'), align: 'right' }], rows: tr.map((m) => ({ title: m.title, rating: m.rating?.toFixed(2) ?? '—' })) }}
            >
              <TrendLineChart data={tr} xKey="label" yKey="rating" name={t('statistics.trend.rating')} domain={[5, 9]} format={(v) => Number(v).toFixed(1)} labelFor={(v) => tr.find((m) => m.label === v)?.title ?? v} />
            </ChartCard>
            <ChartCard
              title={t('statistics.trend.goalsTitle')}
              subtitle={t('statistics.trend.goalsSubtitle')}
              loading={!trend.data}
              empty={trend.data && !tr.length}
              height={240}
              legend={<ChartLegend items={goalSeries.map((s) => ({ label: s.label, color: s.color }))} />}
              table={{ columns: [{ key: 'title', label: t('common.date') }, { key: 'goals_for', label: t('statistics.trend.scored'), align: 'right' }, { key: 'goals_against', label: t('statistics.trend.conceded'), align: 'right' }], rows: tr }}
            >
              <MatchGoalsChart rows={tr} series={goalSeries} />
            </ChartCard>
            <ChartCard
              title={t('statistics.trend.attendanceTitle')}
              subtitle={t('statistics.trend.attendanceSubtitle')}
              loading={!teamStats.data}
              empty={teamStats.data && !teamStats.data.some((r) => r.attendance_rate != null)}
              height={200}
              table={teamStats.data && { columns: [{ key: 'team', label: t('common.team') }, { key: 'rate', label: t('statistics.columns.attendance'), align: 'right' }], rows: teamStats.data.map((r) => ({ team: r.team.name, rate: r.attendance_rate != null ? formatPercent(r.attendance_rate, lang) : '—' })) }}
            >
              {teamStats.data && <RateBarChart rows={teamStats.data.map((r) => ({ label: r.team.name, value: r.attendance_rate ?? 0, color: teamColor(r.team) }))} label={t('statistics.columns.attendance')} format={(v) => formatPercent(v, lang)} />}
            </ChartCard>
            <ChartCard
              title={t('statistics.trend.resultsTitle')}
              subtitle={t('statistics.trend.resultsSubtitle')}
              loading={!teamStats.data}
              empty={teamStats.data && !teamStats.data.some((r) => r.played)}
              height={200}
              legend={<ResultsLegend />}
              table={teamStats.data && { columns: [{ key: 'team', label: t('common.team') }, { key: 'won', label: t('results.W'), align: 'right' }, { key: 'drawn', label: t('results.D'), align: 'right' }, { key: 'lost', label: t('results.L'), align: 'right' }], rows: teamStats.data.map((r) => ({ team: r.team.name, won: r.won, drawn: r.drawn, lost: r.lost })) }}
            >
              {teamStats.data && <MatchResultsChart data={teamStats.data} />}
            </ChartCard>
          </div>

          <Tabs
            className="mt-6"
            label={t('statistics.title')}
            value={params.tab}
            onChange={(v) => set({ tab: v })}
            tabs={[
              { value: 'players', label: t('statistics.tabs.players') },
              { value: 'teams', label: t('statistics.tabs.teams') },
            ]}
          />
          <Card className="mt-4">
            {params.tab === 'teams' ? (
              <DataTable
                caption={t('statistics.tabs.teams')}
                columns={teamColumns}
                rows={teamStats.data}
                loading={!teamStats.data}
                rowKey={(r) => r.team_id}
                onRowClick={(r) => navigate(`/coach/teams/${r.team_id}?tab=statistics`)}
                empty={<EmptyState icon={BarChart3} title={t('statistics.empty.title')} />}
                mobileCard={(r) => (
                  <div className="flex items-center gap-3">
                    <TeamChip team={r.team} link={false} className="flex-1" />
                    <span className="text-sm font-semibold text-ink tabular">
                      {r.won}-{r.drawn}-{r.lost}
                    </span>
                    <FormGuide form={r.form} labels={labels} />
                  </div>
                )}
              />
            ) : (
              <>
                <DataTable
                  caption={t('statistics.tabs.players')}
                  columns={playerColumns}
                  rows={d?.data}
                  loading={!d}
                  fetching={playerStats.fetching}
                  rowKey={(r) => r.player_id}
                  sort={params.sort}
                  dir={params.dir}
                  onSort={(sort, dir) => set({ sort, dir })}
                  onRowClick={(r) => navigate(`/coach/players/${r.player_id}`)}
                  empty={<EmptyState icon={BarChart3} title={t('statistics.empty.title')} description={t('statistics.empty.description')} action={filtersActive && <Button variant="secondary" onClick={() => reset(['team', 'player', 'competition', 'season', 'from', 'to'])}>{t('common.reset')}</Button>} />}
                  mobileCard={(r) => (
                    <div className="flex items-center gap-3">
                      <PersonCell name={r.player.name} photo={r.player.photo} sub={r.team?.short_name} className="min-w-0 flex-1" />
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
              </>
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
