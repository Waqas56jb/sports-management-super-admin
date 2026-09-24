import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import GlobalSearch from '@/components/layout/GlobalSearch';
import MobileTabBar from '@/components/layout/MobileTabBar';
import Sidebar from '@/components/layout/Sidebar';
import Topbar from '@/components/layout/Topbar';
import { PageSkeleton } from '@/components/ui/Skeleton';
import { useAuth } from '@/context/AuthContext';
import { useConfirm } from '@/context/ConfirmContext';
import { useToast } from '@/context/ToastContext';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { useI18n } from '@/i18n';
import RouteErrorBoundary from '@/routes/RouteErrorBoundary';
import { cn } from '@/utils/cn';

const COLLAPSE_KEY = 'shf.player.sidebarCollapsed';

function readCollapsed() {
  try {
    const v = localStorage.getItem(COLLAPSE_KEY);
    return v === null ? null : v === '1';
  } catch {
    return null;
  }
}

/**
 * Phones (< md): drawer + bottom tab bar. Tablets (md–xl): icon rail by default.
 * Desktop (≥ xl): full sidebar. The rail/full choice can be toggled and is remembered.
 */
export default function PlayerLayout() {
  const { t } = useI18n();
  const { logout } = useAuth();
  const confirm = useConfirm();
  const toast = useToast();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const isWide = useMediaQuery('(min-width: 1280px)');
  const [pref, setPref] = useState(readCollapsed);
  const collapsed = pref ?? !isWide;
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const drawerRef = useRef(null);

  const toggleCollapsed = () => {
    const next = !collapsed;
    setPref(next);
    try {
      localStorage.setItem(COLLAPSE_KEY, next ? '1' : '0');
    } catch {
      /* ignore */
    }
  };

  useEffect(() => {
    setDrawerOpen(false);
    window.scrollTo(0, 0);
  }, [pathname]);

  useEffect(() => {
    if (!drawerOpen) return undefined;
    document.body.style.overflow = 'hidden';
    const onKey = (e) => e.key === 'Escape' && setDrawerOpen(false);
    document.addEventListener('keydown', onKey);
    requestAnimationFrame(() => drawerRef.current?.querySelector('a[aria-current="page"], a')?.focus());
    return () => {
      document.body.style.overflow = '';
      document.removeEventListener('keydown', onKey);
    };
  }, [drawerOpen]);

  const handleLogout = useCallback(async () => {
    setDrawerOpen(false);
    const ok = await confirm({ title: t('auth.logoutConfirmTitle'), message: t('auth.logoutConfirmMessage'), confirmLabel: t('auth.logout'), tone: 'neutral' });
    if (!ok) return;
    await logout();
    toast.info(t('auth.loggedOut'));
    navigate('/player/login', { replace: true });
  }, [confirm, logout, navigate, t, toast]);

  const openSearch = useCallback(() => setSearchOpen(true), []);

  return (
    <div className="min-h-dvh">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-surface focus:px-4 focus:py-2 focus:shadow-lg">
        {t('nav.skipToContent')}
      </a>

      <aside className={cn('fixed inset-y-0 left-0 z-40 hidden transition-[width] duration-200 md:block no-print', collapsed ? 'w-20' : 'w-64')}>
        <Sidebar onLogout={handleLogout} collapsed={collapsed} />
      </aside>

      {drawerOpen && (
        <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true" aria-label={t('nav.main')}>
          <div className="absolute inset-0 animate-fade-in bg-slate-950/50 backdrop-blur-sm" onClick={() => setDrawerOpen(false)} aria-hidden="true" />
          <div ref={drawerRef} className="relative h-full w-[min(20rem,86vw)] animate-slide-in-left overflow-hidden rounded-r-[1.75rem] bg-[#0b1220] shadow-2xl safe-top">
            <Sidebar onNavigate={() => setDrawerOpen(false)} onLogout={handleLogout} />
          </div>
        </div>
      )}

      <div className={cn('transition-[padding] duration-200', collapsed ? 'md:pl-20' : 'md:pl-64')}>
        <Topbar onMenu={() => setDrawerOpen(true)} onSearch={openSearch} onLogout={handleLogout} collapsed={collapsed} onToggleSidebar={toggleCollapsed} />
        <main id="main" tabIndex={-1} className="mx-auto w-full max-w-[1600px] px-4 pb-[calc(7.5rem+env(safe-area-inset-bottom))] pt-5 outline-none sm:px-6 sm:pt-7 md:pb-12 lg:px-8">
          <RouteErrorBoundary key={pathname}>
            <Suspense fallback={<PageSkeleton />}>
              <div key={pathname} className="stagger">
                <Outlet />
              </div>
            </Suspense>
          </RouteErrorBoundary>
        </main>
      </div>

      <MobileTabBar onMore={() => setDrawerOpen(true)} moreOpen={drawerOpen} />
      <GlobalSearch open={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  );
}
