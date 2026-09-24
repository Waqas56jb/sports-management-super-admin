import { Activity, BarChart3, Crosshair, Info, Square, Waypoints, Zap } from 'lucide-react';
import ChartCard from '@/components/charts/ChartCard';
import { ChartLegend } from '@/components/charts/ChartParts';
import MatchGoalsChart from '@/components/charts/MatchGoalsChart';
import TrendLineChart from '@/components/charts/TrendLineChart';
import StatGroup from '@/components/statistics/StatGroup';
import Button from '@/components/ui/Button';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import FilterBar from '@/components/ui/FilterBar';
import { Meter } from '@/components/ui/Misc';
import PageHeader from '@/components/ui/PageHeader';
import { CardSkeleton } from '@/components/ui/Skeleton';
import { EmptyState, ErrorState } from '@/components/ui/States';
import { useListParams } from '@/hooks/useListParams';
import { useCompetitionOptions, useOptions, useSeasonOptions } from '@/hooks/useOptions';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useStatistics } from '@/hooks/useStatistics';
import { useI18n } from '@/i18n';
import { MATCH_TYPES } from '@/utils/constants';
import { formatDate, formatNumber, formatPercent, formatShortDate } from '@/utils/formatters';

const FILTERS = ['season', 'competition', 'from', 'to', 'type'];

