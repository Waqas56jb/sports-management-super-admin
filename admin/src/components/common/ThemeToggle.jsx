import { Moon, Sun } from 'lucide-react';
import { useTheme } from '@/context/ThemeContext';
import { useI18n } from '@/i18n';
import { cn } from '@/utils/cn';

export default function ThemeToggle({ className }) {
  const { theme, toggleTheme } = useTheme();
  const { t } = useI18n();
  const dark = theme === 'dark';
  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={dark ? t('settings.appearance.switchToLight') : t('settings.appearance.switchToDark')}
      title={dark ? t('settings.appearance.switchToLight') : t('settings.appearance.switchToDark')}
      className={cn('grid size-10 place-items-center rounded-xl text-ink-2 hover:bg-surface-3 hover:text-ink', className)}
    >
      {dark ? <Sun className="size-[18px]" /> : <Moon className="size-[18px]" />}
    </button>
  );
}
