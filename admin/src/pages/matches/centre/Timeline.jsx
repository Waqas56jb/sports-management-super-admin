import { ArrowLeftRight, Goal, Handshake, Trash2 } from 'lucide-react';
import TeamLogo from '@/components/common/TeamLogo';
import { EmptyState } from '@/components/ui/States';
import { useI18n } from '@/i18n';
import { cn } from '@/utils/cn';

function EventIcon({ type }) {
  if (type === 'goal') return <Goal className="size-4 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />;
  if (type === 'assist') return <Handshake className="size-4 text-sky-600 dark:text-sky-400" aria-hidden="true" />;
  if (type === 'substitution') return <ArrowLeftRight className="size-4 text-ink-2" aria-hidden="true" />;
  return <span className={cn('block h-4 w-3 rounded-[2px]', type === 'yellow_card' ? 'bg-amber-400' : 'bg-red-600')} aria-hidden="true" />;
}

/**
 * Events in minute order. Home events sit left of the time rail, away events right (≥ sm).
 * Assists linked to a goal (same minute, same scorer) are folded into the goal row.
 */
export default function Timeline({ match, onDelete }) {
  const { t } = useI18n();
  const linkedAssists = new Set();
  const goals = match.events.filter((e) => e.event_type === 'goal');
  const assistFor = {};
  match.events
    .filter((e) => e.event_type === 'assist')
    .forEach((a) => {
      const goal = goals.find((g) => g.minute === a.minute && g.player_id === a.related_player_id);
      if (goal) {
        assistFor[goal.id] = a;
        linkedAssists.add(a.id);
      }
    });
  const events = match.events.filter((e) => !linkedAssists.has(e.id));

  if (!events.length) return <EmptyState compact icon={Goal} title={t('matches.centre.noEvents')} description={t('matches.centre.noEventsHint')} />;

  const name = (p) => p?.name ?? t('matches.centre.formerPlayer');
  let halfShown = false;

  return (
    <ol className="relative space-y-2 py-2">
      <span className="absolute inset-y-0 left-[3.25rem] w-px bg-line sm:left-1/2" aria-hidden="true" />
      {events.map((e) => {
        const home = e.team_id === match.home_team_id;
        const detail =
          e.event_type === 'goal' && assistFor[e.id]
            ? t('matches.centre.assistBy', { name: name(assistFor[e.id].player) })
            : e.event_type === 'substitution'
              ? t('matches.centre.subOn', { name: name(e.related_player) })
              : e.description;
        const showHalf = !halfShown && e.minute > 45;
        if (showHalf) halfShown = true;
        const body = (
          <div className={cn('group flex min-w-0 items-center gap-3 rounded-xl border border-line bg-surface px-3 py-2.5', home ? 'sm:flex-row-reverse sm:text-right' : '')}>
            <span className="relative grid size-8 shrink-0 place-items-center rounded-lg bg-surface-3">
              <EventIcon type={e.event_type} />
              <TeamLogo team={home ? match.home_team : match.away_team} size="xs" className="absolute -bottom-1.5 -right-1.5 size-4 sm:hidden" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold text-ink">
                {name(e.player)}
                {e.player?.jersey_number ? <span className="ml-1 font-normal text-ink-3">#{e.player.jersey_number}</span> : null}
              </span>
              <span className="block truncate text-xs text-ink-3">
                {t(`eventTypes.${e.event_type}`)}
                {detail ? ` · ${detail}` : ''}
                {e.event_type === 'goal' && e.description && assistFor[e.id] ? ` · ${e.description}` : ''}
              </span>
            </span>
            {onDelete && (
              <button
                type="button"
                onClick={() => onDelete(e)}
                className="grid size-9 shrink-0 place-items-center rounded-lg text-ink-3 hover:bg-red-50 hover:text-red-600 focus-visible:opacity-100 dark:hover:bg-red-500/10 sm:opacity-0 sm:group-hover:opacity-100"
                aria-label={`${t('matches.centre.deleteEvent')} — ${t(`eventTypes.${e.event_type}`)} ${e.minute}'`}
              >
                <Trash2 className="size-4" />
              </button>
            )}
          </div>
        );
        return (
          <li key={e.id}>
            {showHalf && (
              <div className="relative my-3 flex justify-start pl-8 sm:justify-center sm:pl-0">
                <span className="rounded-full border border-line bg-surface-2 px-3 py-0.5 text-xs font-medium text-ink-3">{t('matches.centre.halfTime')}</span>
              </div>
            )}
            <div className="grid grid-cols-[3rem_1fr] items-center gap-4 sm:grid-cols-[1fr_3.5rem_1fr] sm:gap-3">
              <div className="hidden min-w-0 sm:block">{home && body}</div>
              <span className="relative z-10 mx-auto grid h-7 min-w-12 place-items-center rounded-full border border-line bg-surface px-2 text-xs font-semibold text-ink tabular">
                {e.minute}'
              </span>
              <div className="min-w-0 sm:hidden">{body}</div>
              <div className="hidden min-w-0 sm:block">{!home && body}</div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
