import TeamLogo from '@/components/common/TeamLogo';
import { useI18n } from '@/i18n';
import { TEAM_COLOR_VARS } from '@/utils/constants';

const color = (team) => TEAM_COLOR_VARS[(team?.color ?? 0) % TEAM_COLOR_VARS.length];

/** Rows shown in the comparison: stored team stats plus cards counted from events. */
export function statRows(match) {
  const s = match.team_stats;
  if (!s) return [];
  const count = (type, teamId) => match.events.filter((e) => e.event_type === type && e.team_id === teamId).length;
  const cards = {
    yellow_cards: [count('yellow_card', match.home_team_id), count('yellow_card', match.away_team_id)],
    red_cards: [count('red_card', match.home_team_id), count('red_card', match.away_team_id)],
  };
  const order = ['possession', 'shots', 'shots_on_target', 'corners', 'fouls', 'yellow_cards', 'red_cards', 'offsides'];
  return order.map((key) => ({ key, home: cards[key]?.[0] ?? s.home[key], away: cards[key]?.[1] ?? s.away[key], percent: key === 'possession' }));
}

/** Two-sided comparison bars — home on the left, away on the right, each in its team colour. */
export function TeamStatsComparison({ match, rows }) {
  const { t } = useI18n();
  return (
    <div>
      <div className="mb-4 flex items-center justify-between text-sm font-semibold text-ink">
        <span className="flex min-w-0 items-center gap-2">
          <TeamLogo team={match.home_team} size="sm" />
          <span className="truncate">{match.home_team?.short_name}</span>
        </span>
        <span className="flex min-w-0 items-center gap-2">
          <span className="truncate">{match.away_team?.short_name}</span>
          <TeamLogo team={match.away_team} size="sm" />
        </span>
      </div>
      <dl className="space-y-4">
        {rows.map((r) => {
          const total = r.home + r.away || 1;
          const homePct = r.percent ? r.home : (r.home / total) * 100;
          const awayPct = r.percent ? r.away : (r.away / total) * 100;
          const fmt = (v) => (r.percent ? `${v}%` : v);
          return (
            <div key={r.key}>
              <div className="mb-1.5 grid grid-cols-[3rem_1fr_3rem] items-center text-sm">
                <span className="font-semibold text-ink tabular">{fmt(r.home)}</span>
                <dt className="text-center text-xs font-medium text-ink-3">{t(`matches.teamStats.${r.key}`)}</dt>
                <span className="text-right font-semibold text-ink tabular">{fmt(r.away)}</span>
              </div>
              <dd className="flex h-2 gap-1" aria-label={`${match.home_team?.name} ${fmt(r.home)} — ${match.away_team?.name} ${fmt(r.away)}`}>
                <span className="flex flex-1 justify-end overflow-hidden rounded-full bg-surface-3">
                  <span className="h-full rounded-full" style={{ width: `${homePct}%`, background: color(match.home_team) }} />
                </span>
                <span className="flex flex-1 overflow-hidden rounded-full bg-surface-3">
                  <span className="h-full rounded-full" style={{ width: `${awayPct}%`, background: color(match.away_team) }} />
                </span>
              </dd>
            </div>
          );
        })}
      </dl>
    </div>
  );
}
