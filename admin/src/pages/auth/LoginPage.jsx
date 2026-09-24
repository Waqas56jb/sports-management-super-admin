import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { AlertCircle, Lock, Mail, ShieldCheck } from 'lucide-react';
import Button from '@/components/ui/Button';
import { Checkbox, Input, PasswordInput } from '@/components/ui/Field';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { useForm } from '@/hooks/useForm';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useErrorMessage, useI18n } from '@/i18n';
import AuthLayout from '@/layouts/AuthLayout';
import { email, required } from '@/utils/validators';

const SCHEMA = { email: [required, email], password: [required] };

export default function LoginPage() {
  const { t } = useI18n();
  usePageTitle(t('auth.signIn'));
  const errorMessage = useErrorMessage();
  const { login } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [remember, setRemember] = useState(true);

  const form = useForm({
    initial: { email: '', password: '' },
    schema: SCHEMA,
    onSubmit: async (values) => {
      const session = await login({ ...values, remember });
      toast.success(t('auth.welcomeToast', { name: session.user.name.split(' ')[0] }));
      navigate(location.state?.from ?? '/admin/dashboard', { replace: true });
    },
  });

  const authError = form.submitError && !form.submitError.fields ? form.submitError : null;

  return (
    <AuthLayout>
      <div className="animate-slide-up">
        <h1 className="text-[28px] font-semibold tracking-tight text-ink">{t('auth.welcome')}</h1>
        <p className="mt-1.5 text-[15px] text-ink-2">{t('auth.subtitle')}</p>

        {authError && (
          <div role="alert" className="mt-6 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-3.5 text-sm text-red-800 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200">
            <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <span>{errorMessage(authError)}</span>
          </div>
        )}

        <form ref={form.formRef} onSubmit={form.handleSubmit} noValidate className="mt-7 space-y-5">
          <Input
            label={t('auth.email')}
            type="email"
            autoComplete="username"
            inputMode="email"
            placeholder={t('auth.emailPlaceholder')}
            icon={Mail}
            required
            {...form.field('email')}
          />
          <PasswordInput
            label={t('auth.password')}
            autoComplete="current-password"
            placeholder={t('auth.passwordPlaceholder')}
            icon={Lock}
            required
            {...form.field('password')}
          />
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-0">
            <Checkbox label={t('auth.remember')} checked={remember} onChange={(e) => setRemember(e.target.checked)} />
            <Link to="/admin/forgot-password" className="inline-flex min-h-10 items-center text-sm font-semibold text-brand-700 hover:underline dark:text-brand-300 sm:min-h-0">
              {t('auth.forgot')}
            </Link>
          </div>
          <Button type="submit" size="lg" className="w-full" loading={form.submitting}>
            {form.submitting ? t('auth.signingIn') : t('auth.signIn')}
          </Button>
        </form>

        <p className="mt-8 flex items-center justify-center gap-2 text-xs text-ink-3">
          <ShieldCheck className="size-4" aria-hidden="true" />
          {t('auth.secureNote')}
        </p>
      </div>
    </AuthLayout>
  );
}
