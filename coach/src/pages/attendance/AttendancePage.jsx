import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CalendarCheck, CalendarX2, CheckCircle2, ClipboardCheck, Clock, Pencil, ShieldCheck, UserCheck } from 'lucide-react';
import ChartCard from '@/components/charts/ChartCard';
import RateBarChart from '@/components/charts/RateBarChart';
import { AttendanceTrendChart, TeamLegend, teamColor } from '@/components/charts/TeamCharts';
import PersonCell from '@/components/common/PersonCell';
import TeamLogo, { TeamChip } from '@/components/common/TeamLogo';
import TrainingTypeBadge from '@/components/common/TrainingTypeBadge';
import Badge, { StatusBadge } from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import DataTable from '@/components/ui/DataTable';
import { Input } from '@/components/ui/Field';
import FilterBar from '@/components/ui/FilterBar';
import { Meter } from '@/components/ui/Misc';
import Modal from '@/components/ui/Modal';
import PageHeader from '@/components/ui/PageHeader';
import Pagination from '@/components/ui/Pagination';
import { StatSkeleton } from '@/components/ui/Skeleton';
import StatCard from '@/components/ui/StatCard';
import { EmptyState, ErrorState } from '@/components/ui/States';
import Tabs from '@/components/ui/Tabs';
import { useAction } from '@/hooks/useAction';
import { useListParams } from '@/hooks/useListParams';
import { useOptions } from '@/hooks/useOptions';
import { usePageTitle } from '@/hooks/usePageTitle';
import { usePlayers } from '@/hooks/usePlayers';
import { useQuery } from '@/hooks/useQuery';
import { useTeams } from '@/hooks/useTeams';
import { useTrainingOptions } from '@/hooks/useTraining';
import { useI18n } from '@/i18n';
import { attendanceService } from '@/services/attendanceService';
import { ATTENDANCE_STATUSES, PAGE_SIZE } from '@/utils/constants';
import { formatDate, formatNumber, formatPercent, formatShortDate, formatTime, formatWeekday } from '@/utils/format';
import { cn } from '@/utils/cn';

const STATUS_ON = {
  present: 'border-emerald-600 bg-emerald-600 text-white',
  late: 'border-amber-500 bg-amber-500 text-white',
  excused: 'border-sky-600 bg-sky-600 text-white',
  absent: 'border-red-600 bg-red-600 text-white',
};

function RateCell({ rate }) {
  const { lang } = useI18n();
  return (
    <div className="flex w-36 items-center gap-2">
      <Meter value={rate} size="sm" className="flex-1" />
      <span className="w-11 text-right text-sm font-semibold text-ink tabular">{formatPercent(rate, lang)}</span>
    </div>
  );
}

function EditRecordModal({ record, onClose, onSaved }) {
  const { t, lang } = useI18n();
  const run = useAction();
  const [status, setStatus] = useState(record?.status);
  const [notes, setNotes] = useState(record?.notes ?? '');
  const [busy, setBusy] = useState(false);
  const [prev, setPrev] = useState(record);
  if (record !== prev) {
    setPrev(record);
    setStatus(record?.status);
    setNotes(record?.notes ?? '');
  }
  const save = async () => {
    setBusy(true);
    try {
      await run(() => attendanceService.updateRecord(record.id, { status, notes }), { success: 'attendance.edit.saved' });
      onSaved();
    } catch {
      /* toast shown */
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal
      open={!!record}
      onClose={onClose}
      size="sm"
      title={t('attendance.edit.title')}
      description={record ? t('attendance.edit.description', { player: record.player?.name, session: `${t(`trainingTypes.${record.session.training_type}`)}, ${formatDate(record.session.date, lang)}` }) : undefined}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} className="w-full sm:w-auto">
            {t('common.cancel')}
          </Button>
          <Button onClick={save} loading={busy} className="w-full sm:w-auto">
            {t('attendance.edit.save')}
          </Button>
        </>
      }
    >
      <div role="radiogroup" aria-label={t('common.status')} className="grid grid-cols-2 gap-2">
        {ATTENDANCE_STATUSES.map((s) => (
          <button key={s} type="button" role="radio" aria-checked={status === s} onClick={() => setStatus(s)} className={cn('h-11 rounded-xl border text-sm font-medium transition-colors', status === s ? STATUS_ON[s] : 'border-line text-ink-2 hover:bg-surface-2')}>
            {t(`status.${s}`)}
          </button>
        ))}
      </div>
      <Input className="mt-1" fieldClassName="mt-4" label={t('attendance.edit.notes')} value={notes} onChange={(e) => setNotes(e.target.value)} />
    </Modal>
  );
}

