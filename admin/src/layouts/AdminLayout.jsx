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
import { useI18n } from '@/i18n';
import RouteErrorBoundary from '@/routes/RouteErrorBoundary';

export default function AdminLayout() {
  const { t } = useI18n();
  const { logout } = useAuth();
  const confirm = useConfirm();
  const toast = useToast();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const drawerRef = useRef(null);
  const mainRef = useRef(null);

  // Close the drawer and reset scroll on navigation
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
    const ok = await confirm({
      title: t('auth.logoutConfirmTitle'),
      message: t('auth.logoutConfirmMessage'),
      confirmLabel: t('auth.logout'),
      tone: 'neutral',
    });
    if (!ok) return;
    await logout();
    toast.info(t('auth.loggedOut'));
    navigate('/admin/login', { replace: true });
  }, [confirm, logout, navigate, t, toast]);

  const openSearch = useCallback(() => setSearchOpen(true), []);

  return (
    <div className="min-h-dvh">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-surface focus:px-4 focus:py-2 focus:shadow-lg">
        {t('nav.skipToContent')}
      </a>

      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 lg:block no-print">
        <Sidebar onLogout={handleLogout} />
      </aside>

      {drawerOpen && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label={t('nav.main')}>
          <div className="absolute inset-0 animate-fade-in bg-slate-950/60" onClick={() => setDrawerOpen(false)} aria-hidden="true" />
          <div ref={drawerRef} className="relative h-full w-[min(20rem,86vw)] animate-slide-in-left shadow-2xl">
            <Sidebar onNavigate={() => setDrawerOpen(false)} onLogout={handleLogout} />
          </div>
        </div>
      )}

      <div className="lg:pl-64">
        <Topbar onMenu={() => setDrawerOpen(true)} onSearch={openSearch} onLogout={handleLogout} />
        <main id="main" ref={mainRef} tabIndex={-1} className="mx-auto w-full max-w-[1600px] px-4 pb-28 pt-5 outline-none sm:px-6 sm:pt-6 md:pb-10 lg:px-8">
          <RouteErrorBoundary key={pathname}>
            <Suspense fallback={<PageSkeleton />}>
              <Outlet />
            </Suspense>
          </RouteErrorBoundary>
        </main>
      </div>

      <MobileTabBar onMore={() => setDrawerOpen(true)} moreOpen={drawerOpen} />
      <GlobalSearch open={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  );
}
