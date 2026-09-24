import { Check } from 'lucide-react';
import CalendarPanel from '@/components/calendar/CalendarPanel';
import PageHeader from '@/components/ui/PageHeader';
import { useListParams } from '@/hooks/useListParams';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useI18n } from '@/i18n';
import { cn } from '@/utils/cn';

const KINDS = ['match', 'training', 'event', 'competition'];
const DOT = { training: 'bg-brand-500', match: 'bg-sky-500', competition: 'bg-amber-500', event: 'bg-violet-500' };
const VIEWS = ['month', 'week', 'day'];

export default function Calendar() {
  const { t } = useI18n();
  usePageTitle(t('calendarPage.title'));
  const { params, set } = useListParams({ view: 'month', kinds: KINDS.join(',') });
  const kinds = params.kinds.split(',').filter((k) => KINDS.includes(k));
  const view = VIEWS.includes(params.view) ? params.view : 'month';

  const toggle = (k) => {
    const next = kinds.includes(k) ? kinds.filter((x) => x !== k) : [...kinds, k];
    set({ kinds: next.length ? next.join(',') : KINDS.join(',') });
  };

  return (
    <>
      <PageHeader title={t('calendarPage.title')} description={t('calendarPage.description')} />
      <div role="group" aria-label={t('calendarPage.show')} className="mb-4 flex flex-wrap gap-2">
        {KINDS.map((k) => {
          const on = kinds.includes(k);
          return (
            <button
              key={k}
              type="button"
              aria-pressed={on}
              onClick={() => toggle(k)}
              className={cn('inline-flex h-11 items-center gap-2 rounded-full border px-3.5 text-sm font-medium transition-colors sm:h-9', on ? 'border-line-strong bg-surface text-ink shadow-sm' : 'border-dashed border-line text-ink-3 hover:text-ink')}
            >
              <span className={cn('grid size-4 place-items-center rounded-full', on ? DOT[k] : 'bg-surface-3')}>{on && <Check className="size-3 text-white" strokeWidth={3} aria-hidden="true" />}</span>
              {t(`calendar.kinds.${k}`)}
            </button>
          );
        })}
      </div>
      <CalendarPanel kinds={kinds} view={view} onViewChange={(v) => set({ view: v })} />
    </>
  );
}
