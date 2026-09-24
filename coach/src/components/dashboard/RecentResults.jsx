import { Link } from 'react-router-dom';
import { Trophy } from 'lucide-react';
import TeamLogo from '@/components/common/TeamLogo';
import { Card, CardHeader } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/States';
import { useI18n } from '@/i18n';
import { formatShortDate } from '@/utils/format';
import { cn } from '@/utils/cn';

export const RESULT_STYLES = { W: 'bg-emerald-600 text-white', D: 'bg-slate-400 text-white dark:bg-slate-500', L: 'bg-red-600 text-white' };

/** Last results from the coach's point of view: result pill, score, opponent, date. */
export default function RecentResults({ results }) {
  const { t, lang } = useI18n();
  return (
    <Card className="flex flex-col">
      <CardHeader
        title={t('dashboard.results.title')}
        action={
          <Link to="/coach/matches?status=completed" className="text-sm font-medium text-brand-700 hover:underline dark:text-brand-300">
            {t('common.viewAll')}
          </Link>
        }
      />
      {results.length === 0 ? (
        <EmptyState compact icon={Trophy} title={t('dashboard.results.empty')} />
      ) : (
        <ul className="px-2 pb-3 pt-2">
          {results.map((r) => (
            <li key={r.id}>
              <Link to={`/coach/matches/${r.id}`} className="flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-surface-2">
                <span className={cn('grid size-8 shrink-0 place-items-center rounded-lg text-xs font-bold', RESULT_STYLES[r.result])} title={t(`results.${r.result}`)}>
                  {t(`results.${r.result}short`)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5 text-sm font-medium text-ink">
                    <TeamLogo team={r.opponent} size="xs" />
                    <span className="truncate">{t('dashboard.results.vs', { team: r.opponent?.name })}</span>
                  </span>
                  <span className="block truncate text-xs text-ink-3">
                    {r.my_team?.short_name} · {formatShortDate(r.date, lang)} · {r.competition?.name ?? t('matches.friendly')}
                  </span>
                </span>
                <span className="font-display text-lg font-bold text-ink tabular">
                  {r.gf}–{r.ga}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
