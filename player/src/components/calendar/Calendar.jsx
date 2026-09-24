import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarDays, ChevronLeft, ChevronRight, Dumbbell, Trophy, Users } from 'lucide-react';
import Button from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/States';
import Tabs from '@/components/ui/Tabs';
import { useIsMobile } from '@/hooks/useMediaQuery';
import { useI18n } from '@/i18n';
import { formatDate, formatLongDate, localeOf, toISODate, todayISO } from '@/utils/formatters';
import { cn } from '@/utils/cn';
import { monthGrid, shiftDate, weekDays } from './calendarUtils';

const KIND_STYLES = {
  training: 'bg-brand-50 text-brand-800 border-brand-200 dark:bg-brand-500/10 dark:text-brand-200 dark:border-brand-500/25',
  match: 'bg-sky-50 text-sky-800 border-sky-200 dark:bg-sky-500/10 dark:text-sky-200 dark:border-sky-500/25',
  competition: 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-500/10 dark:text-amber-200 dark:border-amber-500/25',
  event: 'bg-violet-50 text-violet-800 border-violet-200 dark:bg-violet-500/10 dark:text-violet-200 dark:border-violet-500/25',
};
const KIND_DOT = { training: 'bg-brand-500', match: 'bg-sky-500', competition: 'bg-amber-500', event: 'bg-violet-500' };
const KIND_ICON = { training: Dumbbell, match: CalendarDays, competition: Trophy, event: Users };

function useEventLabel() {
  const { t } = useI18n();
  return (e, long = false) => {
    if (e.kind === 'training') {
      const type = t(`trainingTypes.${e.training_type}`);
      return long ? `${e.team?.name} · ${type}` : `${e.team?.short_name} · ${type}`;
    }
    if (e.kind === 'match') {
      const vs = long ? `${e.home?.name} ${t('matches.vs')} ${e.away?.name}` : `${e.home?.short_name} – ${e.away?.short_name}`;
      return e.score ? `${vs} (${e.score})` : vs;
    }
    if (e.kind === 'event') return t(`teamEvents.${e.event_kind}`);
    return `${e.name} · ${t(e.edge === 'start' ? 'calendar.starts' : 'calendar.ends')}`;
  };
}

function EventChip({ event, compact }) {
  const label = useEventLabel();
  return (
    <Link
      to={event.link}
      className={cn('block truncate rounded-md border px-1.5 py-0.5 text-[11px] font-medium leading-4 transition-opacity hover:opacity-80', KIND_STYLES[event.kind], event.cancelled && 'line-through opacity-60')}
      title={label(event, true)}
    >
      {!compact && event.start && <span className="mr-1 tabular opacity-75">{event.start}</span>}
      {label(event)}
    </Link>
  );
}

function AgendaItem({ event }) {
  const { t } = useI18n();
  const label = useEventLabel();
  const Icon = KIND_ICON[event.kind];
  return (
    <Link to={event.link} className="flex min-h-14 items-center gap-3 rounded-xl border border-line bg-surface px-3 py-2.5 hover:bg-surface-2">
      <span className={cn('grid size-9 shrink-0 place-items-center rounded-lg border', KIND_STYLES[event.kind])}>
        <Icon className="size-4" aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className={cn('block truncate text-sm font-medium text-ink', event.cancelled && 'line-through opacity-70')}>{label(event, true)}</span>
        <span className="block truncate text-xs text-ink-3">
          {t(`calendar.kinds.${event.kind}`)}
          {event.start && ` · ${event.start}${event.end ? `–${event.end}` : ''}`}
          {event.cancelled && ` · ${t('status.cancelled')}`}
          {event.location && ` · ${event.location}`}
        </span>
      </span>
    </Link>
  );
}

/**
 * Controlled calendar. The parent fetches `events` for calendarRange(view, date).
 * events: [{ id, kind: 'training'|'match'|'competition', date, start, end, link, ... }]
 */
