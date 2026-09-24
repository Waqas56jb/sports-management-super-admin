import { CalendarPlus, ClipboardList, Dumbbell, Megaphone, Timer, UserRound } from 'lucide-react';
import { cn } from '@/utils/cn';

const MAP = {
  training_created: [Dumbbell, 'bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-300'],
  match_scheduled: [CalendarPlus, 'bg-sky-50 text-sky-700 dark:bg-sky-500/10 dark:text-sky-300'],
  match_reminder: [Timer, 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300'],
  lineup_announced: [ClipboardList, 'bg-violet-50 text-violet-700 dark:bg-violet-500/10 dark:text-violet-300'],
  team_announcement: [Megaphone, 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300'],
  account_update: [UserRound, 'bg-surface-3 text-ink-2'],
};

export default function NotificationIcon({ type, className }) {
  const [Icon, tone] = MAP[type] ?? MAP.account_update;
  return (
    <span className={cn('grid size-10 shrink-0 place-items-center rounded-xl', tone, className)}>
      <Icon className="size-[18px]" aria-hidden="true" />
    </span>
  );
}
