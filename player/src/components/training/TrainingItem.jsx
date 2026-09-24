import { Link } from 'react-router-dom';
import { Clock, MapPin, UserRound } from 'lucide-react';
import { StatusBadge } from '@/components/ui/Badge';
import { useI18n } from '@/i18n';
import { formatDate, formatRelativeDay, formatTime } from '@/utils/formatters';
import { cn } from '@/utils/cn';

/** Session card: date block, title, time, location, coach and the player's own attendance status. */
export default function TrainingItem({ session, className, showAttendance = true }) {
  const { t, lang } = useI18n();
  const cancelled = session.status === 'cancelled';
  return (
    <Link to={`/player/training/${session.id}`} className={cn('flex items-start gap-3 rounded-xl px-3 py-3 transition-colors hover:bg-surface-2 sm:px-4', className)}>
      <span className="flex w-12 shrink-0 flex-col items-center rounded-xl border border-line bg-surface-2 py-1.5">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-ink-3">{formatDate(session.date, lang, { month: 'short' })}</span>
        <span className="font-display text-xl font-bold leading-none text-ink tabular">{formatDate(session.date, lang, { day: 'numeric' })}</span>
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className={cn('text-sm font-semibold text-ink', cancelled && 'line-through opacity-70')}>{t(`training.titles.${session.training_type}`)}</span>
          {cancelled ? <StatusBadge value="cancelled" /> : showAttendance && session.my_attendance && <StatusBadge value={session.my_attendance.status} />}
        </span>
        <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-ink-3">
          <span className="inline-flex items-center gap-1 capitalize tabular">
            <Clock className="size-3" aria-hidden="true" />
            {formatRelativeDay(session.date, lang, t)} · {formatTime(session.start_time)}–{formatTime(session.end_time)}
          </span>
          <span className="inline-flex min-w-0 items-center gap-1">
            <MapPin className="size-3 shrink-0" aria-hidden="true" />
            <span className="truncate">{session.location}</span>
          </span>
          {session.coach_name && (
            <span className="inline-flex items-center gap-1">
              <UserRound className="size-3" aria-hidden="true" />
              {t('dashboard.training.coach', { name: session.coach_name })}
            </span>
          )}
        </span>
      </span>
    </Link>
  );
}
