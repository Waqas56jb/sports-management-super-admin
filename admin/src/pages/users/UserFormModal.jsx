import { useEffect, useMemo } from 'react';
import { Wand2 } from 'lucide-react';
import Button from '@/components/ui/Button';
import { Input, PasswordInput, Select } from '@/components/ui/Field';
import Modal from '@/components/ui/Modal';
import { useForm } from '@/hooks/useForm';
import { useOptions } from '@/hooks/useOptions';
import { useI18n } from '@/i18n';
import { ACCOUNT_STATUSES, ROLES } from '@/utils/constants';
import { generatePassword } from '@/utils/password';
import { email, maxLength, minLength, required, strongPassword } from '@/utils/validators';

const EMPTY = { name: '', email: '', role: 'coach', status: 'active', password: '' };

export default function UserFormModal({ open, user, onClose, onSubmit }) {
  const { t } = useI18n();
  const toOptions = useOptions();
  const editing = !!user;
  const roleLocked = editing && !!user.profile;

  const schema = useMemo(
    () => ({
      name: [required, minLength(3), maxLength(80)],
      email: [required, email],
      role: [required],
      status: [required],
      ...(editing ? {} : { password: [required, strongPassword] }),
    }),
    [editing],
  );

  const form = useForm({ initial: EMPTY, schema, onSubmit });
  const { reset } = form;

  useEffect(() => {
    if (open) reset(user ? { name: user.name, email: user.email, role: user.role, status: user.status, password: '' } : { ...EMPTY, password: generatePassword() });
  }, [open, user, reset]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? t('users.form.editTitle') : t('users.form.createTitle')}
      description={editing ? undefined : t('users.form.createDescription')}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} className="w-full sm:w-auto">
            {t('common.cancel')}
          </Button>
          <Button type="submit" form="user-form" loading={form.submitting} className="w-full sm:w-auto">
            {editing ? t('common.saveChanges') : t('users.form.create')}
          </Button>
        </>
      }
    >
      <form id="user-form" ref={form.formRef} onSubmit={form.handleSubmit} noValidate className="grid gap-4 sm:grid-cols-2">
        <Input label={t('users.form.name')} placeholder={t('users.form.namePlaceholder')} required autoComplete="off" fieldClassName="sm:col-span-2" {...form.field('name')} />
        <Input label={t('users.form.email')} type="email" inputMode="email" required autoComplete="off" fieldClassName="sm:col-span-2" {...form.field('email')} />
        <Select
          label={t('users.form.role')}
          required
          options={toOptions(ROLES, 'roles')}
          disabled={roleLocked}
          hint={roleLocked ? t('users.form.roleLocked', { role: t(`roles.${user.role}`).toLowerCase() }) : !editing ? t('users.form.roleHint') : undefined}
          {...form.field('role')}
        />
        <Select label={t('users.form.status')} required options={toOptions(ACCOUNT_STATUSES, 'status')} {...form.field('status')} />
        {!editing && (
          <PasswordInput
            label={t('users.form.password')}
            required
            autoComplete="new-password"
            hint={t('users.form.passwordHint')}
            fieldClassName="sm:col-span-2"
            {...form.field('password')}
          />
        )}
        {!editing && (
          <div className="-mt-2 sm:col-span-2">
            <Button variant="ghost" size="sm" icon={Wand2} onClick={() => form.setValue('password', generatePassword())}>
              {t('users.form.generate')}
            </Button>
          </div>
        )}
      </form>
    </Modal>
  );
}
