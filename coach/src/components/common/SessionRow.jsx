import { Link } from 'react-router-dom';
import { Clock, MapPin } from 'lucide-react';
import { useI18n } from '@/i18n';
import { formatDate, formatTime } from '@/utils/format';
import { cn } from '@/utils/cn';
import TeamLogo from './TeamLogo';

/** Training session list item with a calendar-style date block. */
export default function SessionRow({ session, className, showTeam = true }) {
  const { t, lang } = useI18n();
  return (
    <Link to={`/coach/training/${session.id}`} className={cn('flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-surface-2 sm:px-4', className)}>
      <span className="flex w-12 shrink-0 flex-col items-center rounded-xl border border-line bg-surface-2 py-1.5">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-ink-3">{formatDate(session.date, lang, { month: 'short' })}</span>
        <span className="font-display text-xl font-bold leading-none text-ink tabular">{formatDate(session.date, lang, { day: 'numeric' })}</span>
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          {showTeam && <TeamLogo team={session.team} size="xs" />}
          <span className="truncate text-sm font-medium text-ink">
            {showTeam ? `${session.team?.name} · ` : ''}
            {t(`trainingTypes.${session.training_type}`)}
          </span>
        </span>
        <span className="mt-0.5 flex items-center gap-3 text-xs text-ink-3">
          <span className="inline-flex shrink-0 items-center gap-1 tabular">
            <Clock className="size-3" aria-hidden="true" />
            {formatTime(session.start_time)}–{formatTime(session.end_time)}
          </span>
          <span className="inline-flex min-w-0 items-center gap-1">
            <MapPin className="size-3 shrink-0" aria-hidden="true" />
            <span className="truncate">{session.location}</span>
          </span>
        </span>
      </span>
    </Link>
  );
}