export default function Statistics() {
  const { t, lang } = useI18n();
  usePageTitle(t('statistics.title'));
  const toOptions = useOptions();
  const seasons = useSeasonOptions();
  const competitionOptions = useCompetitionOptions();
  const { params, set, reset } = useListParams();
  const q = useStatistics({ season: params.season, competitionId: params.competition, from: params.from, to: params.to, matchType: params.type });
  const d = q.data;
  const filtersActive = FILTERS.some((k) => params[k]);

  const filterBar = (
    <Card className="mb-4 p-3 sm:mb-6 sm:p-4">
      <FilterBar
        filters={[
          { key: 'season', label: t('statistics.filters.season'), options: seasons, placeholder: t('statistics.filters.allSeasons'), className: 'sm:min-w-36' },
          { key: 'competition', label: t('statistics.filters.competition'), options: competitionOptions, placeholder: t('statistics.filters.allCompetitions'), className: 'sm:min-w-48' },
          { key: 'type', label: t('statistics.filters.matchType'), options: toOptions(MATCH_TYPES, 'statistics.matchTypes'), placeholder: t('statistics.filters.allTypes'), className: 'sm:min-w-44' },
          { key: 'from', label: t('common.from'), type: 'date', className: 'sm:w-40' },
          { key: 'to', label: t('common.to'), type: 'date', className: 'sm:w-40' },
        ]}
        values={params}
        onChange={set}
        onReset={() => reset(FILTERS)}
      />
    </Card>
  );

  if (q.error) {
    return (
      <>
        <PageHeader title={t('statistics.title')} description={t('statistics.description')} />
        <div className="card">
          <ErrorState error={q.error} onRetry={q.refetch} />
        </div>
      </>
    );
  }

  const s = d?.totals;
  const pct = (v) => (v != null ? formatPercent(v, lang) : '—');
  const per = (d?.perMatch ?? []).map((m) => ({ ...m, label: formatShortDate(m.date, lang), title: `${formatShortDate(m.date, lang)} · ${t('statistics.charts.vs', { team: m.opponent?.name })}` }));
  const monthly = (d?.monthly ?? []).map((m) => ({ ...m, label: formatDate(m.month, lang, { month: 'short', year: '2-digit' }), title: formatDate(m.month, lang, { month: 'long', year: 'numeric' }) }));
  const gaSeries = [
    { key: 'goals', label: t('statistics.labels.goals'), color: 'var(--chart-1)' },
    { key: 'assists', label: t('statistics.labels.assists'), color: 'var(--chart-2)' },
  ];

  return (
    <>
      <PageHeader title={t('statistics.title')} description={t('statistics.description')} />
      {filterBar}

      {!d ? (
        <div className="grid gap-4 sm:gap-6 md:grid-cols-2 xl:grid-cols-3" role="status" aria-label={t('common.loading')}>
          {Array.from({ length: 6 }, (_, i) => (
            <CardSkeleton key={i} lines={4} />
          ))}
        </div>
      ) : s.matches_played === 0 ? (
        <div className="card">
          <EmptyState icon={BarChart3} title={t('statistics.empty.title')} description={t('statistics.empty.description')} action={filtersActive && <Button variant="secondary" onClick={() => reset(FILTERS)}>{t('common.reset')}</Button>} />
        </div>
      ) : (
        <div className={q.fetching ? 'opacity-60 transition-opacity' : 'transition-opacity'}>
          <div className="grid gap-4 sm:gap-6 md:grid-cols-2 xl:grid-cols-3">
            <StatGroup
              title={t('statistics.sections.general')}
              icon={Activity}
              items={[
                { label: t('statistics.labels.matches'), value: s.matches_played },
                { label: t('statistics.labels.starts'), value: s.starts },
                { label: t('statistics.labels.minutes'), value: formatNumber(s.minutes_played, lang) },
                { label: t('statistics.labels.goals'), value: s.goals },
                { label: t('statistics.labels.assists'), value: s.assists },
                { label: t('statistics.labels.attendance'), value: pct(d.attendance.rate) },
              ]}
            />
            <StatGroup
              title={t('statistics.sections.attacking')}
              icon={Crosshair}
              items={[
                { label: t('statistics.labels.shots'), value: s.shots },
                { label: t('statistics.labels.shotsOnTarget'), value: s.shots_on_target },
                { label: t('statistics.labels.shotAccuracy'), value: pct(s.shots ? (s.shots_on_target / s.shots) * 100 : null) },
                { label: t('statistics.labels.goals'), value: s.goals },
                { label: t('statistics.labels.assists'), value: s.assists },
                { label: t('statistics.labels.keyPasses'), value: s.key_passes },
              ]}
            />
            <StatGroup
              title={t('statistics.sections.passing')}
              icon={Waypoints}
              items={[
                { label: t('statistics.labels.passes'), value: formatNumber(s.passes, lang) },
                { label: t('statistics.labels.completedPasses'), value: formatNumber(s.completed_passes, lang) },
                { label: t('statistics.labels.passAccuracy'), value: pct(s.pass_accuracy) },
                { label: t('statistics.labels.keyPasses'), value: s.key_passes },
              ]}
            />
            <StatGroup
              title={t('statistics.sections.discipline')}
              icon={Square}
              items={[
                { label: t('statistics.labels.fouls'), value: s.fouls },
                { label: t('statistics.labels.yellow'), value: s.yellow_cards },
                { label: t('statistics.labels.red'), value: s.red_cards },
              ]}
            />
            <StatGroup
              title={t('statistics.sections.other')}
              icon={Zap}
              items={[
                { label: t('statistics.labels.substitutions'), value: s.substitute_appearances },
                { label: t('statistics.labels.minutesPerMatch'), value: s.minutes_per_match ?? '—' },
                { label: t('statistics.labels.averageRating'), value: s.average_rating?.toFixed(1) ?? '—' },
              ]}
            />
            <Card>
              <CardHeader title={t('statistics.charts.attendance')} subtitle={t('statistics.charts.attendanceSub')} />
              <CardBody>
                <p className="font-display text-5xl font-bold text-ink">{pct(d.attendance.rate)}</p>
                {d.attendance.rate != null && <Meter value={d.attendance.rate} className="mt-3" label={t('statistics.charts.attendance')} />}
                <dl className="mt-4 grid grid-cols-4 gap-2 text-center">
                  {['present', 'late', 'excused', 'absent'].map((k) => (
                    <div key={k} className="rounded-lg bg-surface-2 py-2">
                      <dt className="truncate px-1 text-[11px] text-ink-3">{t(`status.${k}`)}</dt>
                      <dd className="font-semibold text-ink tabular">{d.attendance[k]}</dd>
                    </div>
                  ))}
                </dl>
              </CardBody>
            </Card>
          </div>

          <div className="mt-4 grid gap-4 sm:mt-6 sm:gap-6 xl:grid-cols-2">
            <ChartCard
              title={t('statistics.charts.goalsAssists')}
              subtitle={t('statistics.charts.goalsAssistsSub')}
              height={240}
              legend={<ChartLegend items={gaSeries.map((x) => ({ label: x.label, color: x.color }))} />}
              table={{ columns: [{ key: 'title', label: t('common.date') }, { key: 'goals', label: t('statistics.labels.goals'), align: 'right' }, { key: 'assists', label: t('statistics.labels.assists'), align: 'right' }], rows: per }}
            >
              <MatchGoalsChart rows={per} series={gaSeries} />
            </ChartCard>
            <ChartCard
              title={t('statistics.charts.rating')}
              subtitle={t('statistics.charts.ratingSub')}
              height={240}
              table={{ columns: [{ key: 'title', label: t('common.date') }, { key: 'rating', label: t('statistics.labels.averageRating'), align: 'right' }], rows: per.map((m) => ({ ...m, rating: m.rating.toFixed(1) })) }}
            >
              <TrendLineChart data={per} xKey="label" yKey="rating" name={t('statistics.charts.rating')} domain={[4, 10]} format={(v) => Number(v).toFixed(1)} labelFor={(v) => per.find((m) => m.label === v)?.title ?? v} />
            </ChartCard>
            <ChartCard
              title={t('statistics.charts.minutes')}
              subtitle={t('statistics.charts.minutesSub')}
              height={220}
              table={{ columns: [{ key: 'title', label: t('common.date') }, { key: 'minutes', label: t('statistics.labels.minutes'), align: 'right' }], rows: per }}
            >
              <MatchGoalsChart rows={per} series={[{ key: 'minutes', label: t('statistics.labels.minutes'), color: 'var(--chart-3)' }]} />
            </ChartCard>
            <ChartCard
              title={t('statistics.charts.monthly')}
              subtitle={t('statistics.charts.monthlySub')}
              height={220}
              empty={!monthly.length}
              legend={<ChartLegend items={gaSeries.map((x) => ({ label: x.label, color: x.color }))} />}
              table={{
                columns: [
                  { key: 'title', label: t('common.date') },
                  { key: 'goals', label: t('statistics.labels.goals'), align: 'right' },
                  { key: 'assists', label: t('statistics.labels.assists'), align: 'right' },
                  { key: 'rating', label: t('statistics.labels.averageRating'), align: 'right' },
                ],
                rows: monthly.map((m) => ({ ...m, rating: m.rating?.toFixed(1) ?? '—' })),
              }}
            >
              <MatchGoalsChart rows={monthly} series={gaSeries} />
            </ChartCard>
          </div>
          <p className="mt-3 flex items-start gap-2 text-xs text-ink-3">
            <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
            {t('statistics.note')}
          </p>
        </div>
      )}
    </>
  );
}
