import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell, Check, Database, Globe, KeyRound, Monitor, Moon, Palette, RotateCcw, ShieldCheck, Sun, SunMoon, UserRound } from 'lucide-react';
import Button from '@/components/ui/Button';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Input, PasswordInput, Switch } from '@/components/ui/Field';
import { DescriptionList } from '@/components/ui/Misc';
import PageHeader from '@/components/ui/PageHeader';
import { Skeleton } from '@/components/ui/Skeleton';
import { ErrorState } from '@/components/ui/States';
import { useAuth } from '@/context/AuthContext';
import { useConfirm } from '@/context/ConfirmContext';
import { useTheme } from '@/context/ThemeContext';
import { useToast } from '@/context/ToastContext';
import { useAction } from '@/hooks/useAction';
import { useForm } from '@/hooks/useForm';
import { useListParams } from '@/hooks/useListParams';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useQuery } from '@/hooks/useQuery';
import { LANGUAGES, translateIn, useI18n } from '@/i18n';
import { demoService } from '@/services/demoService';
import { notificationService } from '@/services/notificationService';
import { profileService } from '@/services/profileService';
import { formatDateTime } from '@/utils/formatters';
import { cn } from '@/utils/cn';
import { email, notEqual, phone, required, sameAs, strongPassword } from '@/utils/validators';

function AccountSection() {
  const { t } = useI18n();
  const { user, refreshUser } = useAuth();
  const run = useAction();
  const form = useForm({
    initial: { email: user?.email ?? '', phone: user?.phone ?? '' },
    schema: { email: [required, email], phone: [required, phone] },
    onSubmit: async (values) => {
      await run(() => profileService.update(values), { success: 'settings.account.saved' });
      refreshUser();
    },
  });
  return (
    <Card>
      <CardHeader title={t('settings.account.title')} subtitle={t('settings.account.description')} icon={UserRound} />
      <CardBody>
        <form ref={form.formRef} onSubmit={form.handleSubmit} noValidate className="grid max-w-2xl gap-5 sm:grid-cols-2">
          <Input label={t('settings.account.email')} type="email" required autoComplete="email" {...form.field('email')} />
          <Input label={t('settings.account.phone')} type="tel" required autoComplete="tel" {...form.field('phone')} />
          <p className="text-sm text-ink-3 sm:col-span-2">
            {t('settings.account.profileHint')}{' '}
            <Link to="/player/profile" className="font-medium text-brand-700 underline-offset-2 hover:underline dark:text-brand-400">
              {t('settings.account.openProfile')}
            </Link>
          </p>
          <div className="sm:col-span-2">
            <Button type="submit" loading={form.submitting}>
              {t('settings.account.save')}
            </Button>
          </div>
        </form>
      </CardBody>
    </Card>
  );
}

const EMPTY_PASSWORDS = { currentPassword: '', newPassword: '', confirm: '' };

