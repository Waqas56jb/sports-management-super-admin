import { useEffect, useState } from 'react';
import { Check, Database, Globe, KeyRound, LogOut, Monitor, Moon, Palette, RotateCcw, ShieldCheck, Sun, UserRound } from 'lucide-react';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Input, PasswordInput, Select, Switch } from '@/components/ui/Field';
import { DescriptionList } from '@/components/ui/Misc';
import PageHeader from '@/components/ui/PageHeader';
import PhotoUpload from '@/components/ui/PhotoUpload';
import { useAuth } from '@/context/AuthContext';
import { useConfirm } from '@/context/ConfirmContext';
import { useTheme } from '@/context/ThemeContext';
import { useToast } from '@/context/ToastContext';
import { useAction } from '@/hooks/useAction';
import { useForm } from '@/hooks/useForm';
import { useListParams } from '@/hooks/useListParams';
import { usePageTitle } from '@/hooks/usePageTitle';
import { LANGUAGES, translateIn, useI18n } from '@/i18n';
import { demoService } from '@/services/demoService';
import { formatDateTime } from '@/utils/format';
import { cn } from '@/utils/cn';
import { email, maxLength, minLength, notEqual, phone, required, sameAs, strongPassword } from '@/utils/validators';

const PREFS_KEY = 'shf.securityPrefs';

function readPrefs() {
  try {
    return { twoFactor: false, alerts: true, timeout: '60', ...JSON.parse(localStorage.getItem(PREFS_KEY) ?? '{}') };
  } catch {
    return { twoFactor: false, alerts: true, timeout: '60' };
  }
}

function ProfileSection() {
  const { t } = useI18n();
  const { user, updateProfile } = useAuth();
  const run = useAction();
  const form = useForm({
    initial: { name: user?.name ?? '', email: user?.email ?? '', phone: user?.phone ?? '', avatar: user?.avatar ?? null },
    schema: { name: [required, minLength(3), maxLength(80)], email: [required, email], phone: [phone] },
    onSubmit: (values) => run(() => updateProfile(values), { success: 'settings.profile.saved' }),
  });
  return (
    <Card>
      <CardHeader title={t('settings.profile.title')} subtitle={t('settings.profile.description')} icon={UserRound} />
      <CardBody>
        <form ref={form.formRef} onSubmit={form.handleSubmit} noValidate className="grid max-w-2xl gap-5 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <PhotoUpload label={t('settings.profile.photo')} name={form.values.name} value={form.values.avatar} onChange={(v) => form.setValue('avatar', v)} />
          </div>
          <Input label={t('settings.profile.name')} required autoComplete="name" {...form.field('name')} />
          <Input label={t('settings.profile.email')} type="email" required autoComplete="email" {...form.field('email')} />
          <Input label={t('settings.profile.phone')} type="tel" autoComplete="tel" {...form.field('phone')} />
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-ink">{t('settings.profile.role')}</span>
            <span className="flex min-h-11 items-center sm:min-h-10">
              <Badge tone="brand">{t('roles.super_admin')}</Badge>
            </span>
          </div>
          <div className="sm:col-span-2">
            <Button type="submit" loading={form.submitting}>
              {t('settings.profile.save')}
            </Button>
          </div>
        </form>
      </CardBody>
    </Card>
  );
}

