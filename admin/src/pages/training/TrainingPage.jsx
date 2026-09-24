import { useNavigate } from 'react-router-dom';
import { CalendarDays, Dumbbell, List, MapPin, Plus } from 'lucide-react';
import CalendarPanel from '@/components/calendar/CalendarPanel';
import RowActions from '@/components/common/RowActions';
import { TeamChip } from '@/components/common/TeamLogo';
import TrainingTypeBadge from '@/components/common/TrainingTypeBadge';
import Button from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import DataTable from '@/components/ui/DataTable';
import FilterBar from '@/components/ui/FilterBar';
import { Meter } from '@/components/ui/Misc';
import PageHeader from '@/components/ui/PageHeader';
import Pagination from '@/components/ui/Pagination';
import { EmptyState, ErrorState } from '@/components/ui/States';
import Tabs from '@/components/ui/Tabs';
import { useListParams } from '@/hooks/useListParams';
import { useOptions, useTeamOptions } from '@/hooks/useOptions';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useQuery } from '@/hooks/useQuery';
import { useI18n } from '@/i18n';
import { trainingService } from '@/services/trainingService';
import { PAGE_SIZE, TRAINING_TYPES } from '@/utils/constants';
import { durationMinutes, formatPercent, formatTime, formatWeekday } from '@/utils/format';
import { useTrainingActions } from './useTrainingActions';

export default function TrainingPage() {
  const { t, lang } = useI18n();
  usePageTitle(t('training.title'));
  const navigate = useNavigate();
  const toOptions = useOptions();
  const { teamOptions } = useTeamOptions();
  const { params, set, reset } = useListParams({ view: 'list', when: 'upcoming' });
  const isCalendar = params.view === 'calendar';

  const list = useQuery(
    () =>
      trainingService.list({
        search: params.search,
        teamId: params.team,
        type: params.type,
        from: params.from,
        to: params.to,
        when: params.when === 'all' ? undefined : params.when,
        page: params.page,
        pageSize: PAGE_SIZE,
        dir: params.when === 'all' ? 'desc' : undefined,
      }),
    [params.search, params.team, params.type, params.from, params.to, params.when, params.page],
    { enabled: !isCalendar },
  );
  const { actionsFor, modals, openCreate } = useTrainingActions({ onChanged: list.refetch });

  const attendanceCell = (s) =>
    s.attendance_recorded ? (
      <div className="w-28">
        <p className="mb-1 text-xs font-medium text-ink tabular">{formatPercent(s.attendance_rate, lang)}</p>
        <Meter value={s.attendance_rate} size="sm" label={t('training.columns.attendance')} />
      </div>
    ) : (
      <span className="text-xs text-ink-3">{t('training.notRecorded')}</span>
    );

  const columns = [
    {
      key: 'date',
      header: t('training.columns.date'),
      render: (s) => (
        <div>
          <p className="font-medium capitalize text-ink">{formatWeekday(s.date, lang)}</p>
          <p className="text-xs text-ink-3 tabular">
            {formatTime(s.start_time)}–{formatTime(s.end_time)} · {t('training.duration', { count: durationMinutes(s.start_time, s.end_time) })}
          </p>
        </div>
      ),
    },
    { key: 'team', header: t('training.columns.team'), render: (s) => <TeamChip team={s.team} /> },
    { key: 'type', header: t('training.columns.session'), render: (s) => <TrainingTypeBadge type={s.training_type} /> },
    { key: 'location', header: t('training.columns.location'), className: 'max-w-56', render: (s) => <span className="line-clamp-2">{s.location}</span> },
    { key: 'attendance', header: t('training.columns.attendance'), render: attendanceCell },
    { key: 'actions', header: <span className="sr-only">{t('common.actions')}</span>, align: 'right', render: (s) => <RowActions items={actionsFor(s)} /> },
  ];

  const filtersActive = params.search || params.team || params.type || params.from || params.to;

  return (
    <>
      <PageHeader
        title={t('training.title')}
        description={t('training.description')}
        actions={
          <Button icon={Plus} onClick={() => openCreate(params.team ? { team_id: params.team } : {})}>
            {t('training.add')}
          </Button>
        }
      />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        {!isCalendar ? (
          <Tabs
            label={t('training.title')}
            value={params.when}
            onChange={(v) => set({ when: v })}
            tabs={[
              { value: 'upcoming', label: t('training.tabs.upcoming') },
              { value: 'completed', label: t('training.tabs.completed') },
              { value: 'all', label: t('training.tabs.all') },
            ]}
          />
        ) : (
          <span />
        )}
        <Tabs
          label={t('training.views.list')}
          value={params.view}
          onChange={(v) => set({ view: v })}
          tabs={[
            { value: 'list', label: t('training.views.list'), icon: List },
            { value: 'calendar', label: t('training.views.calendar'), icon: CalendarDays },
          ]}
        />
      </div>

      {isCalendar ? (
        <CalendarPanel teamId={params.team} />
      ) : (
        <Card>
          <div className="border-b border-line p-3 sm:p-4">
            <FilterBar
              search={params.search ?? ''}
              onSearch={(v) => set({ search: v })}
              searchPlaceholder={t('training.searchPlaceholder')}
              filters={[
                { key: 'team', label: t('common.team'), options: teamOptions, placeholder: t('common.allTeams') },
                { key: 'type', label: t('training.form.type'), options: toOptions(TRAINING_TYPES, 'trainingTypes'), placeholder: t('training.allTypes') },
                { key: 'from', label: t('common.from'), type: 'date', className: 'sm:w-40' },
                { key: 'to', label: t('common.to'), type: 'date', className: 'sm:w-40' },
              ]}
              values={params}
              onChange={set}
              onReset={() => reset(['team', 'type', 'from', 'to', 'search'])}
            />
          </div>
          {list.error ? (
            <ErrorState error={list.error} onRetry={list.refetch} />
          ) : (
            <DataTable
              caption={t('training.title')}
              columns={columns}
              rows={list.data?.data}
              loading={list.loading}
              fetching={list.fetching}
              onRowClick={(s) => navigate(`/admin/training/${s.id}`)}
              empty={
                <EmptyState
                  icon={Dumbbell}
                  title={t('training.empty.title')}
                  description={t('training.empty.description')}
                  action={filtersActive ? <Button variant="secondary" onClick={() => reset(['team', 'type', 'from', 'to', 'search'])}>{t('common.reset')}</Button> : <Button icon={Plus} onClick={() => openCreate()}>{t('training.add')}</Button>}
                />
              }
              mobileCard={(s) => (
                <div className="flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <TeamChip team={s.team} link={false} />
                      <TrainingTypeBadge type={s.training_type} />
                    </div>
                    <p className="mt-1.5 text-sm capitalize text-ink-2">
                      {formatWeekday(s.date, lang)} · <span className="tabular">{formatTime(s.start_time)}–{formatTime(s.end_time)}</span>
                    </p>
                    <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-ink-3">
                      <MapPin className="size-3 shrink-0" aria-hidden="true" />
                      <span className="truncate">{s.location}</span>
                    </p>
                    {s.attendance_recorded && <div className="mt-2">{attendanceCell(s)}</div>}
                  </div>
                  <RowActions items={actionsFor(s)} />
                </div>
              )}
            />
          )}
          {list.data && list.data.total > 0 && (
            <div className="border-t border-line px-4 py-3 sm:px-5">
              <Pagination page={list.data.page} pages={list.data.pages} total={list.data.total} pageSize={list.data.pageSize} onChange={(page) => set({ page })} />
            </div>
          )}
        </Card>
      )}
      {modals}
    </>
  );
}
