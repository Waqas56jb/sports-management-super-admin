import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { animation, AXIS_PROPS, BAR_CURSOR, ChartTooltip, GRID_PROPS, LINE_CURSOR, useChartPaint } from './ChartParts';

const surname = (name = '') => {
  const parts = name.split(' ');
  return parts.length > 1 ? `${parts[0][0]}. ${parts.slice(1).join(' ')}` : name;
};

/** Horizontal stacked bars per player (e.g. goals + assists). */
export default function TopPlayersChart({ rows, series }) {
  const paint = useChartPaint();
  const data = rows.map((r) => ({ name: surname(r.player.name), full: r.player.name, ...Object.fromEntries(series.map((s) => [s.key, r[s.key]])) }));
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, bottom: 4, left: 4 }} barCategoryGap="26%">
        {paint.defs}
        <CartesianGrid {...GRID_PROPS} horizontal={false} vertical />
        <XAxis type="number" allowDecimals={false} {...AXIS_PROPS} />
        <YAxis type="category" dataKey="name" width={112} {...AXIS_PROPS} tick={{ ...AXIS_PROPS.tick, fill: 'var(--ink-2)' }} />
        <Tooltip
          cursor={BAR_CURSOR}
          content={<ChartTooltip labelFormatter={(v) => data.find((d) => d.name === v)?.full} nameFor={(k) => series.find((s) => s.key === k)?.label} colorFor={(k) => series.find((s) => s.key === k)?.color} />}
        />
        {series.map((s, i) => (
          <Bar {...animation(i)}
            key={s.key}
            dataKey={s.key}
            stackId="p"
            fill={paint.fill(s.color, 'h')}
            maxBarSize={18}
            radius={i === series.length - 1 ? [0, 4, 4, 0] : undefined}
            stroke="var(--surface)"
            strokeWidth={2}
            
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}
