import { ArrowDown, ArrowUp, ChevronsUpDown } from 'lucide-react';
import { useI18n } from '@/i18n';
import { cn } from '@/utils/cn';
import { TableSkeleton } from './Skeleton';

/**
 * Responsive data table.
 *  - ≥ md: a real <table> with sortable headers (horizontally scrollable when needed)
 *  - < md: every row becomes a touch-friendly card rendered by `mobileCard(row)`
 *
 * columns: [{ key, header, render(row), sortable, align, className, headerClassName }]
 */
export default function DataTable({
  columns,
  rows,
  loading,
  fetching,
  empty,
  onRowClick,
  mobileCard,
  sort,
  dir,
  onSort,
  rowKey = (r) => r.id,
  caption,
  className,
}) {
  const { t } = useI18n();
  if (loading) return <TableSkeleton columns={Math.min(columns.length, 6)} />;
  if (!rows?.length) return empty ?? null;

  const handleSort = (col) => {
    if (!col.sortable || !onSort) return;
    const nextDir = sort === col.key && dir === 'asc' ? 'desc' : 'asc';
    onSort(col.key, nextDir);
  };

  const rowProps = (row) =>
    onRowClick
      ? {
          onClick: () => onRowClick(row),
          onKeyDown: (e) => {
            if (e.target !== e.currentTarget) return;
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onRowClick(row);
            }
          },
          tabIndex: 0,
          className: 'cursor-pointer',
        }
      : {};

  return (
    <div className={cn('relative transition-opacity', fetching && 'opacity-60', className)} aria-busy={fetching || undefined}>
      <div className="relative hidden overflow-x-auto scrollbar-thin md:block">
        <table className="w-full min-w-[640px] border-collapse text-sm">
          {caption && <caption className="sr-only">{caption}</caption>}
          <thead>
            <tr className="border-b border-line bg-surface-2/60">
              {columns.map((col) => {
                const active = sort === col.key;
                const SortIcon = active ? (dir === 'asc' ? ArrowUp : ArrowDown) : ChevronsUpDown;
                return (
                  <th
                    key={col.key}
                    scope="col"
                    aria-sort={active ? (dir === 'asc' ? 'ascending' : 'descending') : undefined}
                    className={cn(
                      'h-11 whitespace-nowrap px-4 text-left text-xs font-semibold uppercase tracking-wide text-ink-3 first:pl-5 last:pr-5',
                      col.align === 'right' && 'text-right',
                      col.align === 'center' && 'text-center',
                      col.headerClassName,
                    )}
                  >
                    {col.sortable && onSort ? (
                      <button
                        type="button"
                        onClick={() => handleSort(col)}
                        className={cn('inline-flex items-center gap-1 rounded uppercase hover:text-ink', active && 'text-ink')}
                        aria-label={t('common.sortBy', { column: typeof col.header === 'string' ? col.header : col.key })}
                      >
                        {col.header}
                        <SortIcon className="size-3.5" aria-hidden="true" />
                      </button>
                    ) : (
                      col.header
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const props = rowProps(row);
              return (
                <tr
                  key={rowKey(row)}
                  {...props}
                  className={cn('border-b border-line transition-colors last:border-0 hover:bg-surface-2 focus-visible:bg-surface-2 focus-visible:outline-none', props.className)}
                >
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={cn(
                        'px-4 py-3 align-middle text-ink-2 first:pl-5 last:pr-5',
                        col.align === 'right' && 'text-right',
                        col.align === 'center' && 'text-center',
                        col.className,
                      )}
                    >
                      {col.render ? col.render(row) : row[col.key]}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <ul className="divide-y divide-line md:hidden">
        {rows.map((row) => {
          const props = rowProps(row);
          return (
            <li key={rowKey(row)} {...props} className={cn('px-4 py-3.5 active:bg-surface-2', props.className)}>
              {mobileCard ? mobileCard(row) : columns[0].render?.(row)}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