export default function AttendancePage() {
  const { t, lang } = useI18n();
  usePageTitle(t('attendance.title'));
  const navigate = useNavigate();
  const toOptions = useOptions();
  const { teams, teamOptions } = useTeams();
  const { params, set, reset } = useListParams({ tab: 'players', granularity: 'week' });
  const { players } = usePlayers({ teamId: params.team });
  const { sessions } = useTrainingOptions({ teamId: params.team });
  const [editing, setEditing] = useState(null);
  const scope = { teamId: params.team, playerId: params.player, sessionId: params.session, from: params.from, to: params.to };

  const overview = useQuery(() => attendanceService.overview({ ...scope, granularity: params.granularity }), [params.team, params.player, params.session, params.from, params.to, params.granularity]);
  const records = useQuery(
    () => attendanceService.records({ ...scope, status: params.status, page: params.page, pageSize: PAGE_SIZE }),
    [params.team, params.player, params.session, params.from, params.to, params.status, params.page],
    { enabled: params.tab === 'records' },
  );
  const data = overview.data;
  const trendTeams = useMemo(() => (params.team ? teams.filter((tm) => tm.id === params.team) : teams), [teams, params.team]);
  const g = params.granularity;
  const periodLabel = (v) => {
    const date = g === 'month' ? formatDate(v, lang, { month: 'long', year: 'numeric' }) : g === 'day' ? formatDate(v, lang, { weekday: 'short', day: 'numeric', month: 'short' }) : formatShortDate(v, lang);
    return t(`attendance.charts.period.${g}`, { date });
  };
  const tickFor = (v) => (g === 'month' ? formatDate(v, lang, { month: 'short' }) : formatShortDate(v, lang));

  const sessionLabel = (s) => `${formatShortDate(s.date, lang)} · ${s.team?.short_name} · ${t(`trainingTypes.${s.training_type}`)}`;

  const playerColumns = [
    { key: 'player', header: t('attendance.columns.player'), render: (r) => <PersonCell name={r.player.name} photo={r.player.photo} to={`/coach/players/${r.player.id}`} sub={t(`positions.${r.player.position}`)} size="sm" /> },
    { key: 'team', header: t('attendance.columns.team'), render: (r) => <TeamChip team={r.team} /> },
    { key: 'total', header: t('attendance.columns.sessions'), align: 'right', render: (r) => <span className="tabular">{r.total}</span> },
    ...['present', 'late', 'excused', 'absent'].map((k) => ({ key: k, header: t(`status.${k}`), align: 'right', render: (r) => <span className="tabular">{r[k]}</span> })),
    {
      key: 'rate',
      header: t('attendance.columns.rate'),
      render: (r) => (
        <div className="flex items-center gap-2">
          <RateCell rate={r.rate} />
          {r.rate < 75 && <Badge tone="danger">{t('attendance.needsAttention')}</Badge>}
        </div>
      ),
    },
  ];

  const sessionColumns = [
    { key: 'date', header: t('attendance.columns.date'), render: (r) => <span className="capitalize">{formatWeekday(r.session.date, lang)}</span> },
    { key: 'team', header: t('attendance.columns.team'), render: (r) => <TeamChip team={r.session.team} /> },
    { key: 'session', header: t('attendance.columns.session'), render: (r) => <TrainingTypeBadge type={r.session.training_type} /> },
    ...['present', 'late', 'excused', 'absent'].map((k) => ({ key: k, header: t(`status.${k}`), align: 'right', render: (r) => <span className="tabular">{r[k]}</span> })),
    { key: 'rate', header: t('attendance.columns.rate'), render: (r) => <RateCell rate={r.rate} /> },
  ];

  const recordColumns = [
    { key: 'date', header: t('attendance.columns.date'), render: (r) => <span className="capitalize">{formatWeekday(r.session.date, lang)}</span> },
    { key: 'player', header: t('attendance.columns.player'), render: (r) => <PersonCell name={r.player?.name} photo={r.player?.photo} size="sm" /> },
    { key: 'session', header: t('attendance.columns.session'), render: (r) => `${r.session.team?.short_name} · ${t(`trainingTypes.${r.session.training_type}`)}` },
    { key: 'status', header: t('attendance.columns.status'), render: (r) => <StatusBadge value={r.status} /> },
    { key: 'notes', header: t('attendance.columns.notes'), className: 'max-w-60', render: (r) => <span className="line-clamp-2 text-ink-3">{r.notes || '—'}</span> },
    {
      key: 'edit',
      header: <span className="sr-only">{t('common.actions')}</span>,
      align: 'right',
      render: (r) => (
        <Button variant="ghost" size="icon-sm" icon={Pencil} onClick={() => setEditing(r)} aria-label={`${t('attendance.edit.action')} — ${r.player?.name}`} />
      ),
    },
  ];

  const empty = <EmptyState icon={CalendarCheck} title={t('attendance.empty.title')} description={t('attendance.empty.description')} />;
  const s = data?.summary;

  return (
    <>
      <PageHeader title={t('attendance.title')} description={t('attendance.description')} />

      {data?.pending?.length > 0 && (
        <Card className="mb-4 border-amber-300 sm:mb-6 dark:border-amber-500/40">
          <CardHeader title={t('attendance.pending.title')} subtitle={t('attendance.pending.subtitle')} icon={ClipboardCheck} />
          <ul className="mt-3 divide-y divide-line border-t border-line">
            {data.pending.slice(0, 4).map((p) => (
              <li key={p.id} className="flex flex-wrap items-center gap-3 px-4 py-3 sm:px-5">
                <TeamLogo team={p.team} size="sm" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-ink">
                    {p.team?.name} · {t(`trainingTypes.${p.training_type}`)}
                  </span>
                  <span className="block text-xs capitalize text-ink-3">
                    {formatWeekday(p.date, lang)} · {formatTime(p.start_time)}
                  </span>
                </span>
                <Button size="sm" icon={ClipboardCheck} to={`/coach/training/${p.id}#register`}>
                  {t('attendance.pending.take')}
                </Button>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card className="mb-4 p-3 sm:mb-6 sm:p-4">
        <FilterBar
          filters={[
            { key: 'team', label: t('common.team'), options: teamOptions, placeholder: t('common.allTeams') },
            { key: 'player', label: t('attendance.filters.player'), options: players.map((p) => ({ value: p.id, label: p.name })), placeholder: t('attendance.filters.allPlayers'), className: 'sm:min-w-44' },
            { key: 'session', label: t('attendance.filters.session'), options: sessions.map((x) => ({ value: x.id, label: sessionLabel(x) })), placeholder: t('attendance.filters.allSessions'), className: 'sm:min-w-48 sm:max-w-60' },
            { key: 'status', label: t('common.status'), options: toOptions(ATTENDANCE_STATUSES, 'status'), placeholder: t('common.allStatuses') },
            { key: 'from', label: t('common.from'), type: 'date', className: 'sm:w-40' },
            { key: 'to', label: t('common.to'), type: 'date', className: 'sm:w-40' },
          ]}
          values={params}
          onChange={(patch) => set(patch.team !== undefined && patch.team !== params.team ? { ...patch, player: '', session: '' } : patch)}
          onReset={() => reset(['team', 'player', 'session', 'status', 'from', 'to'])}
        />
        {params.status && params.tab !== 'records' && <p className="mt-2 text-xs text-ink-3">{t('attendance.statusFilterHint')}</p>}
      </Card>

      {overview.error ? (
        <div className="card">
          <ErrorState error={overview.error} onRetry={overview.refetch} />
        </div>
      ) : (
        <>
          <section className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-5" aria-label={t('attendance.kpi.rate')}>
            {!s ? (
              Array.from({ length: 5 }, (_, i) => <StatSkeleton key={i} />)
            ) : (
              <>
                <StatCard className="col-span-2 lg:col-span-1" label={t('attendance.kpi.rate')} value={s.rate != null ? formatPercent(s.rate, lang) : '—'} icon={CalendarCheck} sub={t('attendance.kpi.rateSub')} />
                <StatCard label={t('attendance.kpi.present')} value={formatNumber(s.present, lang)} icon={UserCheck} tone="brand" />
                <StatCard label={t('attendance.kpi.late')} value={formatNumber(s.late, lang)} icon={Clock} tone="amber" />
                <StatCard label={t('attendance.kpi.excused')} value={formatNumber(s.excused, lang)} icon={ShieldCheck} tone="sky" />
                <StatCard label={t('attendance.kpi.absent')} value={formatNumber(s.absent, lang)} icon={CalendarX2} tone="rose" />
              </>
            )}
          </section>

          <div className="mt-4 grid gap-4 sm:mt-6 sm:gap-6 xl:grid-cols-3">
            <ChartCard
              className="xl:col-span-2"
              title={t('attendance.charts.trend')}
              subtitle={t(`attendance.charts.trendSub.${g}`)}
              loading={!data}
              empty={data && !data.trend.length}
              action={
                <Tabs
                  size="sm"
                  label={t('attendance.granularity.label')}
                  value={g}
                  onChange={(v) => set({ granularity: v })}
                  tabs={['day', 'week', 'month'].map((k) => ({ value: k, label: t(`attendance.granularity.${k}`) }))}
                />
              }
              legend={<TeamLegend teams={trendTeams} />}
              table={
                data && {
                  columns: [{ key: 'key', label: t('common.date') }, ...trendTeams.map((tm) => ({ key: tm.id, label: tm.short_name, align: 'right' }))],
                  rows: data.trend.map((r) => ({ key: periodLabel(r.key), ...Object.fromEntries(trendTeams.map((tm) => [tm.id, r[tm.id] != null ? formatPercent(r[tm.id], lang) : '—'])) })),
                }
              }
            >
              {data && <AttendanceTrendChart data={data.trend} teams={trendTeams} xKey="key" labelFor={periodLabel} tickFor={tickFor} />}
            </ChartCard>
            <ChartCard
              title={t('attendance.charts.byTeam')}
              subtitle={t('attendance.charts.byTeamSub')}
              loading={!data}
              empty={data && !data.byTeam.length}
              table={data && { columns: [{ key: 'team', label: t('common.team') }, { key: 'rate', label: t('attendance.charts.rate'), align: 'right' }], rows: data.byTeam.map((r) => ({ team: r.team.name, rate: formatPercent(r.rate, lang) })) }}
            >
              {data && <RateBarChart rows={data.byTeam.map((r) => ({ label: r.team.name, value: r.rate, color: teamColor(r.team) }))} label={t('attendance.charts.rate')} format={(v) => formatPercent(v, lang)} />}
            </ChartCard>
          </div>

          <Tabs
            className="mt-6"
            label={t('attendance.title')}
            value={params.tab}
            onChange={(v) => set({ tab: v })}
            tabs={[
              { value: 'players', label: t('attendance.tabs.players'), count: data?.players.length },
              { value: 'sessions', label: t('attendance.tabs.sessions'), count: data?.sessions.length },
              { value: 'records', label: t('attendance.tabs.records') },
            ]}
          />
          <Card className="mt-4">
            {params.tab === 'players' && (
              <DataTable
                caption={t('attendance.tabs.players')}
                columns={playerColumns}
                rows={data?.players}
                loading={!data}
                rowKey={(r) => r.player.id}
                empty={empty}
                onRowClick={(r) => navigate(`/coach/players/${r.player.id}`)}
                mobileCard={(r) => (
                  <div className="flex items-center gap-3">
                    <PersonCell name={r.player.name} photo={r.player.photo} sub={`${r.team?.short_name ?? ''} · ${r.total} ${t('attendance.columns.sessions').toLowerCase()}`} className="min-w-0 flex-1" />
                    <span className={cn('text-sm font-semibold tabular', r.rate < 75 ? 'text-red-600 dark:text-red-400' : 'text-ink')}>{formatPercent(r.rate, lang)}</span>
                  </div>
                )}
              />
            )}
            {params.tab === 'sessions' && (
              <DataTable
                caption={t('attendance.tabs.sessions')}
                columns={sessionColumns}
                rows={data?.sessions}
                loading={!data}
                rowKey={(r) => r.session.id}
                empty={empty}
                onRowClick={(r) => navigate(`/coach/training/${r.session.id}`)}
                mobileCard={(r) => (
                  <div className="flex items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <TeamChip team={r.session.team} link={false} />
                      <p className="mt-1 text-xs capitalize text-ink-3">
                        {formatWeekday(r.session.date, lang)} · {t(`trainingTypes.${r.session.training_type}`)}
                      </p>
                    </div>
                    <span className="text-sm font-semibold text-ink tabular">{formatPercent(r.rate, lang)}</span>
                  </div>
                )}
              />
            )}
            {params.tab === 'records' &&
              (records.error ? (
                <ErrorState error={records.error} onRetry={records.refetch} />
              ) : (
                <>
                  <DataTable
                    caption={t('attendance.tabs.records')}
                    columns={recordColumns}
                    rows={records.data?.data}
                    loading={records.loading}
                    fetching={records.fetching}
                    empty={empty}
                    mobileCard={(r) => (
                      <div className="flex items-center gap-3">
                        <PersonCell className="min-w-0 flex-1" name={r.player?.name} photo={r.player?.photo} sub={`${formatShortDate(r.session.date, lang)} · ${t(`trainingTypes.${r.session.training_type}`)}${r.notes ? ` · ${r.notes}` : ''}`} />
                        <button type="button" onClick={() => setEditing(r)} aria-label={`${t('attendance.edit.action')} — ${r.player?.name}`} className="rounded-full">
                          <StatusBadge value={r.status} />
                        </button>
                      </div>
                    )}
                  />
                  {records.data && records.data.total > 0 && (
                    <div className="border-t border-line px-4 py-3 sm:px-5">
                      <Pagination page={records.data.page} pages={records.data.pages} total={records.data.total} pageSize={records.data.pageSize} onChange={(page) => set({ page })} />
                    </div>
                  )}
                </>
              ))}
          </Card>
          {data && data.pending.length === 0 && (
            <p className="mt-3 flex items-center gap-2 text-xs text-ink-3">
              <CheckCircle2 className="size-3.5 text-emerald-600" aria-hidden="true" />
              {t('attendance.pending.none')} · <Link to="/coach/training" className="underline-offset-2 hover:underline">{t('nav.training')}</Link>
            </p>
          )}
        </>
      )}
      <EditRecordModal
        record={editing}
        onClose={() => setEditing(null)}
        onSaved={() => {
          setEditing(null);
          records.refetch();
          overview.refetch();
        }}
      />
    </>
  );
}
