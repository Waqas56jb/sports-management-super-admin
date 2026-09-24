import { useEffect, useState } from 'react';
import { ClipboardCheck, Eye, Info, Pencil, Trash2 } from 'lucide-react';
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
};
const BLANK = { team_id: '', date: '', start_time: '17:00', end_time: '19:00', location: '', training_type: 'tactical', description: '' };

function TrainingFormModal({ open, session, defaults, onClose, onSubmit }) {
  const { t } = useI18n();
  const toOptions = useOptions();
  const [teams, setTeams] = useState([]);
  const form = useForm({ initial: BLANK, schema: SCHEMA, onSubmit });
  const { reset, values, setValue } = form;
  const [locationTouched, setLocationTouched] = useState(false);

  useEffect(() => {
    if (!open) return;
    teamService.list({ pageSize: 'all' }).then((r) => setTeams(r.data));
    reset(session ? Object.fromEntries(Object.keys(BLANK).map((k) => [k, session[k] ?? BLANK[k]])) : { ...BLANK, date: todayISO(), ...defaults });
    setLocationTouched(!!session);
  }, [open, session, defaults, reset]);

  useEffect(() => {
    if (locationTouched || !values.team_id) return;
    const ground = teams.find((tm) => tm.id === values.team_id)?.home_ground;
    if (ground) setValue('location', ground);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [values.team_id, teams]);

  const locationField = form.field('location');
  const teamChanged = session && values.team_id && values.team_id !== session.team_id;

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={session ? t('training.form.editTitle') : t('training.form.createTitle')}
      description={session ? undefined : t('training.form.createDescription')}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} className="w-full sm:w-auto">
            {t('common.cancel')}
          </Button>
          <Button type="submit" form="training-form" loading={form.submitting} className="w-full sm:w-auto">
            {session ? t('common.saveChanges') : t('training.form.create')}
          </Button>
        </>
      }
    >
      <form id="training-form" ref={form.formRef} onSubmit={form.handleSubmit} noValidate className="grid gap-4 sm:grid-cols-2">
        <Select label={t('training.form.team')} required options={teams.filter((tm) => tm.status === 'active' || tm.id === session?.team_id).map((tm) => ({ value: tm.id, label: tm.name }))} placeholder={t('common.notSet')} {...form.field('team_id')} />
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
        <Textarea label={t('training.form.description')} placeholder={t('training.form.descriptionPlaceholder')} rows={4} fieldClassName="sm:col-span-2" {...form.field('description')} />
      </form>
    </Modal>
  );
}

export function useTrainingActions({ onChanged, onDeleted, showView = true }) {
  const { t, lang } = useI18n();
  const confirm = useConfirm();
  const run = useAction();
  const [modal, setModal] = useState({ open: false, session: null, defaults: null });
  const close = () => setModal({ open: false, session: null, defaults: null });

  const save = async (values) => {
    if (modal.session) await run(() => trainingService.update(modal.session.id, values), { success: 'training.toasts.updated' });
    else await run(() => trainingService.create(values), { success: 'training.toasts.created' });
    close();
    onChanged?.();
  };

  const remove = async (s) => {
    const ok = await confirm({
      title: t('training.confirmDelete.title'),
      message: t('training.confirmDelete.message', { type: t(`trainingTypes.${s.training_type}`), team: s.team?.name, date: formatDate(s.date, lang) }),
      confirmLabel: t('training.actions.delete'),
      onConfirm: () => run(() => trainingService.remove(s.id), { success: 'training.toasts.deleted' }),
    });
    if (ok) (onDeleted ?? onChanged)?.();
  };

  const actionsFor = (s) => [
    showView && { label: t('training.actions.view'), icon: Eye, to: `/admin/training/${s.id}` },
    showView && s.date <= todayISO() && { label: t('training.actions.attendance'), icon: ClipboardCheck, to: `/admin/training/${s.id}#register` },
    { label: t('training.actions.edit'), icon: Pencil, onClick: () => setModal({ open: true, session: s }) },
    { divider: true },
    { label: t('training.actions.delete'), icon: Trash2, tone: 'danger', onClick: () => remove(s) },
  ];

  const modals = <TrainingFormModal open={modal.open} session={modal.session} defaults={modal.defaults} onClose={close} onSubmit={save} />;
  return { actionsFor, modals, openCreate: (defaults = {}) => setModal({ open: true, session: null, defaults }), openEdit: (s) => setModal({ open: true, session: s }) };
}
