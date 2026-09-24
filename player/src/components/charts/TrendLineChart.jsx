import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { AXIS_PROPS, ChartTooltip, GRID_PROPS, LINE_CURSOR, reveal, useChartPaint } from './ChartParts';

/**
 * Single-series trend: a 2px line over a fading wash of the same hue, drawn in on load.
 * Small series show every point; the latest point is always emphasised.
 */
export default function TrendLineChart({ data, xKey, yKey, name, domain, format = (v) => v, tickFor, labelFor, color = 'var(--chart-1)' }) {
  const paint = useChartPaint();
  const last = data.length - 1;
  const dense = data.length > 12;
  const dot = (props) => {
    const { cx, cy, index, value } = props;
    if (value === null || value === undefined || cx === undefined) return <g key={index} />;
    if (index === last) {
      return (
        <g key={index}>
          <circle cx={cx} cy={cy} r={9} fill={color} opacity={0.18} />
          <circle cx={cx} cy={cy} r={5} fill={color} stroke="var(--surface)" strokeWidth={2} />
        </g>
      );
    }
    return dense ? <g key={index} /> : <circle key={index} cx={cx} cy={cy} r={3.5} fill="var(--surface)" stroke={color} strokeWidth={2} />;
  };
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 12, right: 14, bottom: 0, left: -12 }}>
        {paint.defs}
        <CartesianGrid {...GRID_PROPS} />
        <XAxis dataKey={xKey} tickFormatter={tickFor} {...AXIS_PROPS} minTickGap={16} />
        <YAxis domain={domain} tickFormatter={format} {...AXIS_PROPS} />
        <Tooltip
          cursor={LINE_CURSOR}
          content={<ChartTooltip labelFormatter={(v) => (labelFor ? labelFor(v) : v)} valueFormatter={format} nameFor={() => name} colorFor={() => color} />}
        />
        <Area
          type="monotone"
          dataKey={yKey}
          stroke={color}
          strokeWidth={2.25}
          strokeLinecap="round"
          fill={paint.fill(color, 'area')}
          className="chart-glow"
          dot={dot}
          activeDot={{ r: 6, fill: color, stroke: 'var(--surface)', strokeWidth: 2.5 }}
          connectNulls
          {...reveal(0)}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
