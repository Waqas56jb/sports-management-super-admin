import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useI18n } from '@/i18n';
import { TEAM_COLOR_VARS } from '@/utils/constants';
import { formatPercent, formatShortDate } from '@/utils/format';
import { animation, AXIS_PROPS, BAR_CURSOR, ChartLegend, ChartTooltip, GRID_PROPS, LINE_CURSOR, reveal, useChartPaint } from './ChartParts';

export const teamColor = (team) => TEAM_COLOR_VARS[(team?.color ?? 0) % TEAM_COLOR_VARS.length];

const RESULT_COLORS = { won: 'var(--good)', drawn: 'var(--neutral)', lost: 'var(--critical)' };

/** Horizontal stacked bars: available vs unavailable players, each team in its own hue. */
export function PlayersByTeamChart({ data }) {
  const paint = useChartPaint();
  const { t } = useI18n();
  const rows = data.map((d) => ({ name: d.team.name, active: d.active, unavailable: d.unavailable, color: teamColor(d.team) }));
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={rows} layout="vertical" margin={{ top: 4, right: 24, bottom: 4, left: 4 }} barCategoryGap="28%">
        {paint.defs}
        <CartesianGrid {...GRID_PROPS} horizontal={false} vertical />
        <XAxis type="number" allowDecimals={false} {...AXIS_PROPS} />
        <YAxis type="category" dataKey="name" width={112} {...AXIS_PROPS} tick={{ ...AXIS_PROPS.tick, fill: 'var(--ink-2)' }} />
        <Tooltip
          cursor={BAR_CURSOR}
          content={<ChartTooltip nameFor={(k) => (k === 'active' ? t('dashboard.playersByTeam.active') : t('dashboard.playersByTeam.unavailable'))} />}
        />
        <Bar {...animation(0)} dataKey="active" stackId="s" maxBarSize={22} stroke="var(--surface)" strokeWidth={2}>
          {rows.map((r) => (
            <Cell key={r.name} fill={paint.fill(r.color, 'h')} />
          ))}
        </Bar>
        <Bar {...animation(1)} dataKey="unavailable" stackId="s" maxBarSize={22} radius={[0, 7, 7, 0]} stroke="var(--surface)" strokeWidth={2}>
          {rows.map((r) => (
            <Cell key={r.name} fill={paint.fill(r.color, 'h')} fillOpacity={0.35} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Weekly attendance %, one 2px line per team (+ optional overall). */
export function AttendanceTrendChart({ data, teams, showOverall = false }) {
  const paint = useChartPaint();
  const { t, lang } = useI18n();
  const names = Object.fromEntries(teams.map((tm) => [tm.id, tm.name]));
  names.overall = t('dashboard.attendanceTrend.overall');
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -12 }}>
        {paint.defs}
        <CartesianGrid {...GRID_PROPS} />
        <XAxis dataKey="week" tickFormatter={(v) => formatShortDate(v, lang)} {...AXIS_PROPS} minTickGap={16} />
        <YAxis domain={[50, 100]} tickFormatter={(v) => `${v}%`} {...AXIS_PROPS} />
        <Tooltip
          cursor={LINE_CURSOR}
          content={
            <ChartTooltip
              labelFormatter={(v) => t('dashboard.attendanceTrend.week', { date: formatShortDate(v, lang) })}
              valueFormatter={(v) => formatPercent(v, lang)}
              nameFor={(k) => names[k]}
            />
          }
        />
        {teams.map((team) => (
          <Line className="chart-glow" strokeLinecap="round" {...reveal(teams.indexOf(team))}
            key={team.id}
            type="monotone"
            dataKey={team.id}
            stroke={teamColor(team)}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 5, stroke: 'var(--surface)', strokeWidth: 2 }}
            connectNulls
          />
        ))}
        {showOverall && <Line className="chart-glow" strokeLinecap="round" {...reveal(teams.length)} type="monotone" dataKey="overall" stroke="var(--ink-3)" strokeWidth={2} strokeDasharray="4 4" dot={false} />}
      </LineChart>
    </ResponsiveContainer>
  );
}

export function TeamLegend({ teams, extra = [] }) {
  return <ChartLegend items={[...teams.map((tm) => ({ label: tm.name, color: teamColor(tm), shape: 'line' })), ...extra]} />;
}

/** Stacked W/D/L per team. Status hues, always paired with the legend + tooltip labels. */
export function MatchResultsChart({ data }) {
  const paint = useChartPaint();
  const { t } = useI18n();
  const rows = data.map((r) => ({ name: r.team.short_name, full: r.team.name, won: r.won, drawn: r.drawn, lost: r.lost }));
  const label = { won: t('results.W'), drawn: t('results.D'), lost: t('results.L') };
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: -20 }} barCategoryGap="34%">
        {paint.defs}
        <CartesianGrid {...GRID_PROPS} />
        <XAxis dataKey="name" {...AXIS_PROPS} tick={{ ...AXIS_PROPS.tick, fill: 'var(--ink-2)' }} />
        <YAxis allowDecimals={false} {...AXIS_PROPS} />
        <Tooltip
          cursor={BAR_CURSOR}
          content={<ChartTooltip labelFormatter={(v) => rows.find((r) => r.name === v)?.full} nameFor={(k) => label[k]} colorFor={(k) => RESULT_COLORS[k]} />}
        />
        <Bar {...animation(0)} dataKey="won" stackId="r" fill={paint.fill(RESULT_COLORS.won, 'v')} maxBarSize={24} stroke="var(--surface)" strokeWidth={2} />
        <Bar {...animation(1)} dataKey="drawn" stackId="r" fill={paint.fill(RESULT_COLORS.drawn, 'v')} maxBarSize={24} stroke="var(--surface)" strokeWidth={2} />
        <Bar {...animation(2)} dataKey="lost" stackId="r" fill={paint.fill(RESULT_COLORS.lost, 'v')} maxBarSize={24} radius={[7, 7, 0, 0]} stroke="var(--surface)" strokeWidth={2} />
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
  const paint = useChartPaint();
  const rows = data.map((d) => ({ name: d.team.short_name, full: d.team.name, ...Object.fromEntries(series.map((s) => [s.key, d[s.key]])) }));
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: -20 }} barGap={2} barCategoryGap="28%">
        {paint.defs}
        <CartesianGrid {...GRID_PROPS} />
        <XAxis dataKey="name" {...AXIS_PROPS} tick={{ ...AXIS_PROPS.tick, fill: 'var(--ink-2)' }} />
        <YAxis allowDecimals={false} {...AXIS_PROPS} />
        <Tooltip
          cursor={BAR_CURSOR}
          content={<ChartTooltip labelFormatter={(v) => rows.find((r) => r.name === v)?.full} nameFor={(k) => series.find((s) => s.key === k)?.label} colorFor={(k) => series.find((s) => s.key === k)?.color} />}
        />
        {series.map((s) => (
          <Bar {...animation(series.indexOf(s))} key={s.key} dataKey={s.key} fill={paint.fill(s.color, 'v')} maxBarSize={20} radius={[7, 7, 0, 0]} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}