function SecuritySection() {
  const { t, lang } = useI18n();
  const { session, changePassword } = useAuth();
  const run = useAction();
  const confirm = useConfirm();
  const form = useForm({
    initial: EMPTY_PASSWORDS,
    schema: {
      currentPassword: [required],
      newPassword: [required, strongPassword, notEqual('currentPassword', 'settings.security.sameAsCurrent')],
      confirm: [required, sameAs('newPassword', 'validation.passwordMatch')],
    },
    onSubmit: async (values) => {
      await run(() => changePassword(values), { success: 'settings.security.updated' });
      form.reset(EMPTY_PASSWORDS);
    },
  });
  const dirty = Object.values(form.values).some(Boolean);

  const cancel = async () => {
    const ok = await confirm({ title: t('settings.security.cancelTitle'), message: t('settings.security.cancelMessage'), confirmLabel: t('settings.security.cancelConfirm') });
    if (ok) form.reset(EMPTY_PASSWORDS);
  };

  const device = typeof navigator !== 'undefined' ? navigator.userAgent.match(/(Edg|Chrome|Firefox|Safari)\/[\d.]+/)?.[0]?.replace('Edg', 'Edge').split('/')[0] : '';
  const platform = typeof navigator !== 'undefined' ? navigator.userAgentData?.platform || navigator.platform : '';

  return (
    <div className="space-y-4 sm:space-y-6">
      <Card>
        <CardHeader title={t('settings.security.passwordTitle')} subtitle={t('settings.security.passwordDescription')} icon={KeyRound} />
        <CardBody>
          <form ref={form.formRef} onSubmit={form.handleSubmit} noValidate className="grid max-w-md gap-4">
            <PasswordInput label={t('settings.security.current')} autoComplete="current-password" required {...form.field('currentPassword')} />
            <PasswordInput label={t('settings.security.new')} autoComplete="new-password" required {...form.field('newPassword')} />
            <PasswordInput label={t('settings.security.confirm')} autoComplete="new-password" required {...form.field('confirm')} />
            <div className="flex flex-wrap gap-2">
              <Button type="submit" loading={form.submitting}>
                {t('settings.security.update')}
              </Button>
              {dirty && (
                <Button type="button" variant="secondary" onClick={cancel} disabled={form.submitting}>
                  {t('settings.security.cancel')}
                </Button>
              )}
            </div>
          </form>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title={t('settings.security.sessionTitle')} icon={Monitor} />
        <CardBody>
          <DescriptionList
            columns={2}
            items={[
              { label: t('settings.security.signedIn'), value: session?.signedInAt ? formatDateTime(session.signedInAt, lang) : '—' },
              { label: t('settings.security.expires'), value: session?.expiresAt ? formatDateTime(session.expiresAt, lang) : '—' },
              { label: t('settings.security.device'), value: [device, platform].filter(Boolean).join(' · ') || '—' },
              { label: t('settings.security.remembered'), value: session?.remember ? t('common.yes') : t('common.no') },
            ]}
          />
        </CardBody>
      </Card>
    </div>
  );
}

function ChoiceCard({ selected, onSelect, title, hint, children, name }) {
  return (
    <label className={cn('card relative flex cursor-pointer flex-col gap-3 p-4 transition-shadow hover:shadow-(--shadow-pop) has-focus-visible:ring-2 has-focus-visible:ring-brand-500', selected && 'border-brand-500 ring-2 ring-brand-500/40')}>
      <input type="radio" name={name} className="sr-only" checked={selected} onChange={onSelect} />
      {children}
      <span className="flex items-center justify-between gap-2">
        <span className="min-w-0">
          <span className="block text-sm font-semibold text-ink">{title}</span>
          <span className="block text-xs text-ink-3">{hint}</span>
        </span>
        <span className={cn('grid size-6 shrink-0 place-items-center rounded-full border', selected ? 'border-brand-600 bg-brand-600 text-white dark:border-brand-500 dark:bg-brand-500 dark:text-brand-950' : 'border-line-strong')}>
          {selected && <Check className="size-3.5" strokeWidth={3} />}
        </span>
      </span>
    </label>
  );
}

function ThemePreview({ dark }) {
  return (
    <span className={cn('flex h-20 overflow-hidden rounded-xl border sm:h-24', dark ? 'border-[#222d40] bg-[#0a0f19]' : 'border-[#e4e7ec] bg-[#f5f6f8]')} aria-hidden="true">
      <span className="w-1/4 bg-[#0b1220]" />
      <span className="flex flex-1 flex-col gap-1.5 p-2">
        <span className={cn('h-2.5 w-1/2 rounded', dark ? 'bg-[#1c2638]' : 'bg-[#e4e7ec]')} />
        <span className="grid flex-1 grid-cols-2 gap-1.5">
          <span className={cn('rounded-md', dark ? 'bg-[#111827]' : 'bg-white')} />
          <span className={cn('rounded-md', dark ? 'bg-[#111827]' : 'bg-white')}>
            <span className="m-1.5 block h-1.5 w-2/3 rounded bg-[#12b28e]" />
          </span>
        </span>
      </span>
    </span>
  );
}

