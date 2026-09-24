import { Check, Languages } from 'lucide-react';
import Dropdown from '@/components/ui/Dropdown';
import { useToast } from '@/context/ToastContext';
import { LANGUAGES, translateIn, useI18n } from '@/i18n';
import { cn } from '@/utils/cn';

/** EN/FR menu. `variant="pill"` is used on the login screen. */
export default function LanguageSwitcher({ variant = 'icon', className }) {
  const { lang, setLang, t } = useI18n();
  const toast = useToast();
  const current = LANGUAGES.find((l) => l.code === lang);

  const change = (code) => {
    if (code === lang) return;
    setLang(code);
    const label = LANGUAGES.find((l) => l.code === code)?.label;
    toast.success(translateIn(code, 'common.languageChanged', { language: label }));
  };

  return (
    <Dropdown
      label={t('common.language')}
      className={cn(
        variant === 'pill'
          ? 'inline-flex h-10 items-center gap-2 rounded-full border border-line bg-surface/80 px-3.5 text-sm font-medium text-ink backdrop-blur hover:bg-surface'
          : 'inline-flex h-10 items-center gap-1.5 rounded-xl px-2.5 text-sm font-semibold text-ink-2 hover:bg-surface-3 hover:text-ink',
        className,
      )}
      trigger={
        <>
          <Languages className="size-[18px]" aria-hidden="true" />
          <span>{variant === 'pill' ? current?.label : current?.short}</span>
        </>
      }
      items={LANGUAGES.map((l) => ({
        label: l.label,
        onClick: () => change(l.code),
        suffix: l.code === lang ? <Check className="size-4 text-brand-600 dark:text-brand-400" /> : <span className="text-xs text-ink-3">{l.short}</span>,
      }))}
    />
  );
}
