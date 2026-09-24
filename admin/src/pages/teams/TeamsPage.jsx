import { Link } from 'react-router-dom';
import { MapPin, Plus, Shield } from 'lucide-react';
import RowActions from '@/components/common/RowActions';
import TeamLogo from '@/components/common/TeamLogo';
import Avatar from '@/components/ui/Avatar';
import { StatusBadge } from '@/components/ui/Badge';
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
import { TEAM_CATEGORIES, TEAM_COLOR_VARS, TEAM_STATUSES } from '@/utils/constants';
import { formatPercent } from '@/utils/format';
import { cn } from '@/utils/cn';
import { useTeamActions } from './useTeamActions';

function TeamCard({ team, actions }) {
  const { t, lang } = useI18n();
  const r = team.record;
  const labels = { W: t('results.W'), D: t('results.D'), L: t('results.L'), Wshort: t('results.Wshort'), Dshort: t('results.Dshort'), Lshort: t('results.Lshort') };
  return (
    <Card as="article" className="relative flex flex-col overflow-hidden">
      <div className="h-1.5" style={{ background: TEAM_COLOR_VARS[team.color % TEAM_COLOR_VARS.length] }} aria-hidden="true" />
      <div className="flex items-start gap-4 p-4 sm:p-5">
        <TeamLogo team={team} size="xl" className="size-16" />
        <div className="min-w-0 flex-1">
          <Link to={`/admin/teams/${team.id}`} className="block truncate text-lg font-semibold text-ink after:absolute after:inset-0 hover:underline">
            {team.name}
          </Link>
          <p className="mt-0.5 text-sm text-ink-3">
            {t(`categories.${team.category}`)} · {t(`ageGroups.${team.age_group}`)}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <StatusBadge value={team.status} />
            {r?.form?.length > 0 && <FormGuide form={r.form} labels={labels} />}
          </div>
        </div>
        <div className="relative z-10">
          <RowActions items={actions} />
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
      <div className="mt-auto flex items-center justify-between gap-3 p-4 text-sm sm:px-5">
        <span className="flex min-w-0 items-center gap-2">
          {team.coach ? (
            <>
              <Avatar name={team.coach.name} src={team.coach.photo} size="xs" />
              <span className="truncate text-ink-2">{team.coach.name}</span>
            </>
          ) : (
            <span className="text-ink-3">{t('teams.noCoach')}</span>
          )}
        </span>
        {team.home_ground && (
          <span className="hidden min-w-0 items-center gap-1 text-xs text-ink-3 sm:flex">
            <MapPin className="size-3 shrink-0" aria-hidden="true" />
            <span className="truncate">{team.home_ground}</span>
          </span>
        )}
      </div>
    </Card>
  );
}

export default function TeamsPage() {
  const { t } = useI18n();
  usePageTitle(t('teams.title'));
  const toOptions = useOptions();
  const { params, set, reset } = useListParams();
  const list = useQuery(() => teamService.list({ search: params.search, status: params.status, category: params.category }), [params.search, params.status, params.category]);
  const { actionsFor, modals, openCreate } = useTeamActions({ teams: list.data?.data ?? [], onChanged: list.refetch });
  const filtersActive = params.search || params.status || params.category;

  return (
    <>
      <PageHeader
        title={t('teams.title')}
        description={t('teams.description')}
        actions={
          <Button icon={Plus} onClick={openCreate}>
            {t('teams.add')}
          </Button>
        }
      />
      <Card className="mb-4 p-3 sm:mb-6 sm:p-4">
        <FilterBar
          search={params.search ?? ''}
          onSearch={(v) => set({ search: v })}
          searchPlaceholder={t('teams.searchPlaceholder')}
          filters={[
            { key: 'category', label: t('teams.form.category'), options: toOptions(TEAM_CATEGORIES, 'categories'), placeholder: t('common.all') },
            { key: 'status', label: t('common.status'), options: toOptions(TEAM_STATUSES, 'status'), placeholder: t('common.allStatuses') },
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
        <div className="grid gap-4 sm:gap-6 md:grid-cols-2 2xl:grid-cols-3">
          {[0, 1, 2, 3].map((i) => (
            <CardSkeleton key={i} lines={5} />
          ))}
        </div>
      ) : list.data.data.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={Shield}
            title={t('teams.empty.title')}
            description={t('teams.empty.description')}
            action={filtersActive ? <Button variant="secondary" onClick={() => reset()}>{t('common.reset')}</Button> : <Button icon={Plus} onClick={openCreate}>{t('teams.add')}</Button>}
          />
        </div>
      ) : (
        <div className={cn('grid gap-4 sm:gap-6 md:grid-cols-2 2xl:grid-cols-3', list.fetching && 'opacity-60')}>
          {list.data.data.map((team) => (
            <TeamCard key={team.id} team={team} actions={actionsFor(team)} />
          ))}
        </div>
      )}
      {modals}
    </>
  );
}
