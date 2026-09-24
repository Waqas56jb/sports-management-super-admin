import { CalendarCheck, Dumbbell, Goal, Megaphone, ServerCog, Timer, Trophy } from 'lucide-react';
import { cn } from '@/utils/cn';

const MAP = {
  match_reminder: [Timer, 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300'],
  training_reminder: [Dumbbell, 'bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-300'],
  match_result: [Goal, 'bg-sky-50 text-sky-700 dark:bg-sky-500/10 dark:text-sky-300'],
  attendance_update: [CalendarCheck, 'bg-violet-50 text-violet-700 dark:bg-violet-500/10 dark:text-violet-300'],
  team_announcement: [Megaphone, 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300'],
  competition_update: [Trophy, 'bg-orange-50 text-orange-700 dark:bg-orange-500/10 dark:text-orange-300'],
  system: [ServerCog, 'bg-surface-3 text-ink-2'],
};

export default function NotificationIcon({ type, className }) {
  const [Icon, tone] = MAP[type] ?? MAP.system;
  return (
    <span className={cn('grid size-10 shrink-0 place-items-center rounded-xl', tone, className)}>
      <Icon className="size-[18px]" aria-hidden="true" />
    </span>
  );
}
