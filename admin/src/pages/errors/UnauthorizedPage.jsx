import { LogIn, ShieldX } from 'lucide-react';
import BrandLogo from '@/components/common/BrandLogo';
import Button from '@/components/ui/Button';
import { useAuth } from '@/context/AuthContext';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useI18n } from '@/i18n';

export default function UnauthorizedPage() {
  const { t } = useI18n();
  const { logout, isAuthenticated } = useAuth();
  usePageTitle(t('errorPages.unauthorized.title'));
  return (
    <div className="flex min-h-dvh flex-col bg-page">
      <div className="p-6">
        <BrandLogo />
      </div>
      <div className="flex flex-1 items-center justify-center px-4 pb-16">
        <div className="flex max-w-md flex-col items-center text-center">
          <span className="grid size-16 place-items-center rounded-2xl bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400">
            <ShieldX className="size-8" aria-hidden="true" />
          </span>
          <p className="mt-6 text-sm font-semibold uppercase tracking-wider text-red-600 dark:text-red-400">403</p>
          <h1 className="mt-1 text-2xl font-semibold text-ink">{t('errorPages.unauthorized.title')}</h1>
          <p className="mt-2 text-sm text-ink-2">{t('errorPages.unauthorized.body')}</p>
          <Button className="mt-8" icon={LogIn} to={isAuthenticated ? undefined : '/admin/login'} onClick={isAuthenticated ? () => logout() : undefined}>
            {t('errorPages.unauthorized.signInAgain')}
          </Button>
        </div>
      </div>
    </div>
  );
}
