import { ArrowLeft, FileQuestion } from 'lucide-react';
import Button from '@/components/ui/Button';
import { PageSkeleton } from '@/components/ui/Skeleton';
import { EmptyState, ErrorState } from '@/components/ui/States';
import { useI18n } from '@/i18n';

/** Loading / not-found / error handling shared by every detail page. */
export default function DetailGuard({ query, entity, backTo, backLabel, children }) {
  const { t } = useI18n();
  if (query.loading) return <PageSkeleton variant="detail" />;
  if (query.error) {
    if (query.error.status === 404) {
      return (
        <div className="card">
          <EmptyState
            icon={FileQuestion}
            title={t('errorPages.recordNotFound.title', { entity })}
            description={t('errorPages.recordNotFound.body')}
            action={
              <Button to={backTo} icon={ArrowLeft} variant="secondary">
                {backLabel}
              </Button>
            }
          />
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
