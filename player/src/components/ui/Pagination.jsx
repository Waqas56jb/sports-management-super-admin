import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useI18n } from '@/i18n';
import { formatNumber } from '@/utils/formatters';
import { cn } from '@/utils/cn';

function pageList(current, pages) {
  if (pages <= 7) return Array.from({ length: pages }, (_, i) => i + 1);
  const list = [1];
  const start = Math.max(2, current - 1);
  const end = Math.min(pages - 1, current + 1);
  if (start > 2) list.push('…');
  for (let i = start; i <= end; i += 1) list.push(i);
  if (end < pages - 1) list.push('…');
  list.push(pages);
  return list;
}

export default function Pagination({ page, pages, total, pageSize, onChange, className }) {
  const { t, lang } = useI18n();
  if (!total) return null;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  const btn = 'grid size-10 place-items-center rounded-lg text-sm transition-colors disabled:opacity-40 disabled:pointer-events-none sm:size-9';
  return (
    <nav aria-label={t('common.pagination')} className={cn('flex flex-col items-center justify-between gap-3 sm:flex-row', className)}>
      <p className="text-sm text-ink-3 tabular">
        {t('common.showing', { from: formatNumber(from, lang), to: formatNumber(to, lang), total: formatNumber(total, lang) })}
      </p>
      {pages > 1 && (
        <div className="flex items-center gap-1">
          <button type="button" className={cn(btn, 'text-ink-2 hover:bg-surface-3')} onClick={() => onChange(page - 1)} disabled={page <= 1} aria-label={t('common.previous')}>
            <ChevronLeft className="size-4" />
          </button>
          <span className="px-2 text-sm text-ink-2 sm:hidden tabular">
            {t('common.pageOf', { page, pages })}
          </span>
          <div className="hidden items-center gap-1 sm:flex">
            {pageList(page, pages).map((p, i) =>
              p === '…' ? (
                <span key={`e${i}`} className="px-1 text-ink-3">
                  …
                </span>
              ) : (
                <button
                  key={p}
                  type="button"
                  onClick={() => onChange(p)}
                  aria-current={p === page ? 'page' : undefined}
                  className={cn(btn, 'tabular', p === page ? 'bg-brand-600 font-semibold text-white dark:bg-brand-500 dark:text-brand-950' : 'text-ink-2 hover:bg-surface-3')}
                >
                  {p}
                </button>
              ),
            )}
          </div>
          <button type="button" className={cn(btn, 'text-ink-2 hover:bg-surface-3')} onClick={() => onChange(page + 1)} disabled={page >= pages} aria-label={t('common.next')}>
            <ChevronRight className="size-4" />
          </button>
        </div>
      )}
    </nav>
  );
}
