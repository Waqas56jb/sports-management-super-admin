import { Bar, BarChart, CartesianGrid, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useI18n } from '@/i18n';
import { formatPercent } from '@/utils/format';
import { AXIS_PROPS, ChartTooltip, GRID_PROPS } from './ChartParts';
import { teamColor } from './TeamCharts';

/** Horizontal bars of a percentage per team, value at the bar tip. */
export default function RateBarChart({ data, label }) {
  const { lang } = useI18n();
  const rows = data.map((d) => ({ name: d.team.name, rate: d.rate, color: teamColor(d.team) }));
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={rows} layout="vertical" margin={{ top: 4, right: 48, bottom: 4, left: 4 }} barCategoryGap="30%">
        <CartesianGrid {...GRID_PROPS} horizontal={false} vertical />
        <XAxis type="number" domain={[0, 100]} tickFormatter={(v) => `${v}%`} {...AXIS_PROPS} />
        <YAxis type="category" dataKey="name" width={112} {...AXIS_PROPS} tick={{ ...AXIS_PROPS.tick, fill: 'var(--ink-2)' }} />
        <Tooltip cursor={{ fill: 'var(--surface-3)', opacity: 0.6 }} content={<ChartTooltip valueFormatter={(v) => formatPercent(v, lang)} nameFor={() => label} />} />
        <Bar dataKey="rate" maxBarSize={22} radius={[0, 4, 4, 0]} isAnimationActive={false}>
          {rows.map((r) => (
            <Cell key={r.name} fill={r.color} />
          ))}
          <LabelList dataKey="rate" position="right" formatter={(v) => formatPercent(v, lang)} style={{ fill: 'var(--ink-2)', fontSize: 12, fontWeight: 600 }} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
