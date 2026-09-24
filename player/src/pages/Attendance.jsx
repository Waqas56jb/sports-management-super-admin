import { Link, useNavigate } from 'react-router-dom';
import { CalendarCheck, CalendarX2, ClipboardList, Clock, ShieldCheck, UserCheck } from 'lucide-react';
import MonthlyAttendanceChart, { ATTENDANCE_SERIES, AttendanceLegend } from '@/components/attendance/MonthlyAttendanceChart';
import ChartCard from '@/components/charts/ChartCard';
import TrendLineChart from '@/components/charts/TrendLineChart';
import { StatusBadge } from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import DataTable from '@/components/ui/DataTable';
import FilterBar from '@/components/ui/FilterBar';
import { Meter } from '@/components/ui/Misc';
import PageHeader from '@/components/ui/PageHeader';
import Pagination from '@/components/ui/Pagination';
import { StatSkeleton } from '@/components/ui/Skeleton';
import StatCard from '@/components/ui/StatCard';
import { EmptyState, ErrorState } from '@/components/ui/States';
import { useAttendance } from '@/hooks/useAttendance';
import { useListParams } from '@/hooks/useListParams';
import { useOptions } from '@/hooks/useOptions';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useI18n } from '@/i18n';
import { MY_ATTENDANCE_STATUSES, TRAINING_TYPES } from '@/utils/constants';
import { formatDate, formatPercent, formatShortDate, formatTime, formatWeekday } from '@/utils/formatters';

const FILTERS = ['from', 'to', 'status', 'type'];

