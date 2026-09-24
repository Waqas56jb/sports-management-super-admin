import { useEffect, useRef, useState } from 'react';
import { Ban, ClipboardCheck, Eye, Info, Pencil, RotateCcw } from 'lucide-react';
import Button from '@/components/ui/Button';
import { Input, Select, Textarea } from '@/components/ui/Field';
import Modal from '@/components/ui/Modal';
import { useConfirm } from '@/context/ConfirmContext';
import { useAction } from '@/hooks/useAction';
import { useForm } from '@/hooks/useForm';
import { useOptions } from '@/hooks/useOptions';
import { useI18n } from '@/i18n';
import { teamService } from '@/services/teamService';
import { trainingService } from '@/services/trainingService';
import { TRAINING_TYPES } from '@/utils/constants';
import { formatDate, todayISO } from '@/utils/format';
import { after, maxLength, required } from '@/utils/validators';

const SCHEMA = {
  team_id: [required],
  date: [required],
  start_time: [required],
  end_time: [required, after('start_time')],
  location: [required],
  training_type: [required],
  description: [maxLength(600)],
  notes: [maxLength(600)],
};
const BLANK = { team_id: '', date: '', start_time: '17:00', end_time: '19:00', location: '', training_type: 'tactical', description: '', notes: '' };

function TrainingFormModal({ open, session, defaults, onClose, onSubmit }) {
  const { t } = useI18n();
  const toOptions = useOptions();
  const confirm = useConfirm();
  const [teams, setTeams] = useState([]);
  const form = useForm({ initial: BLANK, schema: SCHEMA, onSubmit });
  const { reset, values, setValue } = form;
  const [locationTouched, setLocationTouched] = useState(false);
  const initialRef = useRef(BLANK);

  useEffect(() => {
    if (!open) return;
    teamService.list().then(setTeams);
    const initial = session ? Object.fromEntries(Object.keys(BLANK).map((k) => [k, session[k] ?? BLANK[k]])) : { ...BLANK, date: todayISO(), ...defaults };
    initialRef.current = initial;
    reset(initial);
    setLocationTouched(!!session);
  }, [open, session, defaults, reset]);

  // Only one team? Pre-select it.
  useEffect(() => {
    if (open && !session && !values.team_id && teams.length === 1) setValue('team_id', teams[0].id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teams, open]);

  useEffect(() => {
    if (locationTouched || !values.team_id) return;
    const ground = teams.find((tm) => tm.id === values.team_id)?.home_ground;
    if (ground) setValue('location', ground);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [values.team_id, teams]);

  const dirty = JSON.stringify(values) !== JSON.stringify(initialRef.current);
  const requestClose = async () => {
    if (form.submitting) return;
    if (!dirty || (await confirm({ title: t('common.unsaved.title'), message: t('common.unsaved.message'), confirmLabel: t('common.unsaved.discard') }))) onClose();
  };

  const locationField = form.field('location');
  const teamChanged = session && values.team_id && values.team_id !== session.team_id;

  return (
    <Modal
      open={open}
      onClose={requestClose}
      size="lg"
      title={session ? t('training.form.editTitle') : t('training.form.createTitle')}
      footer={
        <>
          <Button variant="secondary" onClick={requestClose} className="w-full sm:w-auto">
            {t('common.cancel')}
          </Button>
          <Button type="submit" form="training-form" loading={form.submitting} className="w-full sm:w-auto">
            {session ? t('common.saveChanges') : t('training.form.create')}
          </Button>
        </>
      }
    >
      <form id="training-form" ref={form.formRef} onSubmit={form.handleSubmit} noValidate className="grid gap-4 sm:grid-cols-2">
        <Select label={t('training.form.team')} required options={teams.map((tm) => ({ value: tm.id, label: tm.name }))} placeholder={t('common.notSet')} {...form.field('team_id')} />
        <Select label={t('training.form.type')} required options={toOptions(TRAINING_TYPES, 'trainingTypes')} {...form.field('training_type')} />
        {teamChanged && (
          <p className="flex gap-2 rounded-xl bg-amber-50 p-3 text-xs text-amber-800 dark:bg-amber-500/10 dark:text-amber-200 sm:col-span-2">
            <Info className="size-4 shrink-0" aria-hidden="true" />
            {t('training.form.teamChangeWarning')}
          </p>
        )}
        <Input label={t('training.form.date')} type="date" required fieldClassName="sm:col-span-2" {...form.field('date')} />
        <Input label={t('training.form.start')} type="time" required {...form.field('start_time')} />
        <Input label={t('training.form.end')} type="time" required {...form.field('end_time')} />
        <Input
          label={t('training.form.location')}
          hint={t('training.form.locationHint')}
          required
          fieldClassName="sm:col-span-2"
          {...locationField}
          onChange={(e) => {
            setLocationTouched(true);
            locationField.onChange(e);
          }}
        />
        <Textarea label={t('training.form.description')} placeholder={t('training.form.descriptionPlaceholder')} rows={3} fieldClassName="sm:col-span-2" {...form.field('description')} />
        <Textarea label={t('training.form.notes')} placeholder={t('training.form.notesPlaceholder')} hint={t('training.form.notesHint')} rows={3} fieldClassName="sm:col-span-2" {...form.field('notes')} />
      </form>
    </Modal>
  );
}

function CancelModal({ session, onClose, onConfirm }) {
  const { t, lang } = useI18n();
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => setReason(''), [session]);
  const submit = async () => {
    setBusy(true);
    try {
      await onConfirm(reason);
    } catch {
      /* toast shown */
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal
      open={!!session}
      onClose={() => !busy && onClose()}
      size="sm"
      role="alertdialog"
      title={t('training.cancel.title')}
      description={session ? t('training.cancel.message', { type: t(`trainingTypes.${session.training_type}`), team: session.team?.name, date: formatDate(session.date, lang) }) : undefined}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy} className="w-full sm:w-auto">
            {t('training.cancel.keep')}
          </Button>
          <Button variant="danger" icon={Ban} onClick={submit} loading={busy} className="w-full sm:w-auto">
            {t('training.cancel.confirm')}
          </Button>
        </>
      }
    >
      <Textarea label={t('training.cancel.reason')} placeholder={t('training.cancel.reasonPlaceholder')} rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />
    </Modal>
  );
}

