import { useState } from 'react';
import { ArrowLeft, Mail, MailCheck } from 'lucide-react';
import Button from '@/components/ui/Button';
import { Input } from '@/components/ui/Field';
import { useForm } from '@/hooks/useForm';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useI18n } from '@/i18n';
import AuthLayout from '@/layouts/AuthLayout';
import { authService } from '@/services/authService';
import { email, required } from '@/utils/validators';

export default function ForgotPasswordPage() {
  const { t } = useI18n();
  usePageTitle(t('auth.forgotPage.title'));
  const [sentTo, setSentTo] = useState(null);

  const form = useForm({
    initial: { email: '' },
    schema: { email: [required, email] },
    onSubmit: async (values) => {
      await authService.requestPasswordReset(values.email);
      setSentTo(values.email);
    },
  });

  return (
    <AuthLayout>
      <div className="animate-slide-up">
        {sentTo ? (
          <div role="status">
            <span className="grid size-14 place-items-center rounded-2xl bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-300">
              <MailCheck className="size-7" aria-hidden="true" />
            </span>
            <h1 className="mt-6 text-[28px] font-semibold tracking-tight text-ink">{t('auth.forgotPage.sentTitle')}</h1>
            <p className="mt-2 text-[15px] leading-relaxed text-ink-2">{t('auth.forgotPage.sentBody', { email: sentTo })}</p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button to="/player/login" size="lg" icon={ArrowLeft} className="w-full sm:w-auto">
                {t('auth.forgotPage.backToLogin')}
              </Button>
              <Button variant="secondary" size="lg" className="w-full sm:w-auto" onClick={() => setSentTo(null)}>
                {t('auth.forgotPage.resend')}
              </Button>
            </div>
          </div>
        ) : (
          <>
            <h1 className="text-[28px] font-semibold tracking-tight text-ink">{t('auth.forgotPage.title')}</h1>
            <p className="mt-1.5 text-[15px] leading-relaxed text-ink-2">{t('auth.forgotPage.subtitle')}</p>
            <form ref={form.formRef} onSubmit={form.handleSubmit} noValidate className="mt-7 space-y-5">
              <Input label={t('auth.email')} type="email" autoComplete="email" inputMode="email" placeholder={t('auth.emailPlaceholder')} icon={Mail} required {...form.field('email')} />
              <Button type="submit" size="lg" className="w-full" loading={form.submitting}>
                {form.submitting ? t('auth.forgotPage.sending') : t('auth.forgotPage.submit')}
              </Button>
            </form>
            <Button to="/player/login" variant="ghost" icon={ArrowLeft} className="mt-4 w-full">
              {t('auth.forgotPage.backToLogin')}
            </Button>
          </>
        )}
      </div>
    </AuthLayout>
  );
}
