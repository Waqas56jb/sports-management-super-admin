import { useEffect, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { LogOut, Menu, Moon, Search, Settings, Sun, UserRound } from 'lucide-react';
import LanguageSwitcher from '@/components/common/LanguageSwitcher';
import ThemeToggle from '@/components/common/ThemeToggle';
import Avatar from '@/components/ui/Avatar';
import Dropdown from '@/components/ui/Dropdown';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { useI18n } from '@/i18n';
import { ALL_NAV_ITEMS } from '@/routes/navigation';
import NotificationBell from './NotificationBell';

export default function Topbar({ onMenu, onSearch, onLogout }) {
  const { t } = useI18n();
  const { user } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { pathname } = useLocation();

  const section = useMemo(() => ALL_NAV_ITEMS.find((i) => pathname.startsWith(i.to)), [pathname]);
  const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);

  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        onSearch();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onSearch]);

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-surface/90 backdrop-blur-lg no-print">
      <div className="flex h-16 items-center gap-2 px-3 sm:gap-3 sm:px-6">
        <button type="button" onClick={onMenu} className="grid size-10 place-items-center rounded-xl text-ink-2 hover:bg-surface-3 lg:hidden" aria-label={t('nav.openMenu')}>
          <Menu className="size-5" />
        </button>

        <p className="min-w-0 flex-1 truncate text-base font-semibold text-ink lg:flex-none lg:text-lg">{section ? t(`nav.${section.key}`) : ''}</p>

        <button
          type="button"
          onClick={onSearch}
          className="ml-auto hidden h-10 w-full max-w-sm items-center gap-2.5 rounded-xl border border-line bg-surface-2 px-3.5 text-sm text-ink-3 transition-colors hover:border-line-strong md:flex"
        >
          <Search className="size-4" aria-hidden="true" />
          <span className="flex-1 truncate text-left">{t('search.placeholder')}</span>
          <kbd className="rounded-md border border-line bg-surface px-1.5 py-0.5 font-sans text-[11px] font-medium text-ink-3">{isMac ? '⌘K' : 'Ctrl K'}</kbd>
        </button>

        <div className="flex items-center gap-0.5 sm:gap-1">
          <button type="button" onClick={onSearch} className="grid size-10 place-items-center rounded-xl text-ink-2 hover:bg-surface-3 md:hidden" aria-label={t('search.title')}>
            <Search className="size-[18px]" />
          </button>
          <NotificationBell />
          <LanguageSwitcher />
          <ThemeToggle className="hidden sm:grid" />
          <Dropdown
            label={t('nav.accountMenu')}
            className="ml-1 rounded-full p-0.5 hover:ring-2 hover:ring-line"
            trigger={<Avatar name={user?.name} src={user?.avatar} size="sm" />}
            header={
              <div className="mb-1 border-b border-line px-3 pb-3 pt-2">
                <p className="truncate text-sm font-semibold text-ink">{user?.name}</p>
                <p className="truncate text-xs text-ink-3">{user?.email}</p>
              </div>
            }
            items={[
              { label: t('nav.myProfile'), icon: UserRound, to: '/admin/settings?tab=profile' },
              { label: t('nav.settings'), icon: Settings, to: '/admin/settings' },
              { label: theme === 'dark' ? t('settings.appearance.switchToLight') : t('settings.appearance.switchToDark'), icon: theme === 'dark' ? Sun : Moon, onClick: toggleTheme },
              { divider: true },
              { label: t('auth.logout'), icon: LogOut, onClick: onLogout, tone: 'danger' },
            ]}
          />
        </div>
      </div>
    </header>
  );
}
