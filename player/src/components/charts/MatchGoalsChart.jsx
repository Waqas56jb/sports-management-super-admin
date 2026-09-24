import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { AXIS_PROPS, ChartTooltip, GRID_PROPS } from './ChartParts';

/** Goals scored vs conceded per match (grouped columns). rows: [{ label, title, scored, conceded }] */
export default function MatchGoalsChart({ rows, series }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: -24 }} barGap={2} barCategoryGap="24%">
        <CartesianGrid {...GRID_PROPS} />
        <XAxis dataKey="label" {...AXIS_PROPS} minTickGap={8} />
        <YAxis allowDecimals={false} {...AXIS_PROPS} />
        <Tooltip
          cursor={{ fill: 'var(--surface-3)', opacity: 0.6 }}
          content={<ChartTooltip labelFormatter={(v) => rows.find((r) => r.label === v)?.title ?? v} nameFor={(k) => series.find((s) => s.key === k)?.label} />}
        />
        {series.map((s) => (
          <Bar key={s.key} dataKey={s.key} fill={s.color} maxBarSize={14} radius={[4, 4, 0, 0]} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}
