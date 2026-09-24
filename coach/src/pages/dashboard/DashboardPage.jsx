import { Link } from 'react-router-dom';
import { CalendarCheck, CalendarPlus, ClipboardCheck, Dumbbell, Goal, Shield, Shirt, Trophy } from 'lucide-react';
import ChartCard from '@/components/charts/ChartCard';
import RateBarChart from '@/components/charts/RateBarChart';
import { AttendanceTrendChart, MatchResultsChart, ResultsLegend, TeamLegend, teamColor } from '@/components/charts/TeamCharts';
import PersonCell from '@/components/common/PersonCell';
import SessionRow from '@/components/common/SessionRow';
import TeamLogo from '@/components/common/TeamLogo';
import NextMatchCard from '@/components/dashboard/NextMatchCard';
import RecentResults from '@/components/dashboard/RecentResults';
import TodaySchedule from '@/components/dashboard/TodaySchedule';
import Button from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { Meter } from '@/components/ui/Misc';
import PageHeader from '@/components/ui/PageHeader';
import { CardSkeleton, StatSkeleton } from '@/components/ui/Skeleton';
import StatCard from '@/components/ui/StatCard';
import { EmptyState, ErrorState } from '@/components/ui/States';
import { useAuth } from '@/hooks/useAuth';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useQuery } from '@/hooks/useQuery';
import { useI18n } from '@/i18n';
import { coachService } from '@/services/coachService';
import { formatLongDate, formatNumber, formatPercent, formatShortDate } from '@/utils/format';

function greetingKey() {
  const h = new Date().getHours();
  if (h < 12) return 'morning';
  if (h < 18) return 'afternoon';
  return 'evening';
}

