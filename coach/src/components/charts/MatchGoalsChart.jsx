import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { animation, AXIS_PROPS, BAR_CURSOR, ChartTooltip, GRID_PROPS, useChartPaint } from './ChartParts';

/** Grouped columns per match (e.g. goals vs assists). rows: [{ label, title, …series keys }] */
export default function MatchGoalsChart({ rows, series }) {
  const paint = useChartPaint();
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={rows} margin={{ top: 10, right: 8, bottom: 0, left: -24 }} barGap={3} barCategoryGap="26%">
        {paint.defs}
        <CartesianGrid {...GRID_PROPS} />
        <XAxis dataKey="label" {...AXIS_PROPS} minTickGap={8} />
        <YAxis allowDecimals={false} {...AXIS_PROPS} />
        <Tooltip
          cursor={BAR_CURSOR}
          content={
            <ChartTooltip
              labelFormatter={(v) => rows.find((r) => r.label === v)?.title ?? v}
              nameFor={(k) => series.find((s) => s.key === k)?.label}
              colorFor={(k) => series.find((s) => s.key === k)?.color}
            />
          }
        />
        {series.map((s, i) => (
          <Bar key={s.key} dataKey={s.key} fill={paint.fill(s.color, 'v')} maxBarSize={16} radius={[6, 6, 2, 2]} {...animation(i)} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}
