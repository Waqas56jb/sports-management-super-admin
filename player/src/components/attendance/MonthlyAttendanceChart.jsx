import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { animation, AXIS_PROPS, BAR_CURSOR, ChartLegend, ChartTooltip, GRID_PROPS, useChartPaint } from '@/components/charts/ChartParts';
import { useI18n } from '@/i18n';
import { formatDate } from '@/utils/formatters';

/** Status colours: attendance statuses are "state", so they use the status palette with a legend. */
export const ATTENDANCE_SERIES = [
  { key: 'present', color: 'var(--good)' },
  { key: 'late', color: 'var(--warning)' },
  { key: 'excused', color: 'var(--chart-1)' },
  { key: 'absent', color: 'var(--critical)' },
];

export function AttendanceLegend() {
  const { t } = useI18n();
  return <ChartLegend items={ATTENDANCE_SERIES.map((s) => ({ label: t(`status.${s.key}`), color: s.color }))} />;
}

/** Stacked monthly columns: present / late / excused / absent. */
export default function MonthlyAttendanceChart({ data }) {
  const { t, lang } = useI18n();
  const paint = useChartPaint();
  const rows = data.map((m) => ({ ...m, label: formatDate(m.month, lang, { month: 'short', year: '2-digit' }), title: formatDate(m.month, lang, { month: 'long', year: 'numeric' }) }));
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={rows} margin={{ top: 10, right: 8, bottom: 0, left: -24 }} barCategoryGap="30%">
        {paint.defs}
        <CartesianGrid {...GRID_PROPS} />
        <XAxis dataKey="label" {...AXIS_PROPS} />
        <YAxis allowDecimals={false} {...AXIS_PROPS} />
        <Tooltip
          cursor={BAR_CURSOR}
          content={<ChartTooltip labelFormatter={(v) => rows.find((r) => r.label === v)?.title ?? v} nameFor={(k) => t(`status.${k}`)} colorFor={(k) => ATTENDANCE_SERIES.find((x) => x.key === k)?.color} />}
        />
        {ATTENDANCE_SERIES.map((s, i) => (
          <Bar key={s.key} dataKey={s.key} stackId="a" fill={paint.fill(s.color, 'v')} maxBarSize={30} stroke="var(--surface)" strokeWidth={2} radius={i === ATTENDANCE_SERIES.length - 1 ? [7, 7, 0, 0] : undefined} {...animation(i, 700)} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}
