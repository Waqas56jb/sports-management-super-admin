import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { AXIS_PROPS, ChartTooltip, GRID_PROPS } from './ChartParts';

/** Single-series trend: 2px line with a ~10% wash, end-of-point markers, crosshair tooltip. */
export default function TrendLineChart({ data, xKey, yKey, name, domain, format = (v) => v, tickFor, labelFor, color = 'var(--chart-1)' }) {
  const gradientId = `g-${yKey}`;
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -12 }}>
        <defs>
          <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor={color} stopOpacity={0.16} />
            <stop offset="1" stopColor={color} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid {...GRID_PROPS} />
        <XAxis dataKey={xKey} tickFormatter={tickFor} {...AXIS_PROPS} minTickGap={16} />
        <YAxis domain={domain} tickFormatter={format} {...AXIS_PROPS} />
        <Tooltip
          cursor={{ stroke: 'var(--line-strong)', strokeWidth: 1 }}
          content={<ChartTooltip labelFormatter={(v) => (labelFor ? labelFor(v) : v)} valueFormatter={format} nameFor={() => name} />}
        />
        <Area
          type="monotone"
          dataKey={yKey}
          stroke={color}
          strokeWidth={2}
          fill={`url(#${gradientId})`}
          dot={{ r: 3.5, fill: color, strokeWidth: 0 }}
          activeDot={{ r: 5, stroke: 'var(--surface)', strokeWidth: 2 }}
          connectNulls
          isAnimationActive={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
