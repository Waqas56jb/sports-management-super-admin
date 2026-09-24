import { CalendarPlus, ClipboardList, Dumbbell, Goal, Shield, Shirt, Trophy, UserPlus } from 'lucide-react';
import { Link } from 'react-router-dom';
import ChartCard from '@/components/charts/ChartCard';
import { ChartLegend } from '@/components/charts/ChartParts';
import { AttendanceTrendChart, GroupedTeamBars, MatchResultsChart, PlayersByTeamChart, ResultsLegend, TeamLegend } from '@/components/charts/TeamCharts';
import MatchRow from '@/components/common/MatchRow';
import PersonCell from '@/components/common/PersonCell';
import SessionRow from '@/components/common/SessionRow';
import TeamLogo from '@/components/common/TeamLogo';
import Button from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { Meter } from '@/components/ui/Misc';
import PageHeader from '@/components/ui/PageHeader';
import { CardSkeleton, StatSkeleton } from '@/components/ui/Skeleton';
import StatCard from '@/components/ui/StatCard';
import { EmptyState, ErrorState } from '@/components/ui/States';
import { useAuth } from '@/context/AuthContext';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useQuery } from '@/hooks/useQuery';
import { useI18n } from '@/i18n';
import { dashboardService } from '@/services/dashboardService';
import { formatLongDate, formatNumber, formatPercent, formatShortDate } from '@/utils/format';
import LiveMatchBanner from './LiveMatchBanner';

function greetingKey() {
  const h = new Date().getHours();
  if (h < 12) return 'morning';
  if (h < 18) return 'afternoon';
  return 'evening';
}

function ListCard({ title, action, children, empty, emptyHint, icon }) {
  const { t } = useI18n();
  return (
    <Card className="flex flex-col">
      <CardHeader title={title} action={action && <Link to={action} className="text-sm font-medium text-brand-700 hover:underline dark:text-brand-300">{t('common.viewAll')}</Link>} />
      <div className="flex-1 px-1.5 pb-2 pt-2 sm:px-2">{empty ? <EmptyState compact icon={icon} title={empty} description={emptyHint} /> : children}</div>
    </Card>
  );
}

