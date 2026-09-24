import { CalendarDays, Dumbbell, List } from 'lucide-react';
import CalendarPanel from '@/components/calendar/CalendarPanel';
import TrainingItem from '@/components/training/TrainingItem';
import Button from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import FilterBar from '@/components/ui/FilterBar';
import PageHeader from '@/components/ui/PageHeader';
import Pagination from '@/components/ui/Pagination';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState, ErrorState } from '@/components/ui/States';
import Tabs from '@/components/ui/Tabs';
import { useListParams } from '@/hooks/useListParams';
import { useOptions } from '@/hooks/useOptions';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useTrainingCounts, useTrainingSessions } from '@/hooks/useTraining';
import { useI18n } from '@/i18n';
import { TRAINING_TYPES } from '@/utils/constants';
import { cn } from '@/utils/cn';

const TABS = ['upcoming', 'completed', 'cancelled'];
const FILTERS = ['type', 'from', 'to'];

export default function Training() {
  const { t } = useI18n();
  usePageTitle(t('training.title'));
  const toOptions = useOptions();
  const { params, set, reset } = useListParams({ tab: 'upcoming', view: 'list' });
  const tab = TABS.includes(params.tab) ? params.tab : 'upcoming';
  const isCalendar = params.view === 'calendar';
  const counts = useTrainingCounts();
  const list = useTrainingSessions({ tab, type: params.type, from: params.from, to: params.to, page: params.page, pageSize: 10 });
  const filtersActive = FILTERS.some((k) => params[k]);

  return (
    <>
      <PageHeader title={t('training.title')} description={t('training.description')} />
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        {!isCalendar ? (
          <Tabs label={t('training.title')} value={tab} onChange={(v) => set({ tab: v })} tabs={TABS.map((k) => ({ value: k, label: t(`training.tabs.${k}`), count: counts.data?.[k] }))} />
        ) : (
          <span />
        )}
        <Tabs
          label={t('training.views.list')}
          value={isCalendar ? 'calendar' : 'list'}
          onChange={(v) => set({ view: v })}
          tabs={[
            { value: 'list', label: t('training.views.list'), icon: List },
            { value: 'calendar', label: t('training.views.calendar'), icon: CalendarDays },
          ]}
        />
      </div>

      {isCalendar ? (
        <CalendarPanel kinds={['training']} />
      ) : (
        <Card>
          <div className="border-b border-line p-3 sm:p-4">
            <FilterBar
              filters={[
                { key: 'type', label: t('training.type'), options: toOptions(TRAINING_TYPES, 'trainingTypes'), placeholder: t('training.allTypes'), className: 'sm:min-w-48' },
                { key: 'from', label: t('common.from'), type: 'date', className: 'sm:w-40' },
                { key: 'to', label: t('common.to'), type: 'date', className: 'sm:w-40' },
              ]}
              values={params}
              onChange={set}
              onReset={() => reset(FILTERS)}
            />
          </div>
          {list.error ? (
            <ErrorState error={list.error} onRetry={list.refetch} />
          ) : list.loading ? (
            <div className="space-y-3 p-4" role="status" aria-label={t('common.loading')}>
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-16" />
              ))}
            </div>
          ) : list.data.data.length === 0 ? (
            <EmptyState
              icon={Dumbbell}
              title={t(`training.empty.${tab}`)}
              description={filtersActive ? undefined : t('training.empty.hint')}
              action={filtersActive && <Button variant="secondary" onClick={() => reset(FILTERS)}>{t('common.reset')}</Button>}
            />
          ) : (
            <>
              <div className={cn('divide-y divide-line px-1.5 py-1.5 sm:px-2', list.fetching && 'opacity-60')}>
                {list.data.data.map((s) => (
                  <TrainingItem key={s.id} session={s} className="rounded-none first:rounded-t-xl last:rounded-b-xl" />
                ))}
              </div>
              <div className="border-t border-line px-4 py-3 sm:px-5">
                <Pagination page={list.data.page} pages={list.data.pages} total={list.data.total} pageSize={list.data.pageSize} onChange={(page) => set({ page })} />
              </div>
            </>
          )}
        </Card>
      )}
      <p className="mt-3 text-xs text-ink-3">{t('training.detail.readOnly')}</p>
    </>
  );
}
