import { Link } from 'react-router-dom';
import { CalendarDays, Dumbbell, Goal, Shield } from 'lucide-react';
import TeamLogo from '@/components/common/TeamLogo';
import Badge, { StatusBadge } from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import FilterBar from '@/components/ui/FilterBar';
import { FormGuide } from '@/components/ui/Misc';
import PageHeader from '@/components/ui/PageHeader';
import { CardSkeleton } from '@/components/ui/Skeleton';
import { EmptyState, ErrorState } from '@/components/ui/States';
import { useListParams } from '@/hooks/useListParams';
import { useOptions } from '@/hooks/useOptions';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useQuery } from '@/hooks/useQuery';
import { useI18n } from '@/i18n';
import { teamService } from '@/services/teamService';
import { TEAM_CATEGORIES, TEAM_COLOR_VARS } from '@/utils/constants';
import { formatPercent, formatRelativeDay, formatTime } from '@/utils/format';
import { cn } from '@/utils/cn';

export function useResultLabels() {
  const { t } = useI18n();
  return { W: t('results.W'), D: t('results.D'), L: t('results.L'), Wshort: t('results.Wshort'), Dshort: t('results.Dshort'), Lshort: t('results.Lshort') };
}

function ScheduleLine({ icon: Icon, label, children, to }) {
  const body = (
    <>
      <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-surface-3 text-ink-2">
        <Icon className="size-4" aria-hidden="true" />
      </span>
      <span className="min-w-0">
        <span className="block text-[11px] font-semibold uppercase tracking-wide text-ink-3">{label}</span>
        <span className="block truncate text-sm text-ink">{children}</span>
      </span>
    </>
  );
  return to ? (
    <Link to={to} className="relative z-10 flex items-center gap-3 rounded-lg p-1 hover:bg-surface-2">
      {body}
    </Link>
  ) : (
    <div className="flex items-center gap-3 p-1">{body}</div>
  );
}

function TeamCard({ team }) {
  const { t, lang } = useI18n();
  const labels = useResultLabels();
  const r = team.record;
  const nm = team.next_match;
  const ns = team.next_session;
  const opponent = nm && (nm.home_team_id === team.id ? nm.away_team : nm.home_team);
  return (
    <Card as="article" className="relative flex flex-col overflow-hidden">
      <div className="h-1.5" style={{ background: TEAM_COLOR_VARS[team.color % TEAM_COLOR_VARS.length] }} aria-hidden="true" />
      <div className="flex items-start gap-4 p-4 sm:p-5">
        <TeamLogo team={team} size="xl" className="size-16" />
        <div className="min-w-0 flex-1">
          <Link to={`/coach/teams/${team.id}`} className="block truncate text-lg font-semibold text-ink after:absolute after:inset-0 hover:underline">
            {team.name}
          </Link>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            <Badge tone="neutral">{t(`categories.${team.category}`)}</Badge>
            <Badge tone="neutral">{t(`ageGroups.${team.age_group}`)}</Badge>
            <Badge tone="neutral">{t(`teamGenders.${team.gender}`)}</Badge>
            <StatusBadge value={team.status} />
          </div>
        </div>
      </div>
      <dl className="mx-4 grid grid-cols-3 gap-2 rounded-xl bg-surface-2 p-3 text-center sm:mx-5">
        <div>
          <dt className="text-xs text-ink-3">{t('teams.card.players')}</dt>
          <dd className="font-display text-2xl font-bold text-ink tabular">{team.players_count}</dd>
        </div>
        <div>
          <dt className="text-xs text-ink-3">{t('teams.card.record')}</dt>
          <dd className="font-display text-2xl font-bold text-ink tabular">{r ? `${r.won}-${r.drawn}-${r.lost}` : '—'}</dd>
        </div>
        <div>
          <dt className="text-xs text-ink-3">{t('teams.card.attendance')}</dt>
          <dd className="font-display text-2xl font-bold text-ink tabular">{team.attendance_rate != null ? formatPercent(team.attendance_rate, lang) : '—'}</dd>
        </div>
      </dl>
      <div className="mt-3 space-y-1 px-3 sm:px-4">
        <ScheduleLine icon={Goal} label={t('teams.card.nextMatch')} to={nm && `/coach/matches/${nm.id}`}>
          {nm ? (
            <>
              <span className="capitalize">{formatRelativeDay(nm.date, lang, t)}</span> · {formatTime(nm.time)} · {t('matches.vs')} {opponent?.name}
            </>
          ) : (
            <span className="text-ink-3">{t('teams.card.none')}</span>
          )}
        </ScheduleLine>
        <ScheduleLine icon={Dumbbell} label={t('teams.card.nextTraining')} to={ns && `/coach/training/${ns.id}`}>
          {ns ? (
            <>
              <span className="capitalize">{formatRelativeDay(ns.date, lang, t)}</span> · {formatTime(ns.start_time)} · {t(`trainingTypes.${ns.training_type}`)}
            </>
          ) : (
            <span className="text-ink-3">{t('teams.card.none')}</span>
          )}
        </ScheduleLine>
      </div>
      <div className="mt-auto flex items-center justify-between gap-3 p-4 sm:px-5">
        {r?.form?.length > 0 ? <FormGuide form={r.form} labels={labels} /> : <span />}
        <span className="relative z-10">
          <Button variant="secondary" size="sm" to={`/coach/teams/${team.id}`}>
            {t('teams.card.view')}
          </Button>
        </span>
      </div>
    </Card>
  );
}

export default function TeamsPage() {
  const { t } = useI18n();
  usePageTitle(t('teams.title'));
  const toOptions = useOptions();
  const { params, set, reset } = useListParams();
  const list = useQuery(() => teamService.list({ search: params.search, category: params.category }), [params.search, params.category]);
  const filtered = params.search || params.category;

  return (
    <>
      <PageHeader title={t('teams.title')} description={t('teams.description')} />
      <Card className="mb-4 p-3 sm:mb-6 sm:p-4">
        <FilterBar
          search={params.search ?? ''}
          onSearch={(v) => set({ search: v })}
          searchPlaceholder={t('teams.searchPlaceholder')}
          filters={[{ key: 'category', label: t('teams.category'), options: toOptions(TEAM_CATEGORIES, 'categories'), placeholder: t('teams.allCategories') }]}
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
        <div className="grid gap-4 sm:gap-6 md:grid-cols-2">
          {[0, 1].map((i) => (
            <CardSkeleton key={i} lines={6} />
          ))}
        </div>
      ) : list.data.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={filtered ? CalendarDays : Shield}
            title={filtered ? t('teams.empty.filteredTitle') : t('teams.empty.title')}
            description={filtered ? undefined : t('teams.empty.description')}
            action={filtered && <Button variant="secondary" onClick={() => reset()}>{t('common.reset')}</Button>}
          />
        </div>
      ) : (
        <div className={cn('grid gap-4 sm:gap-6 md:grid-cols-2 2xl:grid-cols-3', list.fetching && 'opacity-60')}>
          {list.data.map((team) => (
            <TeamCard key={team.id} team={team} />
          ))}
        </div>
      )}
    </>
  );
}
