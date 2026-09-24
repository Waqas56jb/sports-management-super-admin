import { useEffect, useRef } from 'react';
import { Lock } from 'lucide-react';
import Button from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/Field';
import FormSection from '@/components/ui/FormSection';
import Modal from '@/components/ui/Modal';
import PhotoUpload from '@/components/ui/PhotoUpload';
import { useConfirm } from '@/context/ConfirmContext';
import { useForm } from '@/hooks/useForm';
import { useOptions } from '@/hooks/useOptions';
import { useI18n } from '@/i18n';
import { email, maxLength, phone, required } from '@/utils/validators';

const RELATIONS = ['father', 'mother', 'brother', 'sister', 'spouse', 'uncle', 'other'];
const SCHEMA = {
  email: [required, email],
  phone: [required, phone],
  address: [maxLength(120)],
  emergency_contact_name: [required, maxLength(80)],
  emergency_contact_phone: [required, phone],
  emergency_contact_relation: [required],
};
const FIELDS = ['photo', 'email', 'phone', 'address', 'emergency_contact_name', 'emergency_contact_phone', 'emergency_contact_relation'];

/** Only the fields a player may change; team, number, position and status are shown as locked. */
export default function EditProfileModal({ open, profile, onClose, onSubmit }) {
  const { t } = useI18n();
  const toOptions = useOptions();
  const confirm = useConfirm();
  const form = useForm({ initial: {}, schema: SCHEMA, onSubmit });
  const { reset, values } = form;
  const initialRef = useRef({});

  useEffect(() => {
    if (!open || !profile) return;
    const initial = Object.fromEntries(FIELDS.map((k) => [k, profile[k] ?? '']));
    initial.photo = profile.photo ?? null;
    initialRef.current = initial;
    reset(initial);
  }, [open, profile, reset]);

  const dirty = JSON.stringify(values) !== JSON.stringify(initialRef.current);
  const requestClose = async () => {
    if (form.submitting) return;
    if (!dirty || (await confirm({ title: t('profile.discard.title'), message: t('profile.discard.message'), confirmLabel: t('profile.discard.confirm') }))) onClose();
  };

  return (
    <Modal
      open={open}
      onClose={requestClose}
      size="lg"
      title={t('profile.form.title')}
      description={t('profile.form.description')}
      footer={
        <>
          <Button variant="secondary" onClick={requestClose} className="w-full sm:w-auto">
            {t('common.cancel')}
          </Button>
          <Button type="submit" form="profile-form" loading={form.submitting} disabled={!dirty} className="w-full sm:w-auto">
            {form.submitting ? t('profile.form.saving') : t('profile.form.save')}
          </Button>
        </>
      }
    >
      <form id="profile-form" ref={form.formRef} onSubmit={form.handleSubmit} noValidate className="space-y-6">
        <FormSection title={t('profile.personal')}>
          <div className="sm:col-span-2">
            <PhotoUpload label={t('profile.form.photo')} name={profile?.name} value={values.photo} onChange={(v) => form.setValue('photo', v)} />
          </div>
          <Input label={t('profile.form.email')} type="email" inputMode="email" required autoComplete="email" {...form.field('email')} />
          <Input label={t('profile.form.phone')} type="tel" inputMode="tel" required autoComplete="tel" {...form.field('phone')} />
          <Input label={t('profile.form.address')} autoComplete="street-address" fieldClassName="sm:col-span-2" {...form.field('address')} />
        </FormSection>
        <FormSection title={t('profile.emergency')}>
          <Input label={t('profile.form.emergencyName')} required {...form.field('emergency_contact_name')} />
          <Select label={t('profile.form.emergencyRelation')} required options={toOptions(RELATIONS, 'relations')} placeholder={t('common.notSet')} {...form.field('emergency_contact_relation')} />
          <Input label={t('profile.form.emergencyPhone')} type="tel" inputMode="tel" required {...form.field('emergency_contact_phone')} />
        </FormSection>
        <FormSection title={t('profile.form.locked')}>
          {[
            [t('profile.fields.playerId'), profile?.player_code],
            [t('profile.fields.team'), profile?.team?.name],
            [t('profile.fields.jersey'), profile?.jersey_number && `#${profile.jersey_number}`],
            [t('profile.fields.position'), profile && t(`positions.${profile.position}`)],
          ].map(([label, value]) => (
            <div key={label} className="flex items-center justify-between gap-3 rounded-xl border border-dashed border-line px-3.5 py-2.5 text-sm">
              <span className="text-ink-3">{label}</span>
              <span className="inline-flex items-center gap-1.5 font-medium text-ink">
                {value}
                <Lock className="size-3.5 text-ink-3" aria-hidden="true" />
              </span>
            </div>
          ))}
          <p className="text-xs text-ink-3 sm:col-span-2">{t('profile.managedByClub')}</p>
        </FormSection>
      </form>
    </Modal>
  );
}