function SystemPreview() {
  return (
    <span className="relative flex h-20 overflow-hidden rounded-xl sm:h-24" aria-hidden="true">
      <span className="absolute inset-0 [clip-path:polygon(0_0,100%_0,0_100%)]">
        <ThemePreview />
      </span>
      <span className="absolute inset-0 [clip-path:polygon(100%_0,100%_100%,0_100%)]">
        <ThemePreview dark />
      </span>
    </span>
  );
}

const THEMES = [
  { value: 'light', icon: Sun, Preview: () => <ThemePreview /> },
  { value: 'dark', icon: Moon, Preview: () => <ThemePreview dark /> },
  { value: 'system', icon: SunMoon, Preview: SystemPreview },
];

function AppearanceSection() {
  const { t } = useI18n();
  const { preference, setPreference } = useTheme();
  const toast = useToast();
  const choose = (v) => {
    if (v === preference) return;
    setPreference(v);
    toast.success(t('settings.appearance.changed'));
  };
  return (
    <Card>
      <CardHeader title={t('settings.appearance.title')} subtitle={t('settings.appearance.description')} icon={Palette} />
      <CardBody>
        <div role="radiogroup" aria-label={t('settings.appearance.title')} className="grid max-w-3xl gap-4 sm:grid-cols-3">
          {THEMES.map(({ value, icon: Icon, Preview }) => (
            <ChoiceCard
              key={value}
              name="theme"
              selected={preference === value}
              onSelect={() => choose(value)}
              title={
                <span className="inline-flex items-center gap-1.5">
                  <Icon className="size-4" aria-hidden="true" />
                  {t(`settings.appearance.${value}`)}
                </span>
              }
              hint={t(`settings.appearance.${value}Hint`)}
            >
              <Preview />
            </ChoiceCard>
          ))}
        </div>
      </CardBody>
    </Card>
  );
}

function LanguageSection() {
  const { t, lang, setLang } = useI18n();
  const toast = useToast();
  return (
    <Card>
      <CardHeader title={t('settings.language.title')} subtitle={t('settings.language.description')} icon={Globe} />
      <CardBody>
        <div role="radiogroup" aria-label={t('settings.language.title')} className="grid max-w-2xl gap-4 sm:grid-cols-2">
          {LANGUAGES.map((l) => (
            <ChoiceCard
              key={l.code}
              name="language"
              selected={lang === l.code}
              onSelect={() => {
                setLang(l.code);
                toast.success(translateIn(l.code, 'common.languageChanged', { language: l.label }));
              }}
              title={t(`settings.language.${l.code}`)}
              hint={t(`settings.language.${l.code}Hint`)}
            >
              <span className="grid h-16 place-items-center rounded-xl bg-surface-2 font-display text-3xl font-bold text-ink-2">{l.short}</span>
            </ChoiceCard>
          ))}
        </div>
      </CardBody>
    </Card>
  );
}

const PREFERENCE_KEYS = ['match_reminders', 'training_reminders', 'team_announcements', 'system_notifications'];

