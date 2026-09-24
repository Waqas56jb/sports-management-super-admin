import { useEffect, useMemo } from 'react';
import Button from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/Field';
import FormSection from '@/components/ui/FormSection';
import Modal from '@/components/ui/Modal';
import PhotoUpload from '@/components/ui/PhotoUpload';
import { useForm } from '@/hooks/useForm';
import { useOptions } from '@/hooks/useOptions';
import { useI18n } from '@/i18n';
import { ACCOUNT_STATUSES, GENDERS, POSITIONS } from '@/utils/constants';
import { todayISO } from '@/utils/format';
import { email, maxLength, minLength, numberRange, pastDate, phone, required } from '@/utils/validators';

const RELATIONS = ['father', 'mother', 'brother', 'sister', 'spouse', 'uncle', 'other'];

const SCHEMA = {
  name: [required, minLength(3), maxLength(80)],
  date_of_birth: [required, pastDate],
  gender: [required],
  email: [required, email],
  phone: [required, phone],
  position: [required],
  jersey_number: [numberRange(1, 99)],
  status: [required],
  registration_date: [required],
  emergency_contact_phone: [phone],
};

const blank = () => ({
  name: '', photo: null, date_of_birth: '', gender: 'male', email: '', phone: '', address: '', position: '', jersey_number: '',
  team_id: '', status: 'active', registration_date: todayISO(), emergency_contact_name: '', emergency_contact_phone: '', emergency_contact_relation: '',
});

export default function PlayerFormModal({ open, player, teams, defaultTeamId, onClose, onSubmit }) {
  const { t } = useI18n();
  const toOptions = useOptions();
  const editing = !!player;
  const form = useForm({ initial: blank(), schema: SCHEMA, onSubmit });
  const { reset } = form;

  useEffect(() => {
    if (!open) return;
    if (player) {
      const next = blank();
      Object.keys(next).forEach((k) => {
        next[k] = player[k] ?? next[k];
      });
      next.jersey_number = player.jersey_number ?? '';
      next.team_id = player.team_id ?? '';
      reset(next);
    } else reset({ ...blank(), team_id: defaultTeamId ?? '' });
  }, [open, player, defaultTeamId, reset]);

  const teamOptions = useMemo(() => teams.map((tm) => ({ value: tm.id, label: tm.name })), [teams]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={editing ? t('players.form.editTitle') : t('players.form.createTitle')}
      description={editing ? undefined : t('players.form.createDescription')}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} className="w-full sm:w-auto">
            {t('common.cancel')}
          </Button>
          <Button type="submit" form="player-form" loading={form.submitting} className="w-full sm:w-auto">
            {editing ? t('common.saveChanges') : t('players.form.create')}
          </Button>
        </>
      }
    >
      <form id="player-form" ref={form.formRef} onSubmit={form.handleSubmit} noValidate className="space-y-6">
        <FormSection title={t('players.form.sections.identity')}>
          <div className="sm:col-span-2">
            <PhotoUpload label={t('players.form.photo')} name={form.values.name} value={form.values.photo} onChange={(v) => form.setValue('photo', v)} />
          </div>
          <Input label={t('players.form.name')} required autoComplete="off" fieldClassName="sm:col-span-2" {...form.field('name')} />
          <Input label={t('players.form.dob')} type="date" required max={todayISO()} {...form.field('date_of_birth')} />
          <Select label={t('players.form.gender')} required options={toOptions(GENDERS, 'genders')} {...form.field('gender')} />
        </FormSection>

        <FormSection title={t('players.form.sections.football')}>
          <Select label={t('players.form.team')} options={teamOptions} placeholder={t('players.unassigned')} {...form.field('team_id')} />
          <Select label={t('players.form.position')} required options={toOptions(POSITIONS, 'positions')} placeholder={t('common.notSet')} {...form.field('position')} />
          <Input label={t('players.form.jersey')} type="number" inputMode="numeric" min={1} max={99} {...form.field('jersey_number')} />
          <Select label={t('players.form.status')} required options={toOptions(ACCOUNT_STATUSES, 'status')} {...form.field('status')} />
          <Input label={t('players.form.registrationDate')} type="date" required {...form.field('registration_date')} />
        </FormSection>

        <FormSection title={t('players.form.sections.contact')}>
          <Input label={t('players.form.email')} type="email" inputMode="email" required autoComplete="off" {...form.field('email')} />
          <Input label={t('players.form.phone')} type="tel" inputMode="tel" required placeholder="+253 77 00 00 00" {...form.field('phone')} />
          <Input label={t('players.form.address')} placeholder={t('players.form.addressPlaceholder')} fieldClassName="sm:col-span-2" {...form.field('address')} />
        </FormSection>

        <FormSection title={t('players.form.sections.emergency')}>
          <Input label={t('players.form.emergencyName')} {...form.field('emergency_contact_name')} />
          <Select label={t('players.form.emergencyRelation')} options={toOptions(RELATIONS, 'relations')} placeholder={t('common.notSet')} {...form.field('emergency_contact_relation')} />
          <Input label={t('players.form.emergencyPhone')} type="tel" inputMode="tel" placeholder="+253 77 00 00 00" {...form.field('emergency_contact_phone')} />
        </FormSection>
      </form>
    </Modal>
  );
}
