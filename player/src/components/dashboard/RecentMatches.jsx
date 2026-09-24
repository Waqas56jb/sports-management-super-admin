import { useNavigate } from 'react-router-dom';
import { Trophy } from 'lucide-react';
import TeamLogo from '@/components/common/TeamLogo';
import { Card, CardHeader } from '@/components/ui/Card';
import DataTable from '@/components/ui/DataTable';
import { EmptyState } from '@/components/ui/States';
import { useI18n } from '@/i18n';
import { formatShortDate } from '@/utils/formatters';
import { cn } from '@/utils/cn';

export const RESULT_STYLES = { W: 'bg-emerald-600 text-white', D: 'bg-slate-400 text-white dark:bg-slate-500', L: 'bg-red-600 text-white' };

export function ResultPill({ result }) {
  const { t } = useI18n();
  return (
    <span className={cn('grid size-6 shrink-0 place-items-center rounded-md text-[11px] font-bold', RESULT_STYLES[result])} title={t(`results.${result}`)}>
      <span aria-hidden="true">{t(`results.${result}short`)}</span>
      <span className="sr-only">{t(`results.${result}`)}</span>
    </span>
  );
}

/** Recent completed matches with the player's own participation (table on desktop, cards on phones). */
export default function RecentMatches({ rows }) {
  const { t, lang } = useI18n();
  const navigate = useNavigate();
  const participation = (line) => (!line ? t('dashboard.recent.didNotPlay') : line.started ? t('dashboard.recent.started') : t('dashboard.recent.sub'));
  const columns = [
    { key: 'date', header: t('common.date'), render: (r) => <span className="tabular">{formatShortDate(r.match.date, lang)}</span> },
    {
      key: 'opponent',
      header: t('dashboard.recent.opponent'),
      render: (r) => (
        <span className="flex items-center gap-2">
          <TeamLogo team={r.opponent} size="xs" />
          <span className="truncate text-ink">{r.opponent?.name}</span>
        </span>
      ),
    },
    {
      key: 'result',
      header: t('dashboard.recent.result'),
      render: (r) => (
        <span className="flex items-center gap-2">
          <ResultPill result={r.result} />
          <span className="font-semibold text-ink tabular">
            {r.gf}–{r.ga}
          </span>
        </span>
      ),
    },
    { key: 'part', header: t('dashboard.recent.participation'), render: (r) => <span className={cn(!r.line && 'text-ink-3')}>{participation(r.line)}</span> },
    { key: 'min', header: t('dashboard.recent.minutes'), align: 'right', render: (r) => <span className="tabular">{r.line ? `${r.line.minutes}'` : '—'}</span> },
    { key: 'g', header: t('dashboard.recent.goals'), align: 'right', render: (r) => <span className="font-semibold tabular text-ink">{r.line?.goals ?? '—'}</span> },
    { key: 'a', header: t('dashboard.recent.assists'), align: 'right', render: (r) => <span className="tabular">{r.line?.assists ?? '—'}</span> },
    {
      key: 'rating',
      header: t('dashboard.recent.rating'),
      align: 'right',
      render: (r) => (r.line ? <span className="rounded-md bg-brand-50 px-2 py-0.5 font-semibold text-brand-800 tabular dark:bg-brand-500/15 dark:text-brand-200">{r.line.rating.toFixed(1)}</span> : '—'),
    },
  ];
  return (
    <Card>
      <CardHeader title={t('dashboard.recent.title')} action={<button type="button" onClick={() => navigate('/player/matches?tab=completed')} className="text-sm font-medium text-brand-700 hover:underline dark:text-brand-300">{t('common.viewAll')}</button>} />
      <div className="mt-3">
        <DataTable
          caption={t('dashboard.recent.title')}
          columns={columns}
          rows={rows}
          rowKey={(r) => r.match.id}
          onRowClick={(r) => navigate(`/player/matches/${r.match.id}`)}
          empty={<EmptyState compact icon={Trophy} title={t('dashboard.recent.empty')} />}
          mobileCard={(r) => (
            <div className="flex items-center gap-3">
              <ResultPill result={r.result} />
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1.5 truncate text-sm font-medium text-ink">
                  <TeamLogo team={r.opponent} size="xs" />
                  {t('dashboard.recent.vs', { team: r.opponent?.name })}
                </p>
                <p className="truncate text-xs text-ink-3">
                  {formatShortDate(r.match.date, lang)} · {participation(r.line)}
                  {r.line ? ` · ${r.line.minutes}' · ${t('dashboard.recent.goals')} ${r.line.goals} · ${t('dashboard.recent.assists')} ${r.line.assists}` : ''}
                </p>
              </div>
              <div className="text-right">
                <p className="font-display text-lg font-bold text-ink tabular">
                  {r.gf}–{r.ga}
                </p>
                {r.line && <p className="text-xs font-semibold text-brand-700 tabular dark:text-brand-300">{r.line.rating.toFixed(1)}</p>}
              </div>
            </div>
          )}
        />
      </div>
    </Card>
  );
}