function NotificationsSection() {
  const { t } = useI18n();
  const toast = useToast();
  const prefs = useQuery(() => notificationService.getPreferences(), []);
  const [values, setValues] = useState(null);
  const [saving, setSaving] = useState(null);

  useEffect(() => {
    if (prefs.data) setValues(prefs.data);
  }, [prefs.data]);

  const toggle = async (key, next) => {
    const previous = values;
    setValues({ ...values, [key]: next });
    setSaving(key);
    try {
      setValues(await notificationService.updatePreferences({ [key]: next }));
      toast.success(t('settings.saved'));
    } catch (err) {
      setValues(previous);
      toast.error(t(err?.code ?? 'errors.generic'));
    } finally {
      setSaving(null);
    }
  };

  return (
    <Card>
      <CardHeader title={t('settings.notifications.title')} subtitle={t('settings.notifications.description')} icon={Bell} />
      <CardBody>
        {prefs.error ? (
          <ErrorState error={prefs.error} onRetry={prefs.refetch} />
        ) : !values ? (
          <div className="max-w-2xl space-y-5" role="status" aria-label={t('common.loading')}>
            {PREFERENCE_KEYS.map((k) => (
              <Skeleton key={k} className="h-10 w-full" />
            ))}
          </div>
        ) : (
          <ul className="max-w-2xl divide-y divide-line">
            {PREFERENCE_KEYS.map((k) => (
              <li key={k} className="py-4 first:pt-0 last:pb-0">
                <Switch
                  id={`pref-${k}`}
                  checked={!!values[k]}
                  disabled={saving === k}
                  onChange={(next) => toggle(k, next)}
                  label={t(`settings.notifications.${k}`)}
                  description={t(`settings.notifications.${k}Hint`)}
                />
              </li>
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}

function DataSection() {
  const { t } = useI18n();
  const confirm = useConfirm();
  const toast = useToast();
  const reset = async () => {
    const ok = await confirm({ title: t('settings.data.confirmTitle'), message: t('settings.data.confirmMessage'), confirmLabel: t('settings.data.reset') });
    if (!ok) return;
    demoService.reset();
    toast.success(t('settings.data.done'));
    setTimeout(() => window.location.reload(), 600);
  };
  return (
    <Card>
      <CardHeader title={t('settings.data.title')} subtitle={t('settings.data.description')} icon={Database} />
      <CardBody>
        <Button variant="danger" icon={RotateCcw} onClick={reset}>
          {t('settings.data.reset')}
        </Button>
      </CardBody>
    </Card>
  );
}

const SECTIONS = [
  { key: 'account', icon: UserRound, Component: AccountSection },
  { key: 'security', icon: ShieldCheck, Component: SecuritySection },
  { key: 'appearance', icon: Palette, Component: AppearanceSection },
  { key: 'language', icon: Globe, Component: LanguageSection },
  { key: 'notifications', icon: Bell, Component: NotificationsSection },
  ...(demoService.available ? [{ key: 'data', icon: Database, Component: DataSection }] : []),
];

export default function Settings() {
  const { t } = useI18n();
  usePageTitle(t('settings.title'));
  const { params, set } = useListParams({ tab: 'account' });
  const current = SECTIONS.find((s) => s.key === params.tab) ?? SECTIONS[0];
  const Section = current.Component;

  useEffect(() => {
    document.getElementById('main')?.scrollTo?.(0, 0);
  }, [current.key]);

  return (
    <>
      <PageHeader title={t('settings.title')} description={t('settings.description')} />
      <div className="grid gap-4 sm:gap-6 lg:grid-cols-[220px_1fr]">
        <nav aria-label={t('settings.title')} className="-mx-4 overflow-x-auto px-4 no-scrollbar lg:mx-0 lg:px-0">
          <ul className="flex gap-1 lg:flex-col">
            {SECTIONS.map((s) => {
              const Icon = s.icon;
              const active = s.key === current.key;
              return (
                <li key={s.key}>
                  <button
                    type="button"
                    onClick={() => set({ tab: s.key })}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'flex h-11 w-full items-center gap-2.5 whitespace-nowrap rounded-xl px-3.5 text-sm font-medium transition-colors lg:h-10',
                      active ? 'bg-surface text-ink shadow-(--shadow-card) ring-1 ring-line' : 'text-ink-3 hover:bg-surface-3 hover:text-ink',
                    )}
                  >
                    <Icon className="size-4" aria-hidden="true" />
                    {t(`settings.sections.${s.key}`)}
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>
        <div className="min-w-0">
          <Section key={current.key} />
        </div>
      </div>
    </>
  );
}