export default function Attendance() {
  const { t, lang } = useI18n();
  usePageTitle(t('attendance.title'));
  const navigate = useNavigate();
  const toOptions = useOptions();
  const { params, set, reset } = useListParams();
  const q = useAttendance({ from: params.from, to: params.to, status: params.status, type: params.type, page: params.page, pageSize: 10 });
  const d = q.data;
  const s = d?.summary;
  const filtersActive = FILTERS.some((k) => params[k]);

  const columns = [
    { key: 'date', header: t('attendance.history.date'), render: (r) => <span className="whitespace-nowrap capitalize">{formatWeekday(r.session.date, lang)}</span> },
    {
      key: 'training',
      header: t('attendance.history.training'),
      render: (r) => (
        <span className="flex flex-col gap-1">
          <span className="font-medium text-ink">{t(`training.titles.${r.session.training_type}`)}</span>
          <span className="text-xs text-ink-3 tabular">{formatTime(r.session.start_time)}</span>
        </span>
      ),
    },
    { key: 'team', header: t('attendance.history.team'), render: (r) => r.session.team?.name },
    { key: 'status', header: t('attendance.history.status'), render: (r) => <StatusBadge value={r.status} /> },
    { key: 'coach', header: t('attendance.history.coach'), render: (r) => r.session.coach_name ?? '—' },
    { key: 'notes', header: t('attendance.history.notes'), className: 'max-w-56', render: (r) => <span className="line-clamp-2 text-ink-3">{r.notes || '—'}</span> },
  ];

  return (
    <>
      <PageHeader title={t('attendance.title')} description={t('attendance.description')} />

      {q.error ? (
        <div className="card">
          <ErrorState error={q.error} onRetry={q.refetch} />
        </div>
      ) : (
        <>
          <section className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-6" aria-label={t('attendance.kpi.rate')}>
            {!s ? (
              Array.from({ length: 6 }, (_, i) => <StatSkeleton key={i} />)
            ) : (
              <>
                <StatCard className="col-span-2 md:col-span-1" label={t('attendance.kpi.rate')} value={s.rate != null ? formatPercent(s.rate, lang) : '—'} icon={CalendarCheck} sub={t('attendance.kpi.rateSub')}>
                  {s.rate != null && <Meter value={s.rate} className="mt-3" size="sm" label={t('attendance.kpi.rate')} />}
                </StatCard>
                <StatCard label={t('attendance.kpi.sessions')} value={s.sessions} icon={ClipboardList} tone="slate" sub={t('attendance.kpi.sessionsSub', { count: s.pending })} />
                <StatCard label={t('attendance.kpi.present')} value={s.present} icon={UserCheck} tone="brand" />
                <StatCard label={t('attendance.kpi.late')} value={s.late} icon={Clock} tone="amber" />
                <StatCard label={t('attendance.kpi.excused')} value={s.excused} icon={ShieldCheck} tone="sky" />
                <StatCard label={t('attendance.kpi.absent')} value={s.absent} icon={CalendarX2} tone="rose" />
              </>
            )}
          </section>

          <div className="mt-4 grid gap-4 sm:mt-6 sm:gap-6 xl:grid-cols-3">
            <ChartCard
              className="xl:col-span-2"
              title={t('attendance.charts.monthly')}
              subtitle={t('attendance.charts.monthlySub')}
              loading={!d}
              empty={d && !d.monthly.length}
              height={240}
              legend={<AttendanceLegend />}
              table={
                d && {
                  columns: [{ key: 'month', label: t('attendance.history.date') }, ...ATTENDANCE_SERIES.map((x) => ({ key: x.key, label: t(`status.${x.key}`), align: 'right' })), { key: 'rate', label: t('attendance.charts.rate'), align: 'right' }],
                  rows: d.monthly.map((m) => ({ ...m, month: formatDate(m.month, lang, { month: 'long', year: 'numeric' }), rate: formatPercent(m.rate, lang) })),
                }
              }
            >
              {d && <MonthlyAttendanceChart data={d.monthly} />}
            </ChartCard>
            <Card>
              <CardHeader title={t('attendance.charts.split')} subtitle={t('attendance.charts.splitSub')} />
              <div className="space-y-4 p-4 sm:p-5">
                {!s ? (
                  <StatSkeleton />
                ) : (
                  ATTENDANCE_SERIES.map((x) => {
                    const pct = s.total ? (s[x.key] / s.total) * 100 : 0;
                    return (
                      <div key={x.key}>
                        <div className="mb-1.5 flex justify-between text-sm">
                          <span className="inline-flex items-center gap-2 text-ink-2">
                            <span className="size-2.5 rounded-full" style={{ background: x.color }} aria-hidden="true" />
                            {t(`status.${x.key}`)}
                          </span>
                          <span className="tabular text-ink">
                            <span className="font-semibold">{s[x.key]}</span> <span className="text-xs text-ink-3">{formatPercent(pct, lang)}</span>
                          </span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-surface-3" role="meter" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100} aria-label={t(`status.${x.key}`)}>
                          <div className="h-full rounded-full" style={{ width: `${pct}%`, background: x.color }} />
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </Card>
          </div>

          <ChartCard
            className="mt-4 sm:mt-6"
            title={t('attendance.charts.trend')}
            subtitle={t('attendance.charts.trendSub')}
            loading={!d}
            empty={d && d.trend.length < 2}
            height={200}
            table={d && { columns: [{ key: 'date', label: t('attendance.history.date') }, { key: 'rate', label: t('attendance.charts.rate'), align: 'right' }], rows: d.trend.map((x) => ({ date: formatShortDate(x.date, lang), rate: formatPercent(x.rate, lang) })) }}
          >
            {d && <TrendLineChart data={d.trend} xKey="date" yKey="rate" name={t('attendance.charts.rate')} domain={[50, 100]} color="var(--chart-3)" format={(v) => `${Math.round(v)}%`} tickFor={(v) => formatShortDate(v, lang)} labelFor={(v) => formatShortDate(v, lang)} />}
          </ChartCard>

          <Card className="mt-4 sm:mt-6">
            <CardHeader title={t('attendance.history.title')} />
            <div className="mt-4 border-y border-line p-3 sm:p-4">
              <FilterBar
                filters={[
                  { key: 'status', label: t('attendance.filters.status'), options: toOptions(MY_ATTENDANCE_STATUSES, 'status'), placeholder: t('common.allStatuses') },
                  { key: 'type', label: t('attendance.filters.type'), options: toOptions(TRAINING_TYPES, 'trainingTypes'), placeholder: t('training.allTypes'), className: 'sm:min-w-44' },
                  { key: 'from', label: t('common.from'), type: 'date', className: 'sm:w-40' },
                  { key: 'to', label: t('common.to'), type: 'date', className: 'sm:w-40' },
                ]}
                values={params}
                onChange={set}
                onReset={() => reset(FILTERS)}
              />
            </div>
            <DataTable
              caption={t('attendance.history.title')}
              columns={columns}
              rows={d?.history.data}
              loading={!d}
              fetching={q.fetching}
              onRowClick={(r) => navigate(`/player/training/${r.session.id}`)}
              empty={
                <EmptyState
                  icon={CalendarCheck}
                  title={filtersActive ? t('attendance.empty.filtered') : t('attendance.empty.title')}
                  description={filtersActive ? undefined : t('attendance.empty.description')}
                  action={filtersActive && <Button variant="secondary" onClick={() => reset(FILTERS)}>{t('common.reset')}</Button>}
                />
              }
              mobileCard={(r) => (
                <div className="flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-ink">{t(`training.titles.${r.session.training_type}`)}</p>
                    <p className="mt-0.5 text-xs capitalize text-ink-3">
                      {formatWeekday(r.session.date, lang)} · {formatTime(r.session.start_time)}
                      {r.session.coach_name && ` · ${r.session.coach_name}`}
                    </p>
                    {r.notes && <p className="mt-1 text-xs text-ink-2">{r.notes}</p>}
                  </div>
                  <StatusBadge value={r.status} />
                </div>
              )}
            />
            {d && d.history.total > 0 && (
              <div className="border-t border-line px-4 py-3 sm:px-5">
                <Pagination page={d.history.page} pages={d.history.pages} total={d.history.total} pageSize={d.history.pageSize} onChange={(page) => set({ page })} />
              </div>
            )}
          </Card>
          <p className="mt-3 text-xs text-ink-3">
            <Link to="/player/training" className="underline-offset-2 hover:underline">
              {t('training.detail.readOnly')}
            </Link>
          </p>
        </>
      )}
    </>
  );
}
