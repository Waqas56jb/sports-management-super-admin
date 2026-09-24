import { Link } from 'react-router-dom';
import { CalendarDays, MapPin, Trophy } from 'lucide-react';
import TeamLogo from '@/components/common/TeamLogo';
import Badge, { StatusBadge } from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import FilterBar from '@/components/ui/FilterBar';
import { Meter } from '@/components/ui/Misc';
import PageHeader from '@/components/ui/PageHeader';
import { CardSkeleton } from '@/components/ui/Skeleton';
import { EmptyState, ErrorState } from '@/components/ui/States';
import { useListParams } from '@/hooks/useListParams';
import { useOptions, useSeasonOptions } from '@/hooks/useOptions';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useQuery } from '@/hooks/useQuery';
import { useI18n } from '@/i18n';
import { competitionService } from '@/services/competitionService';
import { COMPETITION_STATUSES } from '@/utils/constants';
import { formatDate } from '@/utils/formatters';
import { cn } from '@/utils/cn';

const TYPE_TONE = { league: 'brand', cup: 'warning', tournament: 'info' };

function CompetitionCard({ c }) {
  const { t, lang } = useI18n();
  return (
    <Card as="article" className="relative flex flex-col p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-300">
          <Trophy className="size-6" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <Link to={`/player/competitions/${c.id}`} className="block text-base font-semibold text-ink after:absolute after:inset-0 hover:underline">
            {c.name} <span className="text-ink-3">{c.season}</span>
          </Link>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            <StatusBadge value={c.status} />
            <Badge tone={TYPE_TONE[c.type]}>{t(`competitionTypes.${c.type}`)}</Badge>
          </div>
        </div>
      </div>
      <ul className="mt-4 space-y-1.5 text-sm text-ink-2">
        <li className="flex items-center gap-2">
          <CalendarDays className="size-4 shrink-0 text-ink-3" aria-hidden="true" />
          {formatDate(c.start_date, lang, { day: 'numeric', month: 'short' })} – {formatDate(c.end_date, lang)}
        </li>
        <li className="flex min-w-0 items-center gap-2">
          <MapPin className="size-4 shrink-0 text-ink-3" aria-hidden="true" />
          <span className="truncate">{c.location}</span>
        </li>
      </ul>
      <dl className="mt-4 grid grid-cols-3 gap-2 rounded-xl bg-surface-2 p-3 text-center">
        <div className="min-w-0">
          <dt className="text-xs text-ink-3">{t('competitions.yourTeam')}</dt>
          <dd className="mt-1 flex justify-center">
            <TeamLogo team={c.team} size="sm" />
          </dd>
        </div>
        <div>
          <dt className="text-xs text-ink-3">{t('competitions.standing')}</dt>
          <dd className="font-display text-xl font-bold text-ink tabular">{c.position ? t('competitions.standingValue', { pos: c.position, total: c.teams_count }) : '—'}</dd>
        </div>
        <div>
          <dt className="text-xs text-ink-3">{t('competitions.columns.progress')}</dt>
          <dd className="font-display text-xl font-bold text-ink tabular">
            {c.matches_completed}/{c.matches_total}
          </dd>
        </div>
      </dl>
      <div className="mt-3">
        <Meter value={c.matches_total ? (c.matches_completed / c.matches_total) * 100 : 0} tone="brand" size="sm" label={t('competitions.columns.progress')} />
        <p className="mt-1.5 text-xs text-ink-3">{t('competitions.yourMatches', { count: c.my_matches })}</p>
      </div>
    </Card>
  );
}

export default function Competitions() {
  const { t } = useI18n();
  usePageTitle(t('competitions.title'));
  const toOptions = useOptions();
  const seasons = useSeasonOptions();
  const { params, set, reset } = useListParams();
  const list = useQuery(() => competitionService.getCompetitions({ search: params.search, status: params.status, season: params.season }), [params.search, params.status, params.season]);
  const filtersActive = params.search || params.status || params.season;

  return (
    <>
      <PageHeader title={t('competitions.title')} description={t('competitions.description')} />
      <Card className="mb-4 p-3 sm:mb-6 sm:p-4">
        <FilterBar
          search={params.search ?? ''}
          onSearch={(v) => set({ search: v })}
          searchPlaceholder={t('competitions.searchPlaceholder')}
          filters={[
            { key: 'season', label: t('common.season'), options: seasons, placeholder: t('competitions.allSeasons') },
            { key: 'status', label: t('common.status'), options: toOptions(COMPETITION_STATUSES, 'status'), placeholder: t('common.allStatuses') },
          ]}
          values={params}
          onChange={set}
          onReset={() => reset()}
        />
      </Card>
      {list.error ? (
        <div className="card">
          <ErrorState error={list.error} onRetry={list.refetch} />
        </div>
      ) : list.loading ? (
        <div className="grid gap-4 sm:gap-6 md:grid-cols-2 2xl:grid-cols-3" role="status" aria-label={t('common.loading')}>
          {[0, 1, 2].map((i) => (
            <CardSkeleton key={i} lines={5} />
          ))}
        </div>
      ) : list.data.length === 0 ? (
        <div className="card">
          <EmptyState icon={Trophy} title={t('competitions.empty.title')} description={t('competitions.empty.description')} action={filtersActive && <Button variant="secondary" onClick={() => reset()}>{t('common.reset')}</Button>} />
        </div>
      ) : (
        <div className={cn('grid gap-4 sm:gap-6 md:grid-cols-2 2xl:grid-cols-3', list.fetching && 'opacity-60')}>
          {list.data.map((c) => (
            <CompetitionCard key={c.id} c={c} />
          ))}
        </div>
      )}
    </>
  );
}
