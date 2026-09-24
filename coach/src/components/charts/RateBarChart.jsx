import { Bar, BarChart, CartesianGrid, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { animation, AXIS_PROPS, BAR_CURSOR, ChartTooltip, GRID_PROPS, LINE_CURSOR, useChartPaint } from './ChartParts';

/**
 * Horizontal bars with the value at the bar tip.
 * rows: [{ label, value, color, title }] · format(v) formats ticks, labels and tooltip.
 */
export default function RateBarChart({ rows, label, format = (v) => v, domain = [0, 100], labelWidth = 112, ticks }) {
  const paint = useChartPaint();
  const data = rows.map((r) => ({ name: r.label, value: r.value, color: r.color ?? 'var(--chart-1)', title: r.title ?? r.label }));
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 48, bottom: 4, left: 4 }} barCategoryGap="30%">
        {paint.defs}
        <CartesianGrid {...GRID_PROPS} horizontal={false} vertical />
        <XAxis type="number" domain={domain} ticks={ticks} tickFormatter={format} {...AXIS_PROPS} />
        <YAxis type="category" dataKey="name" width={labelWidth} {...AXIS_PROPS} tick={{ ...AXIS_PROPS.tick, fill: 'var(--ink-2)' }} />
        <Tooltip
          cursor={BAR_CURSOR}
          content={<ChartTooltip labelFormatter={(v) => data.find((d) => d.name === v)?.title ?? v} valueFormatter={format} nameFor={() => label} />}
        />
        <Bar {...animation(0)} dataKey="value" maxBarSize={20} radius={[0, 7, 7, 0]}>
          {data.map((r) => (
            <Cell key={r.name} fill={paint.fill(r.color, 'h')} />
          ))}
          <LabelList dataKey="value" position="right" formatter={format} style={{ fill: 'var(--ink-2)', fontSize: 12, fontWeight: 600 }} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
