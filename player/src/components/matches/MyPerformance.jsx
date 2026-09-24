import { Activity, Crosshair, Goal, Percent, Square, Star, Target, Timer, Waypoints, Zap } from 'lucide-react';
import MiniStat from '@/components/common/MiniStat';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/States';
import { useI18n } from '@/i18n';
import { formatPercent } from '@/utils/formatters';

/** The logged-in player's own line for a match — read-only. */
export default function MyPerformance({ line }) {
  const { t, lang } = useI18n();
  const accuracy = line?.passes ? (line.completed_passes / line.passes) * 100 : null;
  return (
    <Card>
      <CardHeader title={t('matches.myPerformance.title')} subtitle={t('matches.myPerformance.subtitle')} icon={Activity} />
      {!line ? (
        <EmptyState compact icon={Activity} title={t('matches.myPerformance.notPlayed')} />
      ) : (
        <CardBody className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          <MiniStat label={t('matches.myPerformance.minutes')} value={`${line.minutes}'`} icon={Timer} />
          <MiniStat label={t('matches.myPerformance.goals')} value={line.goals} icon={Goal} accent="text-emerald-600" />
          <MiniStat label={t('matches.myPerformance.assists')} value={line.assists} icon={Star} accent="text-sky-600" />
          <MiniStat label={t('matches.myPerformance.shots')} value={line.shots} icon={Crosshair} />
          <MiniStat label={t('matches.myPerformance.shotsOnTarget')} value={line.shots_on_target} icon={Target} />
          <MiniStat label={t('matches.myPerformance.passes')} value={line.passes} icon={Waypoints} />
          <MiniStat label={t('matches.myPerformance.passAccuracy')} value={accuracy != null ? formatPercent(accuracy, lang) : '—'} icon={Percent} />
          <MiniStat label={t('matches.myPerformance.fouls')} value={line.fouls} icon={Zap} />
          <MiniStat label={t('matches.myPerformance.yellow')} value={line.yellow_cards} icon={Square} accent="fill-amber-400 text-amber-500" />
          <MiniStat label={t('matches.myPerformance.red')} value={line.red_cards} icon={Square} accent="fill-red-500 text-red-600" />
          <MiniStat label={t('matches.myPerformance.rating')} value={line.rating.toFixed(1)} icon={Star} accent="fill-amber-400 text-amber-500" className="col-span-2 sm:col-span-1" />
        </CardBody>
      )}
    </Card>
  );
}
