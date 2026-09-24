import { useEffect, useState } from 'react';
import { KeyRound, Mail, Wand2 } from 'lucide-react';
import Button from '@/components/ui/Button';
import { PasswordInput } from '@/components/ui/Field';
import Modal from '@/components/ui/Modal';
import { useI18n } from '@/i18n';
import { generatePassword } from '@/utils/password';
import { strongPassword, required } from '@/utils/validators';
import { cn } from '@/utils/cn';

function Option({ value, mode, setMode, icon: Icon, title, hint }) {
  return (
    <label className={cn('flex cursor-pointer gap-3 rounded-xl border p-4 transition-colors', mode === value ? 'border-brand-500 bg-brand-50/60 ring-1 ring-brand-500 dark:bg-brand-500/5' : 'border-line hover:bg-surface-2')}>
      <input type="radio" name="reset-mode" value={value} checked={mode === value} onChange={() => setMode(value)} className="mt-1 size-4 accent-brand-600" />
      <span className="min-w-0">
        <span className="flex items-center gap-2 text-sm font-medium text-ink">
          <Icon className="size-4 text-ink-3" aria-hidden="true" />
          {title}
        </span>
        <span className="mt-0.5 block text-xs text-ink-3">{hint}</span>
      </span>
    </label>
  );
}

export default function ResetPasswordModal({ open, user, onClose, onSubmit }) {
  const { t } = useI18n();
  const [mode, setMode] = useState('link');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setMode('link');
      setPassword(generatePassword());
      setError(null);
    }
  }, [open]);

  const submit = async (e) => {
    e.preventDefault();
    if (mode === 'manual') {
      const err = required(password) ?? strongPassword(password);
      if (err) return setError(err);
    }
    setBusy(true);
    try {
      await onSubmit({ mode, password: mode === 'manual' ? password : undefined });
    } finally {
      setBusy(false);
    }
  };


  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('users.reset.title')}
      description={user ? t('users.reset.description', { name: user.name }) : undefined}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} className="w-full sm:w-auto">
            {t('common.cancel')}
          </Button>
          <Button type="submit" form="reset-form" loading={busy} className="w-full sm:w-auto">
            {t('users.reset.submit')}
          </Button>
        </>
      }
    >
      <form id="reset-form" onSubmit={submit} className="space-y-3" noValidate>
        <fieldset className="space-y-3">
          <legend className="sr-only">{t('users.reset.title')}</legend>
          <Option mode={mode} setMode={setMode} value="link" icon={Mail} title={t('users.reset.link')} hint={t('users.reset.linkHint', { email: user?.email })} />
          <Option mode={mode} setMode={setMode} value="manual" icon={KeyRound} title={t('users.reset.manual')} hint={t('users.reset.manualHint')} />
        </fieldset>
        {mode === 'manual' && (
          <div className="space-y-2 pt-1">
            <PasswordInput
              id="reset-password"
              label={t('users.form.password')}
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setError(null);
              }}
              error={error}
              autoComplete="new-password"
            />
            <Button variant="ghost" size="sm" icon={Wand2} onClick={() => setPassword(generatePassword())}>
              {t('users.form.generate')}
            </Button>
          </div>
        )}
      </form>
    </Modal>
  );
}
