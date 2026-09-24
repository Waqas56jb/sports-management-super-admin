import { NavLink } from 'react-router-dom';
import { Menu } from 'lucide-react';
import { useI18n } from '@/i18n';
import { ALL_NAV_ITEMS, MOBILE_TABS } from '@/routes/navigation';
import { cn } from '@/utils/cn';

/**
 * One-handed bottom navigation for phones: a floating frosted dock that sits above the iOS home
 * indicator / Android gesture bar. "More" opens the full drawer.
 */
export default function MobileTabBar({ onMore, moreOpen }) {
  const { t } = useI18n();
  const tabs = MOBILE_TABS.map((k) => ALL_NAV_ITEMS.find((i) => i.key === k));
  const itemClass = 'press relative flex min-h-[58px] flex-1 flex-col items-center justify-center gap-0.5 rounded-2xl text-[10.5px] font-semibold tracking-wide';

  return (
    <nav
      aria-label={t('nav.quick')}
      className="fixed inset-x-0 bottom-0 z-30 px-3 pb-[max(0.625rem,env(safe-area-inset-bottom))] md:hidden no-print"
    >
      <ul className="glass mx-auto flex max-w-md items-stretch gap-1 rounded-[1.6rem] border border-white/60 p-1.5 shadow-(--shadow-dock) dark:border-white/10">
        {tabs.map((item) => {
          const Icon = item.icon;
          return (
            <li key={item.key} className="flex flex-1">
              <NavLink to={item.to} className={({ isActive }) => cn(itemClass, isActive ? 'text-brand-700 dark:text-brand-300' : 'text-ink-3')}>
                {({ isActive }) => (
                  <>
                    <span
                      className={cn(
                        'grid h-8 w-12 place-items-center rounded-full transition-all duration-300 ease-(--ease-spring)',
                        isActive ? 'bg-brand-500/12 scale-100 dark:bg-brand-400/15' : 'scale-95',
                      )}
                    >
                      <Icon className="size-[21px]" strokeWidth={isActive ? 2.3 : 1.9} aria-hidden="true" />
                    </span>
                    <span className="max-w-full truncate px-1">{t(`nav.short.${item.key}`)}</span>
                    {isActive && <span className="absolute -bottom-0.5 h-1 w-1 rounded-full bg-brand-500" aria-hidden="true" />}
                  </>
                )}
              </NavLink>
            </li>
          );
        })}
        <li className="flex flex-1">
          <button type="button" onClick={onMore} aria-expanded={moreOpen} className={cn(itemClass, moreOpen ? 'text-brand-700 dark:text-brand-300' : 'text-ink-3')}>
            <span className={cn('grid h-8 w-12 place-items-center rounded-full transition-all duration-300', moreOpen && 'bg-brand-500/12 dark:bg-brand-400/15')}>
              <Menu className="size-[21px]" strokeWidth={1.9} aria-hidden="true" />
            </span>
            {t('nav.more')}
          </button>
        </li>
      </ul>
    </nav>
  );
}
