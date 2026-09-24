import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { AXIS_PROPS, ChartLegend, ChartTooltip, GRID_PROPS } from '@/components/charts/ChartParts';
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
  const rows = data.map((m) => ({ ...m, label: formatDate(m.month, lang, { month: 'short', year: '2-digit' }), title: formatDate(m.month, lang, { month: 'long', year: 'numeric' }) }));
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: -24 }} barCategoryGap="30%">
        <CartesianGrid {...GRID_PROPS} />
        <XAxis dataKey="label" {...AXIS_PROPS} />
        <YAxis allowDecimals={false} {...AXIS_PROPS} />
        <Tooltip
          cursor={{ fill: 'var(--surface-3)', opacity: 0.6 }}
          content={<ChartTooltip labelFormatter={(v) => rows.find((r) => r.label === v)?.title ?? v} nameFor={(k) => t(`status.${k}`)} />}
        />
        {ATTENDANCE_SERIES.map((s, i) => (
          <Bar key={s.key} dataKey={s.key} stackId="a" fill={s.color} maxBarSize={28} stroke="var(--surface)" strokeWidth={2} radius={i === ATTENDANCE_SERIES.length - 1 ? [4, 4, 0, 0] : undefined} isAnimationActive={false} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}