/** Create / edit / cancel / reinstate training sessions. */
export function useTrainingActions({ onChanged, showView = true }) {
  const { t } = useI18n();
  const run = useAction();
  const [modal, setModal] = useState({ open: false, session: null, defaults: null });
  const [cancelling, setCancelling] = useState(null);
  const close = () => setModal({ open: false, session: null, defaults: null });

  const save = async (values) => {
    if (modal.session) await run(() => trainingService.update(modal.session.id, values), { success: 'training.toasts.updated' });
    else await run(() => trainingService.create(values), { success: 'training.toasts.created' });
    close();
    onChanged?.();
  };

  const cancel = async (reason) => {
    await run(() => trainingService.cancel(cancelling.id, reason), { success: 'training.toasts.cancelled' });
    setCancelling(null);
    onChanged?.();
  };

  const restore = async (s) => {
    await run(() => trainingService.restore(s.id), { success: 'training.toasts.restored' }).catch(() => {});
    onChanged?.();
  };

  const actionsFor = (s) => {
    const cancelled = s.status === 'cancelled';
    return [
      showView && { label: t('training.actions.view'), icon: Eye, to: `/coach/training/${s.id}` },
      showView && !cancelled && s.date <= todayISO() && { label: t('training.actions.attendance'), icon: ClipboardCheck, to: `/coach/training/${s.id}#register` },
      !cancelled && { label: t('training.actions.edit'), icon: Pencil, onClick: () => setModal({ open: true, session: s }) },
      { divider: true },
      cancelled
        ? { label: t('training.actions.restore'), icon: RotateCcw, onClick: () => restore(s) }
        : { label: t('training.actions.cancel'), icon: Ban, tone: 'danger', onClick: () => setCancelling(s) },
    ];
  };

  const modals = (
    <>
      <TrainingFormModal open={modal.open} session={modal.session} defaults={modal.defaults} onClose={close} onSubmit={save} />
      <CancelModal session={cancelling} onClose={() => setCancelling(null)} onConfirm={cancel} />
    </>
  );
  return {
    actionsFor,
    modals,
    openCreate: (defaults = {}) => setModal({ open: true, session: null, defaults }),
    openEdit: (s) => setModal({ open: true, session: s }),
    openCancel: setCancelling,
    restore,
  };
}
