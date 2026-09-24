import { useEffect, useMemo, useState } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import { Ban, CalendarDays, CheckCheck, Clock, Dumbbell, MapPin, NotebookPen, Pencil, Save, Users } from 'lucide-react';
import BackLink from '@/components/common/BackLink';
import DetailGuard from '@/components/common/DetailGuard';
import ProfileHero from '@/components/common/ProfileHero';
import RowActions from '@/components/common/RowActions';
import TeamLogo, { TeamChip } from '@/components/common/TeamLogo';
import TrainingTypeBadge from '@/components/common/TrainingTypeBadge';
import Avatar from '@/components/ui/Avatar';
import { StatusBadge } from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Textarea } from '@/components/ui/Field';
import { DescriptionList, Meter } from '@/components/ui/Misc';
import { EmptyState } from '@/components/ui/States';
import { useAction } from '@/hooks/useAction';
import { useAttendanceSummary } from '@/hooks/useAttendance';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useQuery } from '@/hooks/useQuery';
import { useUnsavedChanges } from '@/hooks/useUnsavedChanges';
import { useI18n } from '@/i18n';
import { trainingService } from '@/services/trainingService';
import { ATTENDANCE_STATUSES } from '@/utils/constants';
import { durationMinutes, formatLongDate, formatPercent, formatTime, todayISO } from '@/utils/format';
import { cn } from '@/utils/cn';
import { useTrainingActions } from './useTrainingActions';

const STATUS_STYLE = {
  present: 'data-[on=true]:bg-emerald-600 data-[on=true]:text-white data-[on=true]:border-emerald-600',
  late: 'data-[on=true]:bg-amber-500 data-[on=true]:text-white data-[on=true]:border-amber-500',
  excused: 'data-[on=true]:bg-sky-600 data-[on=true]:text-white data-[on=true]:border-sky-600',
  absent: 'data-[on=true]:bg-red-600 data-[on=true]:text-white data-[on=true]:border-red-600',
};

