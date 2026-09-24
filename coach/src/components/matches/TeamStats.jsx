import { useEffect, useState } from 'react';
import { Info } from 'lucide-react';
import TeamLogo from '@/components/common/TeamLogo';
import Button from '@/components/ui/Button';
import { Input } from '@/components/ui/Field';
import Modal from '@/components/ui/Modal';
import { useI18n } from '@/i18n';
import { MATCH_STAT_KEYS, TEAM_COLOR_VARS } from '@/utils/constants';

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

/** Edit stored team statistics (cards come from events, away possession is derived). */
export function TeamStatsModal({ open, match, onClose, onSubmit }) {
  const { t } = useI18n();
  const [values, setValues] = useState(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (open && match) setValues(JSON.parse(JSON.stringify(match.team_stats ?? { home: {}, away: {} })));
  }, [open, match]);
  if (!values) return null;
  const set = (side, key, v) => setValues((s) => ({ ...s, [side]: { ...s[side], [key]: v } }));
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await onSubmit(values);
    } catch {
      /* toast shown */
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('matches.teamStats.editTitle')}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} className="w-full sm:w-auto">
            {t('common.cancel')}
          </Button>
          <Button type="submit" form="team-stats-form" loading={busy} className="w-full sm:w-auto">
            {t('matches.teamStats.save')}
          </Button>
        </>
      }
    >
      <form id="team-stats-form" onSubmit={submit} className="space-y-3">
        <div className="grid grid-cols-[1fr_5.5rem_5.5rem] items-center gap-2 text-xs font-semibold text-ink-3">
          <span />
          <span className="truncate text-center">{match.home_team?.short_name}</span>
          <span className="truncate text-center">{match.away_team?.short_name}</span>
        </div>
        {MATCH_STAT_KEYS.map((key) => (
          <div key={key} className="grid grid-cols-[1fr_5.5rem_5.5rem] items-center gap-2">
            <span className="text-sm text-ink">{t(`matches.teamStats.${key}`)}</span>
            <Input
              type="number"
              inputMode="numeric"
              min={0}
              max={key === 'possession' ? 100 : 99}
              value={values.home[key] ?? 0}
              onChange={(e) => set('home', key, e.target.value)}
              aria-label={`${t(`matches.teamStats.${key}`)} — ${match.home_team?.name}`}
              className="text-center"
            />
            <Input
              type="number"
              inputMode="numeric"
              min={0}
              max={99}
              value={key === 'possession' ? 100 - (Number(values.home.possession) || 0) : values.away[key] ?? 0}
              onChange={(e) => set('away', key, e.target.value)}
              disabled={key === 'possession'}
              aria-label={`${t(`matches.teamStats.${key}`)} — ${match.away_team?.name}`}
              className="text-center"
            />
          </div>
        ))}
        <p className="flex gap-2 rounded-xl bg-surface-2 p-3 text-xs text-ink-2">
          <Info className="mt-0.5 size-4 shrink-0 text-ink-3" aria-hidden="true" />
          {t('matches.teamStats.possessionHint')} {t('matches.teamStats.fromEvents')}
        </p>
      </form>
    </Modal>
  );
}
