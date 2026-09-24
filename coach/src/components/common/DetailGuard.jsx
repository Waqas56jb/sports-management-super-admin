import { ArrowLeft, FileQuestion, ShieldX } from 'lucide-react';
import Button from '@/components/ui/Button';
import { PageSkeleton } from '@/components/ui/Skeleton';
import { EmptyState, ErrorState } from '@/components/ui/States';
import { useI18n } from '@/i18n';

/** Loading / not-found / not-your-team / error handling shared by every detail page. */
export default function DetailGuard({ query, entity, backTo, backLabel, children }) {
  const { t } = useI18n();
  if (query.loading) return <PageSkeleton variant="detail" />;
  if (query.error) {
    const back = (
      <Button to={backTo} icon={ArrowLeft} variant="secondary">
        {backLabel}
      </Button>
    );
    if (query.error.status === 404) {
      return (
        <div className="card">
          <EmptyState icon={FileQuestion} title={t('errorPages.recordNotFound.title', { entity })} description={t('errorPages.recordNotFound.body')} action={back} />
        </div>
      );
    }
    if (query.error.status === 403) {
      return (
        <div className="card">
          <EmptyState icon={ShieldX} title={t('errorPages.forbidden.title')} description={t('errors.forbidden')} action={back} />
        </div>
      );
    }
    return (
      <div className="card">
        <ErrorState error={query.error} onRetry={query.refetch} />
      </div>
    );
  }
  return children(query.data);
}
