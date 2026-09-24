import { ArrowLeft, LayoutDashboard } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import BrandLogo from '@/components/common/BrandLogo';
import Button from '@/components/ui/Button';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useI18n } from '@/i18n';

function Content() {
  const { t } = useI18n();
  const navigate = useNavigate();
  return (
    <div className="flex flex-col items-center text-center">
      <p className="font-display text-[120px] font-bold leading-none tracking-tight text-transparent [-webkit-text-stroke:2px_var(--line-strong)] sm:text-[160px]" aria-hidden="true">
        404
      </p>
      <h1 className="mt-2 text-2xl font-semibold text-ink">{t('errorPages.notFound.title')}</h1>
      <p className="mt-2 max-w-md text-sm text-ink-2">{t('errorPages.notFound.body')}</p>
      <div className="mt-8 flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
        <Button variant="secondary" icon={ArrowLeft} onClick={() => navigate(-1)}>
          {t('errorPages.goBack')}
        </Button>
        <Button to="/admin/dashboard" icon={LayoutDashboard}>
          {t('errorPages.toDashboard')}
        </Button>
      </div>
    </div>
  );
}

/** Rendered inside the admin layout for unknown /admin/* paths, or standalone otherwise. */
export default function NotFoundPage({ inLayout = false }) {
  const { t } = useI18n();
  usePageTitle(t('errorPages.notFound.title'));
  if (inLayout) {
    return (
      <div className="py-12 sm:py-20">
        <Content />
      </div>
    );
  }
  return (
    <div className="flex min-h-dvh flex-col bg-page">
      <div className="p-6">
        <BrandLogo />
      </div>
      <div className="flex flex-1 items-center justify-center px-4 pb-16">
        <Content />
      </div>
    </div>
  );
}
