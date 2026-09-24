import { useMemo } from 'react';
import { FileDown, FileSpreadsheet, FileText } from 'lucide-react';
import Button from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import FilterBar from '@/components/ui/FilterBar';
import PageHeader from '@/components/ui/PageHeader';
import { TableSkeleton } from '@/components/ui/Skeleton';
import { EmptyState, ErrorState } from '@/components/ui/States';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { useListParams } from '@/hooks/useListParams';
import { useCompetitionOptions, useSeasonOptions, useTeamOptions } from '@/hooks/useOptions';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useQuery } from '@/hooks/useQuery';
import { useI18n } from '@/i18n';
import { REPORT_TYPES, reportService } from '@/services/reportService';
import { APP_NAME } from '@/utils/constants';
import { exportCsv, exportPdf } from '@/utils/export';
import { formatDate, formatDateTime, todayISO } from '@/utils/format';
import { cn } from '@/utils/cn';
import { reportDefinitions } from './reportDefinitions';

const PREVIEW_LIMIT = 25;

export default function ReportsPage() {
  const { t, lang } = useI18n();
  usePageTitle(t('reports.title'));
  const { user } = useAuth();
  const toast = useToast();
  const { teamOptions } = useTeamOptions();
  const { competitionOptions } = useCompetitionOptions();
  const seasons = useSeasonOptions();
  const { params, set, reset } = useListParams({ type: 'players' });
  const type = REPORT_TYPES.includes(params.type) ? params.type : 'players';
  const defs = useMemo(() => reportDefinitions(t, lang), [t, lang]);
  const def = defs[type];

  const filterDefs = {
    team: { key: 'team', label: t('common.team'), options: teamOptions, placeholder: t('common.allTeams') },
    competition: { key: 'competition', label: t('common.competition'), options: competitionOptions, placeholder: t('statistics.allCompetitions'), className: 'sm:min-w-44' },
    season: { key: 'season', label: t('common.season'), options: seasons, placeholder: t('statistics.allSeasons') },
    from: { key: 'from', label: t('common.from'), type: 'date', className: 'sm:w-40' },
    to: { key: 'to', label: t('common.to'), type: 'date', className: 'sm:w-40' },
  };
  const active = def.filters.map((k) => filterDefs[k]);
  const filterValues = Object.fromEntries(def.filters.map((k) => [k, params[k]]));

  const query = useQuery(
    () => reportService.generate(type, { teamId: filterValues.team, competitionId: filterValues.competition, season: filterValues.season, from: filterValues.from, to: filterValues.to }),
    [type, filterValues.team, filterValues.competition, filterValues.season, filterValues.from, filterValues.to],
  );
  const rows = query.data?.rows ?? [];
  const title = t(`reports.types.${type}.title`);

  const subtitle = () => {
    const parts = def.filters
      .filter((k) => params[k])
      .map((k) => {
        const f = filterDefs[k];
        if (f.type === 'date') return `${f.label}: ${formatDate(params[k], lang)}`;
        return `${f.label}: ${f.options.find((o) => o.value === params[k])?.label ?? params[k]}`;
      });
    return [t('reports.rows', { count: rows.length }), ...parts].join(' · ');
  };

  const onCsv = () => {
    exportCsv(`${type}-report-${todayISO()}`, def.columns, rows);
    toast.success(t('reports.toasts.csv'));
  };

  const onPdf = () => {
    const ok = exportPdf({
      title,
      subtitle: subtitle(),
      columns: def.columns,
      rows,
      brand: `${APP_NAME} · ${t('app.tagline')}`,
      footer: t('reports.generatedBy', { name: user?.name, date: formatDateTime(new Date().toISOString(), lang) }),
      lang,
    });
    if (ok) toast.info(t('reports.toasts.pdf'));
    else toast.error(t('reports.toasts.popupBlocked'));
  };

  return (
    <>
      <PageHeader title={t('reports.title')} description={t('reports.description')} />

      <h2 className="mb-3 text-sm font-semibold text-ink-2">{t('reports.choose')}</h2>
      <div role="radiogroup" aria-label={t('reports.choose')} className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {REPORT_TYPES.map((key) => {
          const Icon = defs[key].icon;
          const selected = key === type;
          return (
            <button
              key={key}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => set({ type: key })}
              className={cn(
                'card flex flex-col items-start gap-3 p-4 text-left transition-shadow hover:shadow-(--shadow-pop)',
                selected && 'border-brand-500 ring-2 ring-brand-500/40',
              )}
            >
              <span className={cn('grid size-10 place-items-center rounded-xl', selected ? 'bg-brand-600 text-white dark:bg-brand-500 dark:text-brand-950' : 'bg-surface-3 text-ink-2')}>
                <Icon className="size-5" aria-hidden="true" />
              </span>
              <span>
                <span className="block text-sm font-semibold text-ink">{t(`reports.types.${key}.title`)}</span>
                <span className="mt-1 line-clamp-3 block text-xs text-ink-3">{t(`reports.types.${key}.description`)}</span>
              </span>
            </button>
          );
        })}
      </div>

      <Card className="mt-6">
        <CardHeader
          title={title}
          subtitle={query.data ? `${subtitle()} · ${t('reports.generatedAt', { date: formatDateTime(query.data.generated_at, lang) })}` : t('common.loading')}
          action={
            <>
              <Button variant="secondary" size="sm" icon={FileSpreadsheet} onClick={onCsv} disabled={!rows.length}>
                {t('reports.exportCsv')}
              </Button>
              <Button size="sm" icon={FileDown} onClick={onPdf} disabled={!rows.length}>
                {t('reports.exportPdf')}
              </Button>
            </>
          }
        />
        <div className="mt-4 border-y border-line bg-surface-2/40 p-3 sm:p-4">
          <FilterBar filters={active} values={params} onChange={set} onReset={() => reset(['team', 'competition', 'season', 'from', 'to'])} />
        </div>
        {query.error ? (
          <ErrorState error={query.error} onRetry={query.refetch} />
        ) : query.loading ? (
          <TableSkeleton columns={6} />
        ) : !rows.length ? (
          <EmptyState icon={FileText} title={t('reports.empty.title')} description={t('reports.empty.description')} />
        ) : (
          <div className={cn('transition-opacity', query.fetching && 'opacity-60')}>
            <div className="relative overflow-x-auto scrollbar-thin">
              <table className="w-full min-w-[720px] text-sm">
                <caption className="sr-only">{title}</caption>
                <thead>
                  <tr className="border-b border-line">
                    {def.columns.map((col) => (
                      <th key={col.label} scope="col" className="h-10 whitespace-nowrap px-3 text-left text-xs font-semibold uppercase tracking-wide text-ink-3 first:pl-5 last:pr-5">
                        {col.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, PREVIEW_LIMIT).map((r, i) => (
                    <tr key={i} className="border-b border-line last:border-0 even:bg-surface-2/40">
                      {def.columns.map((col, ci) => (
                        <td key={col.label} className={cn('whitespace-nowrap px-3 py-2.5 tabular first:pl-5 last:pr-5', ci === 0 ? 'font-medium text-ink' : 'text-ink-2')}>
                          {col.value(r)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {rows.length > PREVIEW_LIMIT && <p className="border-t border-line px-5 py-3 text-xs text-ink-3">{t('reports.previewLimit', { count: PREVIEW_LIMIT })}</p>}
          </div>
        )}
      </Card>
    </>
  );
}
