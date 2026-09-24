import { useEffect, useState } from 'react';
import { Eye, Pencil, Power, Shield, Trash2, UserX } from 'lucide-react';
import SelectModal from '@/components/common/SelectModal';
import Button from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/Field';
import Modal from '@/components/ui/Modal';
import PhotoUpload from '@/components/ui/PhotoUpload';
import { useConfirm } from '@/context/ConfirmContext';
import { useAction } from '@/hooks/useAction';
import { useForm } from '@/hooks/useForm';
import { useOptions } from '@/hooks/useOptions';
import { useI18n } from '@/i18n';
import { coachService } from '@/services/coachService';
import { COACH_STATUSES, GENDERS } from '@/utils/constants';
import { email, maxLength, minLength, numberRange, phone, required } from '@/utils/validators';

const SCHEMA = {
  name: [required, minLength(3), maxLength(80)],
  email: [required, email],
  phone: [required, phone],
  license: [required, maxLength(60)],
  experience: [required, numberRange(0, 60)],
  status: [required],
};
const BLANK = { name: '', photo: null, email: '', phone: '', gender: 'male', license: '', experience: '', team_id: '', status: 'active' };

function CoachFormModal({ open, coach, teams, onClose, onSubmit }) {
  const { t } = useI18n();
  const toOptions = useOptions();
  const form = useForm({ initial: BLANK, schema: SCHEMA, onSubmit });
  const { reset } = form;

  useEffect(() => {
    if (!open) return;
    reset(coach ? Object.fromEntries(Object.keys(BLANK).map((k) => [k, coach[k] ?? BLANK[k]])) : BLANK);
  }, [open, coach, reset]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={coach ? t('coaches.form.editTitle') : t('coaches.form.createTitle')}
      description={coach ? undefined : t('coaches.form.createDescription')}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} className="w-full sm:w-auto">
            {t('common.cancel')}
          </Button>
          <Button type="submit" form="coach-form" loading={form.submitting} className="w-full sm:w-auto">
            {coach ? t('common.saveChanges') : t('coaches.form.create')}
          </Button>
        </>
      }
    >
      <form id="coach-form" ref={form.formRef} onSubmit={form.handleSubmit} noValidate className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <PhotoUpload label={t('coaches.form.photo')} name={form.values.name} value={form.values.photo} onChange={(v) => form.setValue('photo', v)} />
        </div>
        <Input label={t('coaches.form.name')} required fieldClassName="sm:col-span-2" autoComplete="off" {...form.field('name')} />
        <Input label={t('coaches.form.email')} type="email" inputMode="email" required autoComplete="off" {...form.field('email')} />
        <Input label={t('coaches.form.phone')} type="tel" inputMode="tel" required placeholder="+253 77 00 00 00" {...form.field('phone')} />
        <Input label={t('coaches.form.license')} placeholder={t('coaches.form.licensePlaceholder')} required {...form.field('license')} />
        <Input label={t('coaches.form.experience')} type="number" inputMode="numeric" min={0} max={60} required {...form.field('experience')} />
        <Select label={t('coaches.form.gender')} options={toOptions(GENDERS, 'genders')} {...form.field('gender')} />
        <Select label={t('coaches.form.status')} required options={toOptions(COACH_STATUSES, 'status')} {...form.field('status')} />
        <Select
          label={t('coaches.form.team')}
          hint={t('coaches.form.teamHint')}
          options={teams.map((tm) => ({ value: tm.id, label: tm.name }))}
          placeholder={t('coaches.unassigned')}
          fieldClassName="sm:col-span-2"
          {...form.field('team_id')}
        />
      </form>
    </Modal>
  );
}

/** Coach mutations shared by the list and profile pages. */
export function useCoachActions({ teams, onChanged, onDeleted, showView = true }) {
  const { t } = useI18n();
  const confirm = useConfirm();
  const run = useAction();
  const [modal, setModal] = useState({ type: null, coach: null });
  const close = () => setModal({ type: null, coach: null });

  const save = async (values) => {
    if (modal.coach) await run(() => coachService.update(modal.coach.id, values), { success: 'coaches.toasts.updated' });
    else await run(() => coachService.create(values), { success: 'coaches.toasts.created' });
    close();
    onChanged?.();
  };

  const setStatus = async (c, status) => {
    if (status === 'active') {
      await run(() => coachService.setStatus(c.id, 'active'), { success: 'coaches.toasts.statusChanged' }).catch(() => {});
      return onChanged?.();
    }
    const ok = await confirm({
      title: t('coaches.confirmDeactivate.title', { name: c.name }),
      message: t('coaches.confirmDeactivate.message'),
      confirmLabel: t('coaches.actions.deactivate'),
      onConfirm: () => run(() => coachService.setStatus(c.id, 'inactive'), { success: 'coaches.toasts.statusChanged' }),
    });
    if (ok) onChanged?.();
  };

  const remove = async (c) => {
    const ok = await confirm({
      title: t('coaches.confirmDelete.title', { name: c.name }),
      message: t('coaches.confirmDelete.message'),
      confirmLabel: t('coaches.actions.delete'),
      onConfirm: () => run(() => coachService.remove(c.id), { success: 'coaches.toasts.deleted' }),
    });
    if (ok) (onDeleted ?? onChanged)?.();
  };

  const assign = async (teamId) => {
    await run(() => coachService.assignTeam(modal.coach.id, teamId), { success: 'coaches.toasts.teamAssigned' });
    close();
    onChanged?.();
  };

  const actionsFor = (c) => [
    showView && { label: t('coaches.actions.view'), icon: Eye, to: `/admin/coaches/${c.id}` },
    { label: t('coaches.actions.edit'), icon: Pencil, onClick: () => setModal({ type: 'form', coach: c }) },
    { label: t('coaches.actions.assignTeam'), icon: Shield, onClick: () => setModal({ type: 'assign', coach: c }) },
    { divider: true },
    c.status !== 'active' && { label: t('coaches.actions.activate'), icon: Power, onClick: () => setStatus(c, 'active') },
    c.status === 'active' && { label: t('coaches.actions.deactivate'), icon: UserX, onClick: () => setStatus(c, 'inactive') },
    { divider: true },
    { label: t('coaches.actions.delete'), icon: Trash2, tone: 'danger', onClick: () => remove(c) },
  ];

  const modals = (
    <>
      <CoachFormModal open={modal.type === 'form'} coach={modal.coach} teams={teams} onClose={close} onSubmit={save} />
      <SelectModal
        open={modal.type === 'assign'}
        title={modal.coach ? t('coaches.assign.title', { name: modal.coach.name }) : ''}
        label={t('coaches.form.team')}
        hint={t('coaches.form.teamHint')}
        options={teams.map((tm) => ({ value: tm.id, label: tm.name }))}
        placeholder={t('coaches.unassigned')}
        value={modal.coach?.team_id}
        submitLabel={t('coaches.assign.submit')}
        onClose={close}
        onSubmit={assign}
      />
    </>
  );

  return {
    actionsFor,
    modals,
    openCreate: () => setModal({ type: 'form', coach: null }),
    openEdit: (c) => setModal({ type: 'form', coach: c }),
    openAssign: (c) => setModal({ type: 'assign', coach: c }),
  };
}