function Register({ session, onSaved }) {
  const { t, lang } = useI18n();
  const run = useAction();
  const initial = useMemo(() => Object.fromEntries(session.register.map((r) => [r.player.id, { status: r.status, notes: r.notes }])), [session]);
  const [rows, setRows] = useState(initial);
  const [saving, setSaving] = useState(false);
  useEffect(() => setRows(initial), [initial]);

  const cancelled = session.status === 'cancelled';
  const editable = !cancelled && session.date <= todayISO();
  const dirty = JSON.stringify(rows) !== JSON.stringify(initial);
  const summary = useAttendanceSummary(useMemo(() => Object.values(rows), [rows]));
  useUnsavedChanges(dirty);

  const set = (id, patch) => setRows((r) => ({ ...r, [id]: { ...r[id], ...patch } }));
  const markAll = () => setRows((r) => Object.fromEntries(Object.entries(r).map(([id, v]) => [id, { ...v, status: v.status ?? 'present' }])));

  const save = async () => {
    setSaving(true);
    try {
      await run(() => trainingService.saveAttendance(session.id, Object.entries(rows).map(([player_id, v]) => ({ player_id, ...v }))), { success: 'training.toasts.attendanceSaved' });
      onSaved();
    } catch {
      /* toast shown */
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card id="register" className="scroll-mt-24">
      <CardHeader
        title={t('training.detail.register')}
        subtitle={cancelled ? t('training.detail.registerCancelled') : editable ? t('training.detail.registerHint') : t('training.detail.upcomingHint')}
        action={
          editable &&
          session.register.length > 0 && (
            <Button variant="secondary" size="sm" icon={CheckCheck} onClick={markAll}>
              {t('training.detail.markAll')}
            </Button>
          )
        }
      />
      {cancelled ? (
        <EmptyState compact icon={Ban} title={t('training.detail.registerCancelled')} />
      ) : session.register.length === 0 ? (
        <EmptyState compact icon={Users} title={t('training.detail.noPlayers')} />
      ) : (
        <>
          {summary.rate !== null && (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 pt-4 sm:px-5">
              <span className="text-sm text-ink-2">{t('training.detail.rate')}</span>
              <Meter value={summary.rate} className="min-w-32 flex-1" label={t('training.detail.rate')} />
              <span className="font-semibold text-ink tabular">{formatPercent(summary.rate, lang)}</span>
              <span className="flex gap-3 text-xs text-ink-3 tabular">
                {['present', 'late', 'excused', 'absent'].map((k) => (
                  <span key={k}>
                    {t(`status.${k}`)} {summary[k]}
                  </span>
                ))}
              </span>
            </div>
          )}
          <ul className="mt-3 divide-y divide-line border-t border-line">
            {session.register.map(({ player, player_status: playerStatus }) => {
              const row = rows[player.id] ?? {};
              return (
                <li key={player.id} className="flex flex-wrap items-center gap-3 px-4 py-3 sm:px-5">
                  <div className="flex min-w-52 flex-1 items-center gap-3">
                    <span className="w-6 text-center font-display text-lg font-bold text-ink-3 tabular">{player.jersey_number ?? '–'}</span>
                    <Avatar name={player.name} src={player.photo} size="sm" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-ink">{player.name}</p>
                      <p className="flex items-center gap-2 text-xs text-ink-3">
                        {t(`positions.${player.position}`)}
                        {playerStatus === 'suspended' && <StatusBadge value="suspended" className="h-5 px-2 text-[11px]" />}
                      </p>
                    </div>
                  </div>
                  <div role="radiogroup" aria-label={`${t('common.status')} — ${player.name}`} className="grid w-full grid-cols-4 gap-1.5 sm:w-[340px]">
                    {ATTENDANCE_STATUSES.map((s) => (
                      <button
                        key={s}
                        type="button"
                        role="radio"
                        aria-checked={row.status === s}
                        data-on={row.status === s}
                        disabled={!editable}
                        onClick={() => set(player.id, { status: row.status === s ? null : s })}
                        className={cn('h-10 rounded-lg border border-line px-1 text-xs font-medium text-ink-2 transition-colors hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-60 sm:h-9', STATUS_STYLE[s])}
                      >
                        {t(`status.${s}`)}
                      </button>
                    ))}
                  </div>
                  {row.status && row.status !== 'present' && (
                    <input
                      type="text"
                      value={row.notes ?? ''}
                      onChange={(e) => set(player.id, { notes: e.target.value })}
                      disabled={!editable}
                      placeholder={t('training.detail.notesPlaceholder')}
                      aria-label={`${t('training.detail.notes')} — ${player.name}`}
                      className="field-control basis-full"
                    />
                  )}
                </li>
              );
            })}
          </ul>
          {editable && (
            <div className="sticky bottom-[4.5rem] z-10 flex flex-col gap-3 rounded-b-(--radius-card) border-t border-line bg-surface/95 px-4 py-3 backdrop-blur sm:flex-row sm:items-center sm:justify-between sm:px-5 md:bottom-0">
              <p className="text-sm text-ink-3">
                {dirty ? <span className="font-medium text-amber-600 dark:text-amber-400">{t('training.detail.unsaved')}</span> : t('training.detail.unmarked', { count: summary.unmarked })}
              </p>
              <Button icon={Save} onClick={save} loading={saving} disabled={!dirty} className="w-full sm:w-auto">
                {t('training.detail.save')}
              </Button>
            </div>
          )}
        </>
      )}
    </Card>
  );
}

function CoachNotes({ session, onSaved }) {
  const { t } = useI18n();
  const run = useAction();
  const [notes, setNotes] = useState(session.notes ?? '');
  const [saving, setSaving] = useState(false);
  useEffect(() => setNotes(session.notes ?? ''), [session.notes]);
  const dirty = notes !== (session.notes ?? '');
  const save = async () => {
    setSaving(true);
    try {
      await run(() => trainingService.update(session.id, { notes }), { success: 'training.detail.notesSaved' });
      onSaved();
    } catch {
      /* toast shown */
    } finally {
      setSaving(false);
    }
  };
  return (
    <Card>
      <CardHeader title={t('training.detail.notesTitle')} subtitle={t('training.form.notesHint')} icon={NotebookPen} />
      <CardBody className="space-y-3">
        <Textarea aria-label={t('training.detail.notesTitle')} placeholder={t('training.detail.notesEmpty')} rows={4} value={notes} onChange={(e) => setNotes(e.target.value)} />
        <Button size="sm" variant="secondary" icon={Save} onClick={save} loading={saving} disabled={!dirty}>
          {t('training.detail.notesSave')}
        </Button>
      </CardBody>
    </Card>
  );
}

export default function TrainingDetailPage() {
  const { id } = useParams();
  const { t, lang } = useI18n();
  const { hash } = useLocation();
  const query = useQuery(() => trainingService.get(id), [id]);
  usePageTitle(query.data ? `${t(`trainingTypes.${query.data.training_type}`)} · ${query.data.team?.name}` : t('training.title'));
  const { actionsFor, modals, openEdit } = useTrainingActions({ onChanged: query.refetch, showView: false });

  useEffect(() => {
    if (hash === '#register' && query.data) document.getElementById('register')?.scrollIntoView({ behavior: 'smooth' });
  }, [hash, query.data]);

  return (
    <>
      <DetailGuard query={query} entity={t('calendar.kinds.training')} backTo="/coach/training" backLabel={t('training.detail.back')}>
        {(s) => {
          const cancelled = s.status === 'cancelled';
          return (
            <>
              <BackLink to="/coach/training">{t('training.detail.back')}</BackLink>
              <ProfileHero
                avatar={
                  <span className="grid size-24 place-items-center rounded-2xl bg-surface p-3 shadow-(--shadow-card) ring-4 ring-surface sm:size-28">
                    <TeamLogo team={s.team} size="2xl" className="size-full" />
                  </span>
                }
                title={`${t(`trainingTypes.${s.training_type}`)} · ${s.team?.name}`}
                badge={cancelled ? <StatusBadge value="cancelled" /> : <TrainingTypeBadge type={s.training_type} />}
                meta={
                  <>
                    <span className="inline-flex items-center gap-1 capitalize">
                      <CalendarDays className="size-3.5" aria-hidden="true" />
                      {formatLongDate(s.date, lang)}
                    </span>
                    <span className="inline-flex items-center gap-1 tabular">
                      <Clock className="size-3.5" aria-hidden="true" />
                      {formatTime(s.start_time)}–{formatTime(s.end_time)} ({t('training.duration', { count: durationMinutes(s.start_time, s.end_time) })})
                    </span>
                  </>
                }
                actions={
                  <>
                    {!cancelled && (
                      <Button variant="secondary" icon={Pencil} onClick={() => openEdit(s)} className="flex-1 sm:flex-none">
                        {t('common.edit')}
                      </Button>
                    )}
                    <div className="rounded-xl border border-line-strong">
                      <RowActions items={actionsFor(s)} />
                    </div>
                  </>
                }
              >
                {cancelled && (
                  <div role="status" className="flex items-start gap-3 border-t border-line bg-red-50 px-4 py-3 text-sm text-red-800 dark:bg-red-500/10 dark:text-red-200 sm:px-6">
                    <Ban className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                    <span>
                      {t('training.detail.cancelledBanner')}
                      {s.cancellation_reason && ` ${t('training.detail.cancelledReason', { reason: s.cancellation_reason })}`}
                    </span>
                  </div>
                )}
              </ProfileHero>
              <div className="mt-4 grid gap-4 sm:mt-6 sm:gap-6 xl:grid-cols-3">
                <div className="space-y-4 sm:space-y-6 xl:order-2">
                  <Card>
                    <CardHeader title={t('training.detail.plan')} icon={Dumbbell} />
                    <CardBody className="space-y-5">
                      {s.description && <p className="text-sm leading-relaxed text-ink-2">{s.description}</p>}
                      <DescriptionList
                        items={[
                          { label: t('common.team'), value: <TeamChip team={s.team} />, icon: Users },
                          { label: t('training.form.location'), value: s.location, icon: MapPin },
                        ]}
                      />
                    </CardBody>
                  </Card>
                  <CoachNotes session={s} onSaved={query.refetch} />
                </div>
                <div className="xl:order-1 xl:col-span-2">
                  <Register session={s} onSaved={query.refetch} />
                </div>
              </div>
            </>
          );
        }}
      </DetailGuard>
      {modals}
    </>
  );
}