function SecuritySection() {
  const { t, lang } = useI18n();
  const { session, changePassword } = useAuth();
  const run = useAction();
  const toast = useToast();
  const [prefs, setPrefs] = useState(readPrefs);

  const form = useForm({
    initial: { currentPassword: '', newPassword: '', confirm: '' },
    schema: {
      currentPassword: [required],
      newPassword: [required, strongPassword, notEqual('currentPassword', 'settings.security.sameAsCurrent')],
      confirm: [required, sameAs('newPassword', 'validation.passwordMatch')],
    },
    onSubmit: async (values) => {
      await run(() => changePassword(values), { success: 'settings.security.updated' });
      form.reset({ currentPassword: '', newPassword: '', confirm: '' });
    },
  });

  const updatePref = (patch) => {
    const next = { ...prefs, ...patch };
    setPrefs(next);
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
    toast.success(t('settings.security.preferencesSaved'));
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
            <div>
              <Button type="submit" loading={form.submitting}>
                {t('settings.security.update')}
              </Button>
            </div>
          </form>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title={t('settings.security.loginTitle')} subtitle={t('settings.security.loginDescription')} icon={ShieldCheck} />
        <CardBody className="max-w-2xl space-y-5">
          <Switch label={t('settings.security.twoFactor')} description={t('settings.security.twoFactorHint')} checked={prefs.twoFactor} onChange={(v) => updatePref({ twoFactor: v })} />
          <Switch label={t('settings.security.alerts')} description={t('settings.security.alertsHint')} checked={prefs.alerts} onChange={(v) => updatePref({ alerts: v })} />
          <Select
            label={t('settings.security.timeout')}
            value={prefs.timeout}
            onChange={(e) => updatePref({ timeout: e.target.value })}
            options={['15', '30', '60', '240'].map((v) => ({ value: v, label: t(`settings.security.timeoutOptions.${v}`) }))}
            fieldClassName="max-w-xs"
          />
        </CardBody>
      </Card>

      <Card>
        <CardHeader title={t('settings.security.sessionTitle')} icon={Monitor} />
        <CardBody className="space-y-5">
          <DescriptionList
            columns={2}
            items={[
              { label: t('settings.security.signedIn'), value: session?.signedInAt ? formatDateTime(session.signedInAt, lang) : '—' },
              { label: t('settings.security.expires'), value: session?.expiresAt ? formatDateTime(session.expiresAt, lang) : '—' },
              { label: t('settings.security.device'), value: [device, platform].filter(Boolean).join(' · ') || '—' },
            ]}
          />
          <Button variant="secondary" icon={LogOut} onClick={() => toast.success(t('settings.security.signedOutOthers'))}>
            {t('settings.security.signOutOthers')}
          </Button>
        </CardBody>
      </Card>
    </div>
  );
}

function ChoiceCard({ selected, onSelect, title, hint, children, name }) {
  return (
    <label className={cn('card relative flex cursor-pointer flex-col gap-3 p-4 transition-shadow hover:shadow-(--shadow-pop)', selected && 'border-brand-500 ring-2 ring-brand-500/40')}>
      <input type="radio" name={name} className="sr-only" checked={selected} onChange={onSelect} />
      {children}
      <span className="flex items-center justify-between gap-2">
        <span>
          <span className="block text-sm font-semibold text-ink">{title}</span>
          <span className="block text-xs text-ink-3">{hint}</span>
        </span>
        <span className={cn('grid size-6 place-items-center rounded-full border', selected ? 'border-brand-600 bg-brand-600 text-white dark:border-brand-500 dark:bg-brand-500 dark:text-brand-950' : 'border-line-strong')}>{selected && <Check className="size-3.5" strokeWidth={3} />}</span>
      </span>
    </label>
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

function ThemePreview({ dark }) {
  return (
    <span className={cn('flex h-24 overflow-hidden rounded-xl border', dark ? 'border-[#222d40] bg-[#0a0f19]' : 'border-[#e4e7ec] bg-[#f5f6f8]')} aria-hidden="true">
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

function AppearanceSection() {
  const { t } = useI18n();
  const { theme, setTheme } = useTheme();
  const toast = useToast();
  const choose = (v) => {
    if (v === theme) return;
    setTheme(v);
    toast.success(t('settings.appearance.changed'));
  };
  return (
    <Card>
      <CardHeader title={t('settings.appearance.title')} subtitle={t('settings.appearance.description')} icon={Palette} />
      <CardBody>
        <div role="radiogroup" aria-label={t('settings.appearance.title')} className="grid max-w-2xl gap-4 sm:grid-cols-2">
          <ChoiceCard name="theme" selected={theme === 'light'} onSelect={() => choose('light')} title={<span className="inline-flex items-center gap-1.5"><Sun className="size-4" aria-hidden="true" />{t('settings.appearance.light')}</span>} hint={t('settings.appearance.lightHint')}>
            <ThemePreview />
          </ChoiceCard>
          <ChoiceCard name="theme" selected={theme === 'dark'} onSelect={() => choose('dark')} title={<span className="inline-flex items-center gap-1.5"><Moon className="size-4" aria-hidden="true" />{t('settings.appearance.dark')}</span>} hint={t('settings.appearance.darkHint')}>
            <ThemePreview dark />
          </ChoiceCard>
        </div>
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
  { key: 'profile', icon: UserRound, Component: ProfileSection },
  { key: 'security', icon: ShieldCheck, Component: SecuritySection },
  { key: 'language', icon: Globe, Component: LanguageSection },
  { key: 'appearance', icon: Palette, Component: AppearanceSection },
  ...(demoService.available ? [{ key: 'data', icon: Database, Component: DataSection }] : []),
];

export default function SettingsPage() {
  const { t } = useI18n();
  usePageTitle(t('settings.title'));
  const { params, set } = useListParams({ tab: 'profile' });
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
          <Section />
        </div>
      </div>
    </>
  );
}