export default function DashboardPage() {
  const { t, lang } = useI18n();
  const { user } = useAuth();
  usePageTitle(t('nav.dashboard'));
  const { data, loading, error, refetch } = useQuery(() => dashboardService.overview(), []);

  const firstName = user?.name?.split(' ')[0] ?? '';
  const header = (
    <PageHeader
      title={t(`dashboard.greeting.${greetingKey()}`, { name: firstName })}
      description={
        <>
          <span className="capitalize">{formatLongDate(new Date(), lang)}</span>
          <span className="hidden sm:inline"> · {t('dashboard.subtitle')}</span>
        </>
      }
      actions={
        <>
          <Button variant="secondary" icon={UserPlus} to="/admin/players?new=1">
            {t('dashboard.actions.addPlayer')}
          </Button>
          <Button icon={CalendarPlus} to="/admin/matches?new=1">
            {t('dashboard.actions.scheduleMatch')}
          </Button>
        </>
      }
    />
  );

  if (error) {
    return (
      <>
        {header}
        <div className="card">
          <ErrorState error={error} onRetry={refetch} />
        </div>
      </>
    );
  }

  if (loading) {
    return (
      <>
        {header}
        <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 2xl:grid-cols-6">
          {Array.from({ length: 6 }, (_, i) => (
            <StatSkeleton key={i} />
          ))}
        </div>
        <div className="mt-6 grid gap-4 lg:grid-cols-3 sm:gap-6">
          <CardSkeleton lines={6} />
          <CardSkeleton lines={6} className="lg:col-span-2" />
        </div>
      </>
    );
  }

  const { counts } = data;
  const teams = data.playersByTeam.map((p) => p.team);
  const perfSeries = [
    { key: 'goals', label: t('dashboard.performance.goals'), color: 'var(--chart-1)' },
    { key: 'assists', label: t('dashboard.performance.assists'), color: 'var(--chart-2)' },
  ];

  return (
    <>
      {header}

      {data.live.length > 0 && (
        <div className="mb-6 space-y-3">
          {data.live.map((m) => (
            <LiveMatchBanner key={m.id} match={m} />
          ))}
        </div>
      )}

      <section aria-label={t('nav.dashboard')} className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 2xl:grid-cols-6">
        <StatCard to="/admin/players" label={t('dashboard.kpi.players')} value={formatNumber(counts.players, lang)} icon={Shirt} tone="brand" sub={t('dashboard.kpi.playersSub', { count: counts.active_players })} />
        <StatCard to="/admin/coaches" label={t('dashboard.kpi.coaches')} value={formatNumber(counts.coaches, lang)} icon={ClipboardList} tone="violet" sub={t('dashboard.kpi.coachesSub', { count: counts.assigned_coaches })} />
        <StatCard to="/admin/teams" label={t('dashboard.kpi.teams')} value={formatNumber(counts.teams, lang)} icon={Shield} tone="sky" sub={t('dashboard.kpi.teamsSub', { count: counts.active_teams })} />
        <StatCard to="/admin/competitions" label={t('dashboard.kpi.competitions')} value={formatNumber(counts.active_competitions, lang)} icon={Trophy} tone="amber" sub={t('dashboard.kpi.competitionsSub', { count: counts.upcoming_competitions })} />
        <StatCard to="/admin/matches" label={t('dashboard.kpi.matches')} value={formatNumber(counts.upcoming_matches, lang)} icon={Goal} tone="rose" sub={t('dashboard.kpi.matchesSub', { count: counts.live_matches })} />
        <StatCard to="/admin/training" label={t('dashboard.kpi.training')} value={formatNumber(counts.upcoming_training, lang)} icon={Dumbbell} tone="slate" sub={t('dashboard.kpi.trainingSub', { count: counts.training_this_week })} />
      </section>

      <div className="mt-4 grid gap-4 sm:mt-6 sm:gap-6 xl:grid-cols-3">
        <ChartCard
          title={t('dashboard.playersByTeam.title')}
          subtitle={t('dashboard.playersByTeam.subtitle')}
          height={240}
          legend={
            <ChartLegend
              items={[
                { label: t('dashboard.playersByTeam.active'), color: 'var(--ink-2)' },
                { label: t('dashboard.playersByTeam.unavailable'), color: 'color-mix(in srgb, var(--ink-2) 35%, transparent)' },
              ]}
            />
          }
          table={{
            columns: [
              { key: 'team', label: t('common.team') },
              { key: 'active', label: t('dashboard.playersByTeam.active'), align: 'right' },
              { key: 'unavailable', label: t('dashboard.playersByTeam.unavailable'), align: 'right' },
              { key: 'total', label: t('common.total'), align: 'right' },
            ],
            rows: data.playersByTeam.map((r) => ({ team: r.team.name, active: r.active, unavailable: r.unavailable, total: r.total })),
          }}
        >
          <PlayersByTeamChart data={data.playersByTeam} />
        </ChartCard>

        <ChartCard
          className="xl:col-span-2"
          title={t('dashboard.attendanceTrend.title')}
          subtitle={t('dashboard.attendanceTrend.subtitle')}
          height={240}
          empty={!data.attendanceTrend.length}
          legend={<TeamLegend teams={teams} />}
          table={{
            columns: [{ key: 'week', label: t('common.date') }, ...teams.map((tm) => ({ key: tm.id, label: tm.short_name, align: 'right' })), { key: 'overall', label: t('dashboard.attendanceTrend.overall'), align: 'right' }],
            rows: data.attendanceTrend.map((r) => ({
              ...Object.fromEntries(Object.entries(r).map(([k, v]) => [k, k === 'week' ? formatShortDate(v, lang) : formatPercent(v, lang)])),
            })),
          }}
        >
          <AttendanceTrendChart data={data.attendanceTrend} teams={teams} />
        </ChartCard>
      </div>

      <div className="mt-4 grid gap-4 sm:mt-6 sm:gap-6 lg:grid-cols-2 xl:grid-cols-3">
        <ListCard title={t('dashboard.upcomingMatches.title')} action="/admin/matches?when=upcoming" empty={!data.upcomingMatches.length && t('dashboard.upcomingMatches.empty')} emptyHint={t('dashboard.upcomingMatches.emptyHint')} icon={Goal}>
          {data.upcomingMatches.map((m) => (
            <MatchRow key={m.id} match={m} />
          ))}
        </ListCard>
        <ListCard title={t('dashboard.recentResults.title')} action="/admin/matches?when=past" empty={!data.recentResults.length && t('dashboard.recentResults.empty')} emptyHint={t('dashboard.recentResults.emptyHint')} icon={Trophy}>
          {data.recentResults.map((m) => (
            <MatchRow key={m.id} match={m} />
          ))}
        </ListCard>
        <ListCard title={t('dashboard.upcomingTraining.title')} action="/admin/training" empty={!data.upcomingTraining.length && t('dashboard.upcomingTraining.empty')} emptyHint={t('dashboard.upcomingTraining.emptyHint')} icon={Dumbbell}>
          {data.upcomingTraining.map((s) => (
            <SessionRow key={s.id} session={s} />
          ))}
        </ListCard>
      </div>

      <div className="mt-4 grid gap-4 sm:mt-6 sm:gap-6 lg:grid-cols-2">
        <ChartCard
          title={t('dashboard.matchResults.title')}
          subtitle={t('dashboard.matchResults.subtitle', { competition: data.season ? `${data.season.name} ${data.season.season}` : t('dashboard.matchResults.noSeason') })}
          height={240}
          legend={<ResultsLegend />}
          empty={!data.matchResults.some((r) => r.played)}
          table={{
            columns: [
              { key: 'team', label: t('common.team') },
              { key: 'won', label: t('results.W'), align: 'right' },
              { key: 'drawn', label: t('results.D'), align: 'right' },
              { key: 'lost', label: t('results.L'), align: 'right' },
              { key: 'points', label: t('competitions.standings.points'), align: 'right' },
            ],
            rows: data.matchResults.map((r) => ({ team: r.team.name, won: r.won, drawn: r.drawn, lost: r.lost, points: r.points })),
          }}
        >
          <MatchResultsChart data={data.matchResults} />
        </ChartCard>
        <ChartCard
          title={t('dashboard.performance.title')}
          subtitle={t('dashboard.performance.subtitle')}
          height={240}
          legend={<ChartLegend items={perfSeries.map((s) => ({ label: s.label, color: s.color }))} />}
          table={{
            columns: [
              { key: 'team', label: t('common.team') },
              { key: 'goals', label: t('dashboard.performance.goals'), align: 'right' },
              { key: 'assists', label: t('dashboard.performance.assists'), align: 'right' },
              { key: 'rating', label: t('dashboard.performance.rating'), align: 'right' },
            ],
            rows: data.performanceByTeam.map((r) => ({ team: r.team.name, goals: r.goals, assists: r.assists, rating: r.rating?.toFixed(2) })),
          }}
        >
          <GroupedTeamBars data={data.performanceByTeam} series={perfSeries} />
        </ChartCard>
      </div>

      <div className="mt-4 grid gap-4 sm:mt-6 sm:gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader title={t('dashboard.topPlayers.title')} subtitle={t('dashboard.topPlayers.subtitle')} action={<Link to="/admin/statistics" className="text-sm font-medium text-brand-700 hover:underline dark:text-brand-300">{t('common.viewAll')}</Link>} />
          {data.topPlayers.length === 0 ? (
            <EmptyState compact title={t('dashboard.topPlayers.empty')} />
          ) : (
            <div className="mt-3 overflow-x-auto scrollbar-thin">
              <table className="w-full min-w-[520px] text-sm">
                <thead>
                  <tr className="border-y border-line bg-surface-2/60 text-xs uppercase tracking-wide text-ink-3">
                    <th scope="col" className="w-10 py-2.5 pl-5 text-left font-semibold">{t('dashboard.topPlayers.rank')}</th>
                    <th scope="col" className="py-2.5 text-left font-semibold">{t('common.player')}</th>
                    <th scope="col" className="py-2.5 text-right font-semibold" title={t('statistics.columns.matches')}>{t('dashboard.topPlayers.matches')}</th>
                    <th scope="col" className="py-2.5 text-right font-semibold" title={t('statistics.columns.goals')}>{t('dashboard.topPlayers.goals')}</th>
                    <th scope="col" className="py-2.5 text-right font-semibold" title={t('statistics.columns.assists')}>{t('dashboard.topPlayers.assists')}</th>
                    <th scope="col" className="py-2.5 pr-5 text-right font-semibold">{t('dashboard.topPlayers.rating')}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.topPlayers.map((p, i) => (
                    <tr key={p.player_id} className="border-b border-line last:border-0">
                      <td className="py-3 pl-5 font-display text-lg font-bold text-ink-3 tabular">{i + 1}</td>
                      <td className="py-3">
                        <PersonCell
                          name={p.player.name}
                          photo={p.player.photo}
                          to={`/admin/players/${p.player.id}`}
                          size="sm"
                          sub={
                            <span className="inline-flex items-center gap-1.5">
                              <TeamLogo team={p.team} size="xs" />
                              {p.team?.name} · {t(`positions.${p.player.position}`)}
                            </span>
                          }
                        />
                      </td>
                      <td className="py-3 text-right tabular text-ink-2">{p.matches_played}</td>
                      <td className="py-3 text-right font-semibold tabular text-ink">{p.goals}</td>
                      <td className="py-3 text-right tabular text-ink-2">{p.assists}</td>
                      <td className="py-3 pr-5 text-right">
                        <span className="inline-block min-w-11 rounded-md bg-brand-50 px-2 py-0.5 text-center text-sm font-semibold text-brand-800 tabular dark:bg-brand-500/15 dark:text-brand-200">
                          {p.rating?.toFixed(1)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card>
          <CardHeader title={t('dashboard.attendanceOverview.title')} subtitle={t('dashboard.attendanceOverview.subtitle')} action={<Link to="/admin/attendance" className="text-sm font-medium text-brand-700 hover:underline dark:text-brand-300">{t('common.viewAll')}</Link>} />
          <div className="p-4 sm:p-5">
            <p className="text-sm text-ink-3">{t('dashboard.attendanceOverview.rate')}</p>
            <p className="mt-1 font-display text-5xl font-bold tracking-tight text-ink">{formatPercent(data.attendanceSummary.rate, lang)}</p>
            <p className="mt-1 text-xs text-ink-3">{t('dashboard.attendanceOverview.sessions', { count: formatNumber(data.attendanceSummary.total, lang) })}</p>
            <ul className="mt-5 space-y-3.5">
              {['present', 'late', 'excused', 'absent'].map((s) => {
                const count = data.attendanceSummary[s];
                const pct = data.attendanceSummary.total ? (count / data.attendanceSummary.total) * 100 : 0;
                const tone = { present: 'good', late: 'warn', excused: 'brand', absent: 'bad' }[s];
                return (
                  <li key={s}>
                    <div className="mb-1.5 flex items-center justify-between text-sm">
                      <span className="text-ink-2">{t(`status.${s}`)}</span>
                      <span className="tabular text-ink">
                        <span className="font-semibold">{formatNumber(count, lang)}</span>
                        <span className="ml-1.5 text-xs text-ink-3">{formatPercent(pct, lang)}</span>
                      </span>
                    </div>
                    <Meter value={pct} tone={tone} label={t(`status.${s}`)} size="sm" />
                  </li>
                );
              })}
            </ul>
          </div>
        </Card>
      </div>
    </>
  );
}
