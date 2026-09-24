import { FormGuide } from '@/components/ui/Misc';
import { useI18n } from '@/i18n';
import { cn } from '@/utils/cn';
import { TeamChip } from './TeamLogo';

/** League table: position, team, P W D L, goals, GD, points, form. */
export default function StandingsTable({ rows, highlight = [] }) {
  const { t } = useI18n();
  const labels = { W: t('results.W'), D: t('results.D'), L: t('results.L'), Wshort: t('results.Wshort'), Dshort: t('results.Dshort'), Lshort: t('results.Lshort') };
  const th = 'py-2.5 text-xs font-semibold uppercase tracking-wide text-ink-3';
  return (
    <div className="overflow-x-auto scrollbar-thin">
      <table className="w-full min-w-[560px] text-sm">
        <caption className="sr-only">{t('competitions.detail.standings')}</caption>
        <thead>
          <tr className="border-y border-line bg-surface-2/60">
            <th scope="col" className={cn(th, 'w-12 pl-5 text-left')}>{t('competitions.standings.pos')}</th>
            <th scope="col" className={cn(th, 'text-left')}>{t('competitions.standings.team')}</th>
            <th scope="col" className={cn(th, 'text-center')} title={t('competitions.standings.played')}>{t('competitions.standings.playedShort')}</th>
            <th scope="col" className={cn(th, 'text-center')} title={t('results.W')}>{t('competitions.standings.won')}</th>
            <th scope="col" className={cn(th, 'text-center')} title={t('results.D')}>{t('competitions.standings.drawn')}</th>
            <th scope="col" className={cn(th, 'text-center')} title={t('results.L')}>{t('competitions.standings.lost')}</th>
            <th scope="col" className={cn(th, 'hidden text-center sm:table-cell')}>{t('competitions.standings.goalsShort')}</th>
            <th scope="col" className={cn(th, 'text-center')}>{t('competitions.standings.goalDifference')}</th>
            <th scope="col" className={cn(th, 'text-center')}>{t('competitions.standings.points')}</th>
            <th scope="col" className={cn(th, 'hidden pr-5 text-right md:table-cell')}>{t('competitions.standings.form')}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.team_id} className={cn('border-b border-line last:border-0', highlight.includes(r.team_id) && 'bg-brand-50/60 dark:bg-brand-500/5')}>
              <td className="py-3 pl-5">
                <span className={cn('grid size-7 place-items-center rounded-lg text-sm font-semibold tabular', i === 0 ? 'bg-brand-600 text-white dark:bg-brand-500 dark:text-brand-950' : 'bg-surface-3 text-ink-2')}>{i + 1}</span>
              </td>
              <td className="py-3">
                <TeamChip team={r.team} link={highlight.includes(r.team_id)} />
              </td>
              <td className="py-3 text-center tabular text-ink-2">{r.played}</td>
              <td className="py-3 text-center tabular text-ink-2">{r.won}</td>
              <td className="py-3 text-center tabular text-ink-2">{r.drawn}</td>
              <td className="py-3 text-center tabular text-ink-2">{r.lost}</td>
              <td className="hidden py-3 text-center tabular text-ink-2 sm:table-cell">
                {r.goals_for}:{r.goals_against}
              </td>
              <td className="py-3 text-center tabular text-ink-2">{r.goal_difference > 0 ? `+${r.goal_difference}` : r.goal_difference}</td>
              <td className="py-3 text-center font-display text-lg font-bold tabular text-ink">{r.points}</td>
              <td className="hidden py-3 pr-5 text-right md:table-cell">
                <FormGuide form={r.form} labels={labels} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