export default function Calendar({ events = [], loading, view, onViewChange, date, onDateChange, className }) {
  const { t, lang } = useI18n();
  const isMobile = useIsMobile();
  const [selected, setSelected] = useState(todayISO());
  const today = todayISO();

  const byDay = useMemo(() => {
    const map = {};
    events.forEach((e) => {
      (map[e.date] ??= []).push(e);
    });
    return map;
  }, [events]);

  const weekdayNames = useMemo(() => {
    const fmt = new Intl.DateTimeFormat(localeOf(lang), { weekday: isMobile ? 'narrow' : 'short' });
    return weekDays(new Date()).map((d) => fmt.format(d));
  }, [lang, isMobile]);

  const title =
    view === 'month'
      ? formatDate(date, lang, { month: 'long', year: 'numeric' })
      : view === 'week'
        ? `${formatDate(weekDays(date)[0], lang, { day: 'numeric', month: 'short' })} – ${formatDate(weekDays(date)[6], lang, { day: 'numeric', month: 'short', year: 'numeric' })}`
        : formatLongDate(date, lang);

  const legend = (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-2">
      {['training', 'match', 'event', 'competition'].map((k) => (
        <li key={k} className="inline-flex items-center gap-1.5">
          <span className={cn('size-2.5 rounded-full', KIND_DOT[k])} aria-hidden="true" />
          {t(`calendar.kinds.${k}`)}
        </li>
      ))}
    </ul>
  );

  return (
    <div className={cn('card overflow-hidden', className)}>
      <div className="flex flex-col gap-3 border-b border-line p-3 sm:flex-row sm:items-center sm:justify-between sm:p-4">
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="icon-sm" onClick={() => onDateChange(shiftDate(view, date, -1))} aria-label={t('calendar.previous')}>
            <ChevronLeft className="size-4" />
          </Button>
          <Button variant="secondary" size="icon-sm" onClick={() => onDateChange(shiftDate(view, date, 1))} aria-label={t('calendar.next')}>
            <ChevronRight className="size-4" />
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              onDateChange(new Date());
              setSelected(today);
            }}
          >
            {t('calendar.today')}
          </Button>
          <h2 className="ml-1 truncate text-base font-semibold capitalize text-ink" aria-live="polite">
            {title}
          </h2>
        </div>
        <Tabs
          size="sm"
          label={t('calendar.view')}
          value={view}
          onChange={onViewChange}
          tabs={[
            { value: 'month', label: t('calendar.month') },
            { value: 'week', label: t('calendar.week') },
            { value: 'day', label: t('calendar.day') },
          ]}
        />
      </div>

      <div className="px-3 pt-3 sm:px-4">{legend}</div>

      {loading ? (
        <div className="grid grid-cols-7 gap-1 p-3 sm:p-4">
          {Array.from({ length: 35 }, (_, i) => (
            <Skeleton key={i} className="h-12 sm:h-24" />
          ))}
        </div>
      ) : view === 'month' ? (
        <div className="p-2 sm:p-4">
          <div className="grid grid-cols-7 text-center text-xs font-medium uppercase text-ink-3" aria-hidden="true">
            {weekdayNames.map((d, i) => (
              <div key={i} className="py-2">
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 overflow-hidden rounded-xl border border-line bg-line gap-px" role="grid" aria-label={title}>
            {monthGrid(date).map((d) => {
              const iso = toISODate(d);
              const inMonth = d.getMonth() === date.getMonth();
              const dayEvents = byDay[iso] ?? [];
              const isToday = iso === today;
              if (isMobile) {
                return (
                  <button
                    key={iso}
                    type="button"
                    role="gridcell"
                    onClick={() => setSelected(iso)}
                    aria-selected={selected === iso}
                    aria-label={`${formatLongDate(iso, lang)} — ${t('calendar.eventsCount', { count: dayEvents.length })}`}
                    className={cn('flex h-14 flex-col items-center justify-start gap-1 bg-surface pt-1.5', !inMonth && 'bg-surface-2', selected === iso && 'bg-brand-50 dark:bg-brand-500/10')}
                  >
                    <span className={cn('grid size-7 place-items-center rounded-full text-sm tabular', isToday && 'bg-brand-600 font-semibold text-white dark:bg-brand-500 dark:text-brand-950', !inMonth && !isToday && 'text-ink-3', inMonth && !isToday && 'text-ink')}>
                      {d.getDate()}
                    </span>
                    <span className="flex gap-0.5" aria-hidden="true">
                      {[...new Set(dayEvents.map((e) => e.kind))].map((k) => (
                        <span key={k} className={cn('size-1.5 rounded-full', KIND_DOT[k])} />
                      ))}
                    </span>
                  </button>
                );
              }
              return (
                <div key={iso} role="gridcell" className={cn('min-h-28 bg-surface p-1.5', !inMonth && 'bg-surface-2')}>
                  <div className="mb-1 flex justify-end">
                    <span className={cn('grid size-6 place-items-center rounded-full text-xs tabular', isToday && 'bg-brand-600 font-semibold text-white dark:bg-brand-500 dark:text-brand-950', !inMonth && !isToday && 'text-ink-3', inMonth && !isToday && 'text-ink-2')}>
                      {d.getDate()}
                    </span>
                  </div>
                  <div className="space-y-1">
                    {dayEvents.slice(0, 3).map((e) => (
                      <EventChip key={e.id} event={e} />
                    ))}
                    {dayEvents.length > 3 && (
                      <button
                        type="button"
                        onClick={() => {
                          onDateChange(d);
                          onViewChange('day');
                        }}
                        className="w-full rounded px-1.5 text-left text-[11px] font-medium text-ink-3 hover:text-ink"
                      >
                        {t('calendar.more', { count: dayEvents.length - 3 })}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          {isMobile && (
            <div className="mt-4 space-y-2 px-1 pb-2">
              <h3 className="text-sm font-semibold capitalize text-ink">{formatLongDate(selected, lang)}</h3>
              {(byDay[selected] ?? []).length ? (
                byDay[selected].map((e) => <AgendaItem key={e.id} event={e} />)
              ) : (
                <p className="rounded-xl border border-dashed border-line py-6 text-center text-sm text-ink-3">{t('calendar.nothingScheduled')}</p>
              )}
            </div>
          )}
        </div>
      ) : view === 'week' ? (
        <div className="grid gap-px p-3 sm:p-4 md:grid-cols-7 md:gap-2">
          {weekDays(date).map((d) => {
            const iso = toISODate(d);
            const dayEvents = byDay[iso] ?? [];
            return (
              <div key={iso} className={cn('rounded-xl border border-line p-2 md:min-h-64', iso === today && 'border-brand-400 bg-brand-50/40 dark:border-brand-500/50 dark:bg-brand-500/5')}>
                <p className="mb-2 flex items-baseline gap-1.5 text-xs font-medium uppercase text-ink-3">
                  <span>{formatDate(d, lang, { weekday: 'short' })}</span>
                  <span className="text-base font-semibold text-ink tabular">{d.getDate()}</span>
                </p>
                <div className="space-y-1.5">
                  {dayEvents.length ? dayEvents.map((e) => <EventChip key={e.id} event={e} />) : <p className="text-xs text-ink-3 md:hidden">{t('calendar.nothingScheduled')}</p>}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="space-y-2 p-3 sm:p-4">
          {(byDay[toISODate(date)] ?? []).length ? (
            byDay[toISODate(date)].map((e) => <AgendaItem key={e.id} event={e} />)
          ) : (
            <EmptyState compact icon={CalendarDays} title={t('calendar.nothingScheduled')} />
          )}
        </div>
      )}
    </div>
  );
}
