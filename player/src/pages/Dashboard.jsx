import { Link } from 'react-router-dom';
import { Activity, CalendarCheck, Crosshair, Dumbbell, Goal, Percent, Square, Star, Timer } from 'lucide-react';
import ChartCard from '@/components/charts/ChartCard';
import { ChartLegend } from '@/components/charts/ChartParts';
import MatchGoalsChart from '@/components/charts/MatchGoalsChart';
import TrendLineChart from '@/components/charts/TrendLineChart';
import MiniStat from '@/components/common/MiniStat';
import NextMatchCard from '@/components/dashboard/NextMatchCard';
import PlayerHero from '@/components/dashboard/PlayerHero';
import RecentMatches from '@/components/dashboard/RecentMatches';
import UpcomingSchedule from '@/components/dashboard/UpcomingSchedule';
import TrainingItem from '@/components/training/TrainingItem';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { CardSkeleton, Skeleton, StatSkeleton } from '@/components/ui/Skeleton';
import StatCard from '@/components/ui/StatCard';
import { EmptyState, ErrorState } from '@/components/ui/States';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useDashboard } from '@/hooks/usePlayer';
import { useI18n } from '@/i18n';
import { formatNumber, formatPercent, formatShortDate } from '@/utils/formatters';

export default function Dashboard() {
  const { t, lang } = useI18n();
  usePageTitle(t('nav.dashboard'));
  const { data, loading, error, refetch } = useDashboard();

  if (error) {
    return (
      <div className="card">
        <ErrorState error={error} onRetry={refetch} />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-6" role="status" aria-label={t('common.loading')}>
        <Skeleton className="h-40 w-full rounded-(--radius-card)" />
        <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 2xl:grid-cols-6">
          {Array.from({ length: 6 }, (_, i) => (
            <StatSkeleton key={i} />
          ))}
        </div>
        <div className="grid gap-4 sm:gap-6 lg:grid-cols-3">
          <CardSkeleton lines={6} />
          <CardSkeleton lines={6} />
          <CardSkeleton lines={6} />
        </div>
      </div>
    );
  }

  const s = data.stats;
  const a = data.attendance;
  const series = data.series.map((m) => ({ ...m, label: formatShortDate(m.date, lang), title: `${formatShortDate(m.date, lang)} · ${t('dashboard.recent.vs', { team: m.opponent?.name })}` }));
  const gaSeries = [
    { key: 'goals', label: t('dashboard.performance.goals'), color: 'var(--chart-1)' },
    { key: 'assists', label: t('dashboard.performance.assists'), color: 'var(--chart-2)' },
  ];
  const seasonName = data.season ? t('dashboard.seasonLabel', { name: data.season.name, season: data.season.season }) : '';

  return (
    <>
      <PlayerHero player={data.player} />

      <section aria-label={t('dashboard.performance.title')} className="mt-4 grid grid-cols-2 gap-3 sm:mt-6 sm:gap-4 md:grid-cols-3 2xl:grid-cols-6">
        <StatCard to="/player/statistics" label={t('dashboard.kpi.matches')} value={s.matches_played} icon={Activity} tone="sky" sub={t('dashboard.kpi.matchesSub', { count: s.starts })} />
        <StatCard to="/player/statistics" label={t('dashboard.kpi.goals')} value={s.goals} icon={Goal} tone="brand" sub={t('dashboard.kpi.goalsSub')} />
        <StatCard to="/player/statistics" label={t('dashboard.kpi.assists')} value={s.assists} icon={Star} tone="violet" sub={t('dashboard.kpi.assistsSub')} />
        <StatCard to="/player/attendance" label={t('dashboard.kpi.attendance')} value={a.rate != null ? formatPercent(a.rate, lang) : '—'} icon={CalendarCheck} tone="amber" sub={t('dashboard.kpi.attendanceSub', { count: a.total })} />
        <StatCard to="/player/statistics" label={t('dashboard.kpi.minutes')} value={formatNumber(s.minutes_played, lang)} icon={Timer} tone="slate" sub={s.minutes_per_match != null ? t('dashboard.kpi.minutesSub', { count: s.minutes_per_match }) : undefined} />
        <StatCard to="/player/statistics" label={t('dashboard.kpi.yellow')} value={s.yellow_cards} icon={Square} tone="rose" sub={t('dashboard.kpi.yellowSub', { count: s.red_cards })} />
      </section>

      <div className="mt-4 grid gap-4 sm:mt-6 sm:gap-6 lg:grid-cols-2 xl:grid-cols-3">
        <NextMatchCard match={data.nextMatch} />
        <Card className="flex flex-col">
          <CardHeader
            title={t('dashboard.training.title')}
            action={
              <Link to="/player/training" className="text-sm font-medium text-brand-700 hover:underline dark:text-brand-300">
                {t('common.viewAll')}
              </Link>
            }
          />
          <div className="flex-1 px-1.5 pb-2 pt-2 sm:px-2">
            {data.upcomingSessions.length ? data.upcomingSessions.map((ses) => <TrainingItem key={ses.id} session={ses} />) : <EmptyState compact icon={Dumbbell} title={t('dashboard.training.empty')} description={t('dashboard.training.emptyHint')} />}
          </div>
        </Card>
        <UpcomingSchedule items={data.schedule} />
      </div>

      <div className="mt-4 sm:mt-6">
        <RecentMatches rows={data.recent} />
      </div>

      <Card className="mt-4 sm:mt-6">
        <CardHeader title={t('dashboard.performance.title')} subtitle={t('dashboard.performance.subtitle', { competition: seasonName })} action={<Link to="/player/statistics" className="text-sm font-medium text-brand-700 hover:underline dark:text-brand-300">{t('common.viewAll')}</Link>} />
        <CardBody className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <MiniStat label={t('dashboard.performance.goals')} value={s.goals} icon={Goal} accent="text-emerald-600" />
          <MiniStat label={t('dashboard.performance.assists')} value={s.assists} icon={Star} accent="text-sky-600" />
          <MiniStat label={t('dashboard.performance.matches')} value={s.matches_played} icon={Activity} />
          <MiniStat label={t('dashboard.performance.minutes')} value={formatNumber(s.minutes_played, lang)} icon={Timer} />
          <MiniStat label={t('dashboard.performance.shots')} value={`${s.shots_on_target}/${s.shots}`} icon={Crosshair} />
          <MiniStat label={t('dashboard.performance.passAccuracy')} value={s.pass_accuracy != null ? formatPercent(s.pass_accuracy, lang) : '—'} icon={Percent} />
          <MiniStat label={t('dashboard.performance.attendance')} value={a.rate != null ? formatPercent(a.rate, lang) : '—'} icon={CalendarCheck} />
          <MiniStat label={t('dashboard.performance.cards')} value={`${s.yellow_cards} / ${s.red_cards}`} icon={Square} accent="fill-amber-400 text-amber-500" />
        </CardBody>
      </Card>

      <div className="mt-4 grid gap-4 sm:mt-6 sm:gap-6 xl:grid-cols-3">
        <ChartCard
          title={t('dashboard.performance.trendTitle')}
          subtitle={t('dashboard.performance.trendSub')}
          height={220}
          empty={!series.length}
          table={{ columns: [{ key: 'title', label: t('common.date') }, { key: 'rating', label: t('dashboard.performance.rating'), align: 'right' }], rows: series.map((m) => ({ title: m.title, rating: m.rating.toFixed(1) })) }}
        >
          <TrendLineChart data={series} xKey="label" yKey="rating" name={t('dashboard.performance.rating')} domain={[4, 10]} format={(v) => Number(v).toFixed(1)} labelFor={(v) => series.find((m) => m.label === v)?.title ?? v} />
        </ChartCard>
        <ChartCard
          title={t('dashboard.performance.goalsTitle')}
          subtitle={t('dashboard.performance.goalsSub')}
          height={220}
          empty={!series.length}
          legend={<ChartLegend items={gaSeries.map((x) => ({ label: x.label, color: x.color }))} />}
          table={{ columns: [{ key: 'title', label: t('common.date') }, { key: 'goals', label: t('dashboard.performance.goals'), align: 'right' }, { key: 'assists', label: t('dashboard.performance.assists'), align: 'right' }], rows: series }}
        >
          <MatchGoalsChart rows={series} series={gaSeries} />
        </ChartCard>
        <ChartCard
          title={t('dashboard.performance.minutesTitle')}
          subtitle={t('dashboard.performance.minutesSub')}
          height={220}
          empty={!series.length}
          table={{ columns: [{ key: 'title', label: t('common.date') }, { key: 'minutes', label: t('dashboard.performance.minutes'), align: 'right' }], rows: series }}
        >
          <MatchGoalsChart rows={series} series={[{ key: 'minutes', label: t('dashboard.performance.minutes'), color: 'var(--chart-3)' }]} />
        </ChartCard>
      </div>
    </>
  );
}
