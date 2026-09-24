import { NavLink } from 'react-router-dom';
import { Menu } from 'lucide-react';
import { useI18n } from '@/i18n';
import { ALL_NAV_ITEMS, MOBILE_TABS } from '@/routes/navigation';
import { cn } from '@/utils/cn';

/** One-handed bottom navigation for phones. "More" opens the full drawer. */
export default function MobileTabBar({ onMore, moreOpen }) {
  const { t } = useI18n();
  const tabs = MOBILE_TABS.map((k) => ALL_NAV_ITEMS.find((i) => i.key === k));
  const itemClass = 'flex min-h-14 flex-1 flex-col items-center justify-center gap-1 text-[11px] font-medium';
  return (
    <nav
      aria-label={t('nav.quick')}
      className="safe-bottom fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 backdrop-blur-lg md:hidden no-print"
    >
      <ul className="flex">
        {tabs.map((item) => {
          const Icon = item.icon;
          return (
            <li key={item.key} className="flex flex-1">
              <NavLink
                to={item.to}
                className={({ isActive }) => cn(itemClass, isActive ? 'text-brand-700 dark:text-brand-300' : 'text-ink-3')}
              >
                {({ isActive }) => (
                  <>
                    <span className={cn('grid h-7 w-12 place-items-center rounded-full transition-colors', isActive && 'bg-brand-50 dark:bg-brand-500/15')}>
                      <Icon className="size-5" aria-hidden="true" />
                    </span>
                    <span className="max-w-full truncate px-1">{t(`nav.short.${item.key}`)}</span>
                  </>
                )}
              </NavLink>
            </li>
          );
        })}
        <li className="flex flex-1">
          <button type="button" onClick={onMore} aria-expanded={moreOpen} className={cn(itemClass, moreOpen ? 'text-brand-700 dark:text-brand-300' : 'text-ink-3')}>
            <span className="grid h-7 w-12 place-items-center rounded-full">
              <Menu className="size-5" aria-hidden="true" />
            </span>
            {t('nav.more')}
          </button>
        </li>
      </ul>
    </nav>
  );
}
