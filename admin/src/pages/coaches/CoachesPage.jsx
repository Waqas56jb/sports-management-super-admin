import { Link } from 'react-router-dom';
import { Award, ClipboardList, Plus, Users } from 'lucide-react';
import RowActions from '@/components/common/RowActions';
import { TeamChip } from '@/components/common/TeamLogo';
import Avatar from '@/components/ui/Avatar';
import { StatusBadge } from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import FilterBar from '@/components/ui/FilterBar';
import PageHeader from '@/components/ui/PageHeader';
import { CardSkeleton } from '@/components/ui/Skeleton';
import { EmptyState, ErrorState } from '@/components/ui/States';
import { useListParams } from '@/hooks/useListParams';
import { useOptions, useTeamOptions } from '@/hooks/useOptions';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useQuery } from '@/hooks/useQuery';
import { useI18n } from '@/i18n';
import { coachService } from '@/services/coachService';
import { COACH_STATUSES } from '@/utils/constants';
import { cn } from '@/utils/cn';
import { useCoachActions } from './useCoachActions';

function CoachCard({ coach, actions }) {
  const { t } = useI18n();
  return (
    <Card as="article" className="flex flex-col p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <Avatar name={coach.name} src={coach.photo} size="lg" />
        <div className="min-w-0 flex-1">
          <Link to={`/admin/coaches/${coach.id}`} className="block truncate text-base font-semibold text-ink hover:underline">
            {coach.name}
          </Link>
          <p className="truncate text-sm text-ink-3">{coach.email}</p>
          <div className="mt-2">
            <StatusBadge value={coach.status} />
          </div>
        </div>
        <RowActions items={actions} />
      </div>
      <dl className="mt-5 grid grid-cols-3 gap-2 border-t border-line pt-4 text-sm">
        <div className="min-w-0">
          <dt className="text-xs text-ink-3">{t('coaches.card.license')}</dt>
          <dd className="mt-0.5 flex items-center gap-1 truncate font-medium text-ink">
            <Award className="size-3.5 shrink-0 text-amber-500" aria-hidden="true" />
            <span className="truncate">{coach.license || '—'}</span>
          </dd>
        </div>
        <div>
          <dt className="text-xs text-ink-3">{t('coaches.form.experience')}</dt>
          <dd className="mt-0.5 font-medium text-ink tabular">{t('coaches.experienceShort', { count: coach.experience })}</dd>
        </div>
        <div>
          <dt className="text-xs text-ink-3">{t('coaches.card.players')}</dt>
          <dd className="mt-0.5 flex items-center gap-1 font-medium text-ink tabular">
            <Users className="size-3.5 text-ink-3" aria-hidden="true" />
            {coach.players_count}
          </dd>
        </div>
      </dl>
      <div className={cn('mt-4 flex min-h-11 items-center rounded-xl px-3 py-2', coach.team ? 'bg-surface-2' : 'border border-dashed border-line-strong')}>
        {coach.team ? <TeamChip team={coach.team} size="sm" /> : <span className="text-sm text-ink-3">{t('coaches.unassigned')}</span>}
      </div>
    </Card>
  );
}

export default function CoachesPage() {
  const { t } = useI18n();
  usePageTitle(t('coaches.title'));
  const toOptions = useOptions();
  const { teams, teamOptions } = useTeamOptions();
  const { params, set, reset } = useListParams();

  const list = useQuery(
    () => coachService.list({ search: params.search, status: params.status, teamId: params.team, pageSize: 'all' }),
    [params.search, params.status, params.team],
  );
  const { actionsFor, modals, openCreate } = useCoachActions({ teams, onChanged: list.refetch });
  const filtersActive = params.search || params.status || params.team;

  return (
    <>
      <PageHeader
        title={t('coaches.title')}
        description={t('coaches.description')}
        actions={
          <Button icon={Plus} onClick={openCreate}>
            {t('coaches.add')}
          </Button>
        }
      />
      <Card className="mb-4 p-3 sm:mb-6 sm:p-4">
        <FilterBar
          search={params.search ?? ''}
          onSearch={(v) => set({ search: v })}
          searchPlaceholder={t('coaches.searchPlaceholder')}
          filters={[
            { key: 'team', label: t('coaches.filters.team'), options: [...teamOptions, { value: 'none', label: t('coaches.filters.withoutTeam') }], placeholder: t('common.allTeams') },
            { key: 'status', label: t('common.status'), options: toOptions(COACH_STATUSES, 'status'), placeholder: t('common.allStatuses') },
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
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <CardSkeleton key={i} lines={4} />
          ))}
        </div>
      ) : list.data.data.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={ClipboardList}
            title={t('coaches.empty.title')}
            description={t('coaches.empty.description')}
            action={filtersActive ? <Button variant="secondary" onClick={() => reset()}>{t('common.reset')}</Button> : <Button icon={Plus} onClick={openCreate}>{t('coaches.add')}</Button>}
          />
        </div>
      ) : (
        <div className={cn('grid gap-4 sm:grid-cols-2 xl:grid-cols-3 sm:gap-6', list.fetching && 'opacity-60')}>
          {list.data.data.map((c) => (
            <CoachCard key={c.id} coach={c} actions={actionsFor(c)} />
          ))}
        </div>
      )}
      {modals}
    </>
  );
}
