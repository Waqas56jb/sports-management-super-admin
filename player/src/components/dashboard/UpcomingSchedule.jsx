import { Link } from 'react-router-dom';
import { CalendarDays, Dumbbell, Goal, Trophy, Users } from 'lucide-react';
import { Card, CardHeader } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/States';
import { useI18n } from '@/i18n';
import { formatRelativeDay, formatTime } from '@/utils/formatters';
import { cn } from '@/utils/cn';

const KIND = {
  training: [Dumbbell, 'bg-brand-500'],
  match: [Goal, 'bg-sky-500'],
  event: [Users, 'bg-violet-500'],
  competition: [Trophy, 'bg-amber-500'],
};

/** Timeline of the next 14 days: training, matches, team events and competition dates. */
export default function UpcomingSchedule({ items }) {
  const { t, lang } = useI18n();
  const label = (e) => {
    if (e.kind === 'training') return t(`training.titles.${e.item.training_type}`);
    if (e.kind === 'match') return `${e.item.home_team?.name} ${t('matches.vs')} ${e.item.away_team?.name}`;
    if (e.kind === 'event') return t(`teamEvents.${e.item.kind}`);
    return t(e.item.edge === 'start' ? 'dashboard.schedule.starts' : 'dashboard.schedule.ends', { name: `${e.item.name} ${e.item.season}` });
  };
  const link = (e) => (e.kind === 'training' ? `/player/training/${e.id}` : e.kind === 'match' ? `/player/matches/${e.id}` : e.kind === 'competition' ? `/player/competitions/${e.item.id}` : '/player/calendar');
  return (
    <Card className="flex flex-col">
      <CardHeader
        title={t('dashboard.schedule.title')}
        subtitle={t('dashboard.schedule.subtitle')}
        action={
          <Link to="/player/calendar" className="text-sm font-medium text-brand-700 hover:underline dark:text-brand-300">
            {t('nav.calendar')}
          </Link>
        }
      />
      {items.length === 0 ? (
        <EmptyState compact icon={CalendarDays} title={t('dashboard.schedule.empty')} />
      ) : (
        <ol className="relative mx-4 mb-4 mt-4 space-y-2.5 border-l border-line pl-5 sm:mx-5">
          {items.map((e) => {
            const [Icon, dot] = KIND[e.kind];
            return (
              <li key={`${e.kind}-${e.id}`} className="relative">
                <span className={cn('absolute -left-[26px] top-3.5 size-3 rounded-full ring-4 ring-surface', dot)} aria-hidden="true" />
                <Link to={link(e)} className="flex items-center gap-3 rounded-xl border border-line p-3 transition-colors hover:bg-surface-2">
                  <Icon className="size-4 shrink-0 text-ink-3" aria-hidden="true" />
                  <span className="min-w-0 flex-1">
                    <span className={cn('block truncate text-sm font-medium text-ink', e.cancelled && 'line-through opacity-60')}>{label(e)}</span>
                    <span className="block text-xs capitalize text-ink-3">
                      {t(`calendar.kinds.${e.kind}`)} · {formatRelativeDay(e.date, lang, t)}
                      {e.kind !== 'competition' && ` · ${formatTime(e.time)}`}
                      {e.cancelled && ` · ${t('status.cancelled')}`}
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ol>
      )}
    </Card>
  );
}
