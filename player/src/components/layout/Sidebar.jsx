import { NavLink } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import BrandLogo, { BrandMark } from '@/components/common/BrandLogo';
import Avatar from '@/components/ui/Avatar';
import { useAuth } from '@/context/AuthContext';
import { useNotifications } from '@/context/NotificationContext';
import { useI18n } from '@/i18n';
import { NAV_GROUPS } from '@/routes/navigation';
import { cn } from '@/utils/cn';

/** Hover/focus tooltip for the collapsed rail (the link itself carries the accessible name). */
function Tip({ children }) {
  return (
    <span
      role="presentation"
      className="pointer-events-none absolute left-full top-1/2 z-50 ml-3 -translate-y-1/2 whitespace-nowrap rounded-lg bg-slate-900 px-2.5 py-1.5 text-xs font-medium text-white opacity-0 shadow-lg ring-1 ring-white/10 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
    >
      {children}
    </span>
  );
}

/**
 * Dark navigation. `collapsed` renders an icon rail with tooltips (tablet / collapsed desktop);
 * otherwise full labels (desktop and the mobile drawer).
 */
export default function Sidebar({ onNavigate, onLogout, collapsed = false, className }) {
  const { t } = useI18n();
  const { user } = useAuth();
  const { unread } = useNotifications();

  return (
    <div className={cn('flex h-full flex-col bg-[#0b1220] text-slate-300', className)}>
      <div className={cn('flex h-16 shrink-0 items-center', collapsed ? 'justify-center' : 'px-5')}>{collapsed ? <BrandMark /> : <BrandLogo inverted />}</div>

      <nav aria-label={t('nav.main')} className={cn('flex-1 pb-4 no-scrollbar', collapsed ? 'overflow-visible px-2' : 'overflow-y-auto px-3')}>
        {NAV_GROUPS.map((group) => (
          <div key={group.key} className={cn(collapsed ? 'mt-2 border-t border-white/5 pt-2 first:mt-0 first:border-0 first:pt-0' : 'mt-5 first:mt-2')}>
            {!collapsed && <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">{t(`nav.groups.${group.key}`)}</p>}
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const Icon = item.icon;
                const label = t(`nav.${item.key}`);
                const badge = item.badge === 'unread' && unread > 0;
                return (
                  <li key={item.key}>
                    <NavLink
                      to={item.to}
                      onClick={onNavigate}
                      aria-label={collapsed ? (badge ? `${label} — ${t('notifications.unreadCount', { count: unread })}` : label) : undefined}
                      className={({ isActive }) =>
                        cn(
                          'group relative flex h-11 items-center rounded-xl text-sm font-medium transition-colors',
                          collapsed ? 'justify-center' : 'gap-3 px-3 lg:h-10',
                          isActive ? 'bg-white/[0.08] text-white' : 'text-slate-400 hover:bg-white/[0.04] hover:text-slate-100',
                        )
                      }
                    >
                      {({ isActive }) => (
                        <>
                          {isActive && <span className="absolute inset-y-2 left-0 w-[3px] rounded-r-full bg-brand-400" aria-hidden="true" />}
                          <Icon className={cn('size-[18px] shrink-0', isActive ? 'text-brand-300' : 'text-slate-500 group-hover:text-slate-300')} aria-hidden="true" />
                          {collapsed ? (
                            <>
                              {badge && <span className="absolute right-2 top-2 size-2 rounded-full bg-brand-400" aria-hidden="true" />}
                              <Tip>
                                {label}
                                {badge ? ` (${unread})` : ''}
                              </Tip>
                            </>
                          ) : (
                            <>
                              <span className="flex-1 truncate">{label}</span>
                              {badge && (
                                <span className="grid h-5 min-w-5 place-items-center rounded-full bg-brand-500 px-1.5 text-[11px] font-semibold text-brand-950 tabular">
                                  <span className="sr-only">{t('notifications.unreadCount', { count: unread })}</span>
                                  <span aria-hidden="true">{unread > 99 ? '99+' : unread}</span>
                                </span>
                              )}
                            </>
                          )}
                        </>
                      )}
                    </NavLink>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="safe-bottom shrink-0 border-t border-white/5 p-3">
        <div className={cn('flex items-center rounded-xl', collapsed ? 'flex-col gap-2' : 'gap-3 p-2')}>
          <Avatar name={user?.name} src={user?.avatar} size={collapsed ? 'sm' : 'md'} />
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-white">{user?.name}</p>
              <p className="truncate text-xs text-slate-400">{t('roles.player')}</p>
            </div>
          )}
          <button
            type="button"
            onClick={onLogout}
            className="group relative grid size-10 shrink-0 place-items-center rounded-lg text-slate-400 hover:bg-white/5 hover:text-white"
            aria-label={t('auth.logout')}
            title={collapsed ? undefined : t('auth.logout')}
          >
            <LogOut className="size-[18px]" />
            {collapsed && <Tip>{t('auth.logout')}</Tip>}
          </button>
        </div>
      </div>
    </div>
  );
}
