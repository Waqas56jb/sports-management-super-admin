import { Link } from 'react-router-dom';
import { CalendarDays, Dumbbell, Goal, MapPin } from 'lucide-react';
import TeamLogo from '@/components/common/TeamLogo';
import { StatusBadge } from '@/components/ui/Badge';
import { Card, CardHeader } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/States';
import { useI18n } from '@/i18n';
import { formatTime } from '@/utils/format';
import { cn } from '@/utils/cn';

/** Timeline of today's training sessions and matches for the coach's teams. */
export default function TodaySchedule({ items }) {
  const { t } = useI18n();
  return (
    <Card className="flex flex-col">
      <CardHeader
        title={t('dashboard.today.title')}
        action={
          <Link to="/coach/calendar?view=day" className="text-sm font-medium text-brand-700 hover:underline dark:text-brand-300">
            {t('dashboard.today.calendar')}
          </Link>
        }
      />
      {items.length === 0 ? (
        <EmptyState compact icon={CalendarDays} title={t('dashboard.today.empty')} description={t('dashboard.today.emptyHint')} />
      ) : (
        <ol className="relative mx-4 mb-4 mt-4 space-y-3 border-l border-line pl-5 sm:mx-5">
          {items.map(({ kind, time, end, item }) => {
            const training = kind === 'training';
            return (
              <li key={`${kind}-${item.id}`} className="relative">
                <span
                  className={cn('absolute -left-[27px] top-3 grid size-3.5 place-items-center rounded-full ring-4 ring-surface', training ? 'bg-brand-500' : 'bg-sky-500')}
                  aria-hidden="true"
                />
                <Link
                  to={training ? `/coach/training/${item.id}` : `/coach/matches/${item.id}`}
                  className="flex items-start gap-3 rounded-xl border border-line p-3 transition-colors hover:bg-surface-2"
                >
                  <span className="w-12 shrink-0 pt-0.5 text-sm font-semibold text-ink tabular">{formatTime(time)}</span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-ink-3">
                      {training ? <Dumbbell className="size-3.5" aria-hidden="true" /> : <Goal className="size-3.5" aria-hidden="true" />}
                      {training ? t('dashboard.today.training') : t('dashboard.today.match')}
                      {end && <span className="normal-case tracking-normal tabular">· {formatTime(time)}–{formatTime(end)}</span>}
                    </span>
                    <span className="mt-1 flex items-center gap-2 text-sm font-semibold text-ink">
                      {training ? (
                        <>
                          <TeamLogo team={item.team} size="xs" />
                          <span className="truncate">
                            {item.team?.name} · {t(`trainingTypes.${item.training_type}`)}
                          </span>
                        </>
                      ) : (
                        <span className="truncate">
                          {item.home_team?.name} {t('matches.vs')} {item.away_team?.name}
                        </span>
                      )}
                    </span>
                    <span className="mt-0.5 flex items-center gap-1 truncate text-xs text-ink-3">
                      <MapPin className="size-3 shrink-0" aria-hidden="true" />
                      <span className="truncate">{item.location}</span>
                    </span>
                  </span>
                  {!training && item.status === 'live' && <StatusBadge value="live" />}
                </Link>
              </li>
            );
          })}
        </ol>
      )}
    </Card>
  );
}
