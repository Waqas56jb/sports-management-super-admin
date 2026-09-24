import { NavLink } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import BrandLogo from '@/components/common/BrandLogo';
import Avatar from '@/components/ui/Avatar';
import { useAuth } from '@/context/AuthContext';
import { useNotifications } from '@/context/NotificationContext';
import { useI18n } from '@/i18n';
import { NAV_GROUPS } from '@/routes/navigation';
import { cn } from '@/utils/cn';

/** Dark navigation rail. Rendered fixed on desktop and inside the drawer on smaller screens. */
export default function Sidebar({ onNavigate, onLogout, className }) {
  const { t } = useI18n();
  const { user } = useAuth();
  const { unread } = useNotifications();

  return (
    <div className={cn('flex h-full flex-col bg-[#0b1220] text-slate-300', className)}>
      <div className="flex h-16 shrink-0 items-center px-5">
        <BrandLogo inverted />
      </div>

      <nav aria-label={t('nav.main')} className="flex-1 overflow-y-auto px-3 pb-4 no-scrollbar">
        {NAV_GROUPS.map((group) => (
          <div key={group.key} className="mt-5 first:mt-2">
            <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">{t(`nav.groups.${group.key}`)}</p>
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const Icon = item.icon;
                return (
                  <li key={item.key}>
                    <NavLink
                      to={item.to}
                      onClick={onNavigate}
                      className={({ isActive }) =>
                        cn(
                          'group relative flex h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium transition-colors lg:h-10',
                          isActive ? 'bg-white/[0.08] text-white' : 'text-slate-400 hover:bg-white/[0.04] hover:text-slate-100',
                        )
                      }
                    >
                      {({ isActive }) => (
                        <>
                          {isActive && <span className="absolute inset-y-2 left-0 w-[3px] rounded-r-full bg-brand-400" aria-hidden="true" />}
                          <Icon className={cn('size-[18px] shrink-0', isActive ? 'text-brand-300' : 'text-slate-500 group-hover:text-slate-300')} aria-hidden="true" />
                          <span className="flex-1 truncate">{t(`nav.${item.key}`)}</span>
                          {item.badge === 'unread' && unread > 0 && (
                            <span className="grid h-5 min-w-5 place-items-center rounded-full bg-brand-500 px-1.5 text-[11px] font-semibold text-brand-950 tabular">
                              <span className="sr-only">{t('notifications.unreadCount', { count: unread })}</span>
                              <span aria-hidden="true">{unread > 99 ? '99+' : unread}</span>
                            </span>
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
        <div className="flex items-center gap-3 rounded-xl p-2">
          <Avatar name={user?.name} src={user?.avatar} size="md" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-white">{user?.name}</p>
            <p className="truncate text-xs text-slate-400">{t('roles.admin')}</p>
          </div>
          <button
            type="button"
            onClick={onLogout}
            className="grid size-10 shrink-0 place-items-center rounded-lg text-slate-400 hover:bg-white/5 hover:text-white"
            aria-label={t('auth.logout')}
            title={t('auth.logout')}
          >
            <LogOut className="size-[18px]" />
          </button>
        </div>
      </div>
    </div>
  );
}
