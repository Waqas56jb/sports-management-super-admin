import { useState } from 'react';
import { BarChart3, Table2 } from 'lucide-react';
import { Card, CardHeader } from '@/components/ui/Card';
import { ChartSkeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/States';
import { useI18n } from '@/i18n';
import { cn } from '@/utils/cn';

/**
 * Card wrapper for every chart: title, legend, and a chart/table toggle so the data is
 * always available as text (screen readers, colour-vision deficiency, exact values).
 * table: { columns: [{ key, label, align }], rows: [{ ... }] }
 */
export default function ChartCard({ title, subtitle, legend, table, loading, empty, height = 260, action, className, children }) {
  const { t } = useI18n();
  const [view, setView] = useState('chart');
  const toggle = table && (
    <button
      type="button"
      onClick={() => setView((v) => (v === 'chart' ? 'table' : 'chart'))}
      className="grid size-9 place-items-center rounded-lg text-ink-3 hover:bg-surface-3 hover:text-ink"
      aria-label={view === 'chart' ? t('charts.showTable') : t('charts.showChart')}
      title={view === 'chart' ? t('charts.showTable') : t('charts.showChart')}
      aria-pressed={view === 'table'}
    >
      {view === 'chart' ? <Table2 className="size-4" /> : <BarChart3 className="size-4" />}
    </button>
  );
  return (
    <Card className={cn('flex flex-col', className)}>
      <CardHeader
        title={title}
        subtitle={subtitle}
        action={
          action || toggle ? (
            <>
              {action}
              {toggle}
            </>
          ) : null
        }
      />
      <div className="flex flex-1 flex-col px-2 pb-4 pt-3 sm:px-3 sm:pb-5">
        {loading ? (
          <ChartSkeleton height={height} />
        ) : empty ? (
          <EmptyState compact icon={BarChart3} title={t('charts.noData')} />
        ) : view === 'table' && table ? (
          <div className="overflow-x-auto px-2 scrollbar-thin" style={{ maxHeight: height + 40 }}>
            <table className="w-full text-sm">
              <caption className="sr-only">{title}</caption>
              <thead>
                <tr className="border-b border-line text-xs uppercase tracking-wide text-ink-3">
                  {table.columns.map((c) => (
                    <th key={c.key} scope="col" className={cn('px-2 py-2 font-semibold', c.align === 'right' ? 'text-right' : 'text-left')}>
                      {c.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {table.rows.map((r, i) => (
                  <tr key={i} className="border-b border-line last:border-0">
                    {table.columns.map((c) => (
                      <td key={c.key} className={cn('px-2 py-2 tabular text-ink-2', c.align === 'right' && 'text-right', c.key === table.columns[0].key && 'font-medium text-ink')}>
                        {r[c.key] ?? '—'}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <>
            {legend && <div className="mb-3 px-2">{legend}</div>}
            <div style={{ height }} className="w-full min-w-0">
              {children}
            </div>
          </>
        )}
      </div>
    </Card>
  );
}