export default function DashboardPage() {
  const { t, lang } = useI18n();
  const { user } = useAuth();
  usePageTitle(t('nav.dashboard'));
  const { data, loading, error, refetch } = useQuery(() => coachService.dashboard(), []);
  const firstName = user?.name?.split(' ')[0] ?? '';

  const header = (
    <PageHeader
      title={t(`dashboard.greeting.${greetingKey()}`, { name: firstName })}
      description={
        <span className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <span className="capitalize">{formatLongDate(new Date(), lang)}</span>
          {data?.teams?.length > 0 && (
            <span className="inline-flex flex-wrap items-center gap-1.5">
              <span className="text-ink-3">· {t('dashboard.teamsLine')}:</span>
              {data.teams.map((tm) => (
                <Link key={tm.id} to={`/coach/teams/${tm.id}`} className="inline-flex items-center gap-1 rounded-full bg-surface px-2 py-0.5 text-xs font-medium text-ink ring-1 ring-line hover:ring-line-strong">
                  <TeamLogo team={tm} size="xs" className="size-4" />
                  {tm.name}
                </Link>
              ))}
            </span>
          )}
        </span>
      }
      actions={
        <>
          <Button variant="secondary" icon={ClipboardCheck} to="/coach/attendance">
            {t('dashboard.actions.takeAttendance')}
          </Button>
          <Button icon={CalendarPlus} to="/coach/training?new=1">
            {t('dashboard.actions.newSession')}
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
        <div className="mt-6 grid gap-4 sm:gap-6 lg:grid-cols-3">
          <CardSkeleton lines={6} />
          <CardSkeleton lines={6} />
          <CardSkeleton lines={6} />
        </div>
      </>
    );
  }

  const c = data.counts;
  const teams = data.teams;
  const perfRows = data.topPlayers.filter((p) => p.rating != null).map((p) => ({ label: p.player.name.split(' ').slice(-1)[0], title: p.player.name, value: p.rating, color: teamColor(p.team) }));

  return (
    <>
      {header}

      <section aria-label={t('nav.dashboard')} className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 2xl:grid-cols-6">
        <StatCard to="/coach/teams" label={t('dashboard.kpi.teams')} value={c.teams} icon={Shield} tone="sky" sub={t('dashboard.kpi.teamsSub')} />
        <StatCard to="/coach/players" label={t('dashboard.kpi.players')} value={c.players} icon={Shirt} tone="brand" sub={t('dashboard.kpi.playersSub', { count: c.active_players })} />
        <StatCard to="/coach/matches" label={t('dashboard.kpi.matches')} value={c.upcoming_matches} icon={Goal} tone="rose" sub={t('dashboard.kpi.matchesSub', { count: c.live_matches })} />
        <StatCard to="/coach/training" label={t('dashboard.kpi.training')} value={c.upcoming_training} icon={Dumbbell} tone="violet" sub={t('dashboard.kpi.trainingSub', { count: c.training_this_week })} />
        <StatCard to="/coach/attendance" label={t('dashboard.kpi.attendance')} value={c.attendance_rate != null ? formatPercent(c.attendance_rate, lang) : '—'} icon={CalendarCheck} tone="amber" sub={t('dashboard.kpi.attendanceSub')} />
        <StatCard to="/coach/competitions" label={t('dashboard.kpi.competitions')} value={c.active_competitions} icon={Trophy} tone="slate" sub={t('dashboard.kpi.competitionsSub')} />
      </section>

      <div className="mt-4 grid gap-4 sm:mt-6 sm:gap-6 lg:grid-cols-2 xl:grid-cols-3">
        <TodaySchedule items={data.todaySchedule} />
        <NextMatchCard match={data.nextMatch} />
        <RecentResults results={data.recentResults} />
      </div>

      <div className="mt-4 grid gap-4 sm:mt-6 sm:gap-6 xl:grid-cols-3">
        <ChartCard
          className="xl:col-span-2"
          title={t('dashboard.charts.attendanceTrend')}
          subtitle={t('dashboard.charts.attendanceTrendSub')}
          height={250}
          empty={!data.attendanceTrend.length}
          legend={<TeamLegend teams={teams} />}
          table={{
            columns: [{ key: 'week', label: t('common.date') }, ...teams.map((tm) => ({ key: tm.id, label: tm.short_name, align: 'right' }))],
            rows: data.attendanceTrend.map((r) => ({ week: formatShortDate(r.week, lang), ...Object.fromEntries(teams.map((tm) => [tm.id, r[tm.id] != null ? formatPercent(r[tm.id], lang) : '—'])) })),
          }}
        >
          <AttendanceTrendChart data={data.attendanceTrend} teams={teams} labelFor={(v) => t('dashboard.charts.week', { date: formatShortDate(v, lang) })} />
        </ChartCard>

        <Card>
          <CardHeader title={t('dashboard.attendance.title')} subtitle={t('dashboard.attendance.subtitle')} />
          <div className="space-y-5 p-4 sm:p-5">
            <div>
              <p className="font-display text-5xl font-bold tracking-tight text-ink">{data.attendance.summary.rate != null ? formatPercent(data.attendance.summary.rate, lang) : '—'}</p>
              <p className="mt-1 text-xs text-ink-3">{t('dashboard.attendance.rate')}</p>
            </div>
            <ul className="space-y-3.5">
              {data.attendance.byTeam.map((row) => (
                <li key={row.team.id}>
                  <div className="mb-1.5 flex items-center justify-between gap-2 text-sm">
                    <span className="flex min-w-0 items-center gap-2 text-ink-2">
                      <TeamLogo team={row.team} size="xs" />
                      <span className="truncate">{row.team.name}</span>
                    </span>
                    <span className="font-semibold text-ink tabular">{row.rate != null ? formatPercent(row.rate, lang) : '—'}</span>
                  </div>
                  <Meter value={row.rate ?? 0} label={row.team.name} size="sm" />
                </li>
              ))}
            </ul>
            {data.training.pending.length > 0 && (
              <div className="flex items-center justify-between gap-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-500/10 dark:text-amber-200">
                <span>{t('dashboard.attendance.pending', { count: data.training.pending.length })}</span>
                <Link to={`/coach/training/${data.training.pending[0].id}#register`} className="shrink-0 font-semibold underline-offset-2 hover:underline">
                  {t('dashboard.attendance.complete')}
                </Link>
              </div>
            )}
          </div>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 sm:mt-6 sm:gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader
            title={t('dashboard.topPlayers.title')}
            subtitle={t('dashboard.topPlayers.subtitle')}
            action={
              <Link to="/coach/statistics" className="text-sm font-medium text-brand-700 hover:underline dark:text-brand-300">
                {t('common.viewAll')}
              </Link>
            }
          />
          {data.topPlayers.length === 0 ? (
            <EmptyState compact title={t('dashboard.topPlayers.empty')} />
          ) : (
            <ul className="mt-2 divide-y divide-line border-t border-line">
              {data.topPlayers.map((p, i) => (
                <li key={p.player_id} className="flex items-center gap-3 px-4 py-3 sm:px-5">
                  <span className="w-5 font-display text-lg font-bold text-ink-3 tabular">{i + 1}</span>
                  <PersonCell
                    className="flex-1"
                    name={p.player.name}
                    photo={p.player.photo}
                    to={`/coach/players/${p.player.id}`}
                    size="sm"
                    sub={`${t(`positions.${p.player.position}`)} · ${p.team?.short_name}`}
                  />
                  <dl className="grid grid-cols-3 gap-3 text-center text-xs sm:gap-5">
                    <div>
                      <dt className="text-ink-3">{t('dashboard.topPlayers.goals')}</dt>
                      <dd className="font-semibold text-ink tabular">{p.goals}</dd>
                    </div>
                    <div>
                      <dt className="text-ink-3">{t('dashboard.topPlayers.assists')}</dt>
                      <dd className="font-semibold text-ink tabular">{p.assists}</dd>
                    </div>
                    <div>
                      <dt className="text-ink-3">{t('dashboard.topPlayers.rating')}</dt>
                      <dd>
                        <span className="rounded-md bg-brand-50 px-1.5 font-semibold text-brand-800 tabular dark:bg-brand-500/15 dark:text-brand-200">{p.rating?.toFixed(1)}</span>
                      </dd>
                    </div>
                  </dl>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader title={t('dashboard.training.title')} action={<Link to="/coach/training" className="text-sm font-medium text-brand-700 hover:underline dark:text-brand-300">{t('common.viewAll')}</Link>} />
          <dl className="mx-4 mt-4 grid grid-cols-2 gap-2 sm:mx-5">
            {[
              ['completed', data.training.completed],
              ['upcoming', data.training.upcoming],
              ['cancelled', data.training.cancelled],
              ['attendance', data.training.attendance_rate != null ? formatPercent(data.training.attendance_rate, lang) : '—'],
            ].map(([k, v]) => (
              <div key={k} className="rounded-xl bg-surface-2 px-3 py-2.5">
                <dt className="text-xs text-ink-3">{t(`dashboard.training.${k}`)}</dt>
                <dd className="font-display text-2xl font-bold text-ink tabular">{typeof v === 'number' ? formatNumber(v, lang) : v}</dd>
              </div>
            ))}
          </dl>
          <p className="mx-4 mt-4 text-xs font-semibold uppercase tracking-wide text-ink-3 sm:mx-5">{t('dashboard.training.next')}</p>
          <div className="px-1.5 pb-2 pt-1 sm:px-2">{data.training.next.length ? data.training.next.map((s) => <SessionRow key={s.id} session={s} />) : <EmptyState compact icon={Dumbbell} title={t('dashboard.training.empty')} />}</div>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 sm:mt-6 sm:gap-6 lg:grid-cols-2">
        <ChartCard
          title={t('dashboard.charts.performance')}
          subtitle={t('dashboard.charts.performanceSub')}
          height={260}
          empty={!perfRows.length}
          legend={<TeamLegend teams={teams} />}
          table={{ columns: [{ key: 'player', label: t('common.player') }, { key: 'rating', label: t('dashboard.charts.rating'), align: 'right' }], rows: perfRows.map((r) => ({ player: r.title, rating: r.value.toFixed(1) })) }}
        >
          <RateBarChart rows={perfRows} label={t('dashboard.charts.rating')} domain={[0, 10]} ticks={[0, 2, 4, 6, 8, 10]} format={(v) => Number(v).toFixed(1)} labelWidth={96} />
        </ChartCard>
        <ChartCard
          title={t('dashboard.charts.teamResults')}
          subtitle={t('dashboard.charts.teamResultsSub', { competition: data.season ? `${data.season.name} ${data.season.season}` : '' })}
          height={260}
          legend={<ResultsLegend />}
          empty={!data.teamResults.some((r) => r.played)}
          table={{
            columns: [
              { key: 'team', label: t('common.team') },
              { key: 'won', label: t('results.W'), align: 'right' },
              { key: 'drawn', label: t('results.D'), align: 'right' },
              { key: 'lost', label: t('results.L'), align: 'right' },
            ],
            rows: data.teamResults.map((r) => ({ team: r.team.name, won: r.won, drawn: r.drawn, lost: r.lost })),
          }}
        >
          <MatchResultsChart data={data.teamResults} />
        </ChartCard>
      </div>
    </>
  );
}
