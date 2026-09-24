import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useI18n } from '@/i18n';
import { TEAM_COLOR_VARS } from '@/utils/constants';
import { formatPercent, formatShortDate } from '@/utils/format';
import { AXIS_PROPS, ChartLegend, ChartTooltip, GRID_PROPS } from './ChartParts';

export const teamColor = (team) => TEAM_COLOR_VARS[(team?.color ?? 0) % TEAM_COLOR_VARS.length];

const RESULT_COLORS = { won: 'var(--good)', drawn: 'var(--neutral)', lost: 'var(--critical)' };

/** Attendance % over time, one 2px line per team. `xKey` holds an ISO date; `labelFor` formats the tooltip title. */
export function AttendanceTrendChart({ data, teams, xKey = 'week', labelFor, tickFor, overallLabel }) {
  const { lang } = useI18n();
  const names = Object.fromEntries(teams.map((tm) => [tm.id, tm.name]));
  if (overallLabel) names.overall = overallLabel;
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -12 }}>
        <CartesianGrid {...GRID_PROPS} />
        <XAxis dataKey={xKey} tickFormatter={(v) => (tickFor ? tickFor(v) : formatShortDate(v, lang))} {...AXIS_PROPS} minTickGap={16} />
        <YAxis domain={[40, 100]} tickFormatter={(v) => `${v}%`} {...AXIS_PROPS} />
        <Tooltip
          cursor={{ stroke: 'var(--line-strong)', strokeWidth: 1 }}
          content={<ChartTooltip labelFormatter={(v) => (labelFor ? labelFor(v) : formatShortDate(v, lang))} valueFormatter={(v) => formatPercent(v, lang)} nameFor={(k) => names[k]} />}
        />
        {teams.map((team) => (
          <Line key={team.id} type="monotone" dataKey={team.id} stroke={teamColor(team)} strokeWidth={2} dot={data.length < 16 ? { r: 3, strokeWidth: 0, fill: teamColor(team) } : false} activeDot={{ r: 5, stroke: 'var(--surface)', strokeWidth: 2 }} connectNulls isAnimationActive={false} />
        ))}
        {overallLabel && <Line type="monotone" dataKey="overall" stroke="var(--ink-3)" strokeWidth={2} strokeDasharray="4 4" dot={false} />}
      </LineChart>
    </ResponsiveContainer>
  );
}

export function TeamLegend({ teams, extra = [] }) {
  return <ChartLegend items={[...teams.map((tm) => ({ label: tm.name, color: teamColor(tm), shape: 'line' })), ...extra]} />;
}

/** Stacked W/D/L per team. Status hues, always paired with the legend + tooltip labels. */
export function MatchResultsChart({ data }) {
  const { t } = useI18n();
  const rows = data.map((r) => ({ name: r.team.short_name, full: r.team.name, won: r.won, drawn: r.drawn, lost: r.lost }));
  const label = { won: t('results.W'), drawn: t('results.D'), lost: t('results.L') };
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: -20 }} barCategoryGap="34%">
        <CartesianGrid {...GRID_PROPS} />
        <XAxis dataKey="name" {...AXIS_PROPS} tick={{ ...AXIS_PROPS.tick, fill: 'var(--ink-2)' }} />
        <YAxis allowDecimals={false} {...AXIS_PROPS} />
        <Tooltip
          cursor={{ fill: 'var(--surface-3)', opacity: 0.6 }}
          content={<ChartTooltip labelFormatter={(v) => rows.find((r) => r.name === v)?.full} nameFor={(k) => label[k]} />}
        />
        <Bar dataKey="won" stackId="r" fill={RESULT_COLORS.won} maxBarSize={24} stroke="var(--surface)" strokeWidth={2} />
        <Bar dataKey="drawn" stackId="r" fill={RESULT_COLORS.drawn} maxBarSize={24} stroke="var(--surface)" strokeWidth={2} />
        <Bar dataKey="lost" stackId="r" fill={RESULT_COLORS.lost} maxBarSize={24} radius={[4, 4, 0, 0]} stroke="var(--surface)" strokeWidth={2} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function ResultsLegend() {
  const { t } = useI18n();
  return (
    <ChartLegend
      items={[
        { label: t('results.W'), color: RESULT_COLORS.won },
        { label: t('results.D'), color: RESULT_COLORS.drawn },
        { label: t('results.L'), color: RESULT_COLORS.lost },
      ]}
    />
  );
}

/** Grouped columns: two measures per team (e.g. goals vs assists). */
export function GroupedTeamBars({ data, series }) {
  const rows = data.map((d) => ({ name: d.team.short_name, full: d.team.name, ...Object.fromEntries(series.map((s) => [s.key, d[s.key]])) }));
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: -20 }} barGap={2} barCategoryGap="28%">
        <CartesianGrid {...GRID_PROPS} />
        <XAxis dataKey="name" {...AXIS_PROPS} tick={{ ...AXIS_PROPS.tick, fill: 'var(--ink-2)' }} />
        <YAxis allowDecimals={false} {...AXIS_PROPS} />
        <Tooltip
          cursor={{ fill: 'var(--surface-3)', opacity: 0.6 }}
          content={<ChartTooltip labelFormatter={(v) => rows.find((r) => r.name === v)?.full} nameFor={(k) => series.find((s) => s.key === k)?.label} />}
        />
        {series.map((s) => (
          <Bar key={s.key} dataKey={s.key} fill={s.color} maxBarSize={20} radius={[4, 4, 0, 0]} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}
