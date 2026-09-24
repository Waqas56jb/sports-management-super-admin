import { CalendarCheck, Goal, Layers, MapPin, Shield, Trophy, UserRound, Users } from 'lucide-react';
import MatchRow from '@/components/common/MatchRow';
import MiniStat from '@/components/common/MiniStat';
import ProfileHero from '@/components/common/ProfileHero';
import TeamLogo from '@/components/common/TeamLogo';
import TeammateModal from '@/components/team/TeammateModal';
import Avatar from '@/components/ui/Avatar';
import Badge, { StatusBadge } from '@/components/ui/Badge';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import FilterBar from '@/components/ui/FilterBar';
import { DescriptionList, FormGuide } from '@/components/ui/Misc';
import { PageSkeleton, Skeleton } from '@/components/ui/Skeleton';
import { EmptyState, ErrorState } from '@/components/ui/States';
import Tabs from '@/components/ui/Tabs';
import { useListParams } from '@/hooks/useListParams';
import { useOptions } from '@/hooks/useOptions';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useRoster, useTeam } from '@/hooks/useTeam';
import { useI18n } from '@/i18n';
import { POSITIONS } from '@/utils/constants';
import { formatPercent } from '@/utils/formatters';
import { cn } from '@/utils/cn';

function useResultLabels() {
  const { t } = useI18n();
  return { W: t('results.W'), D: t('results.D'), L: t('results.L'), Wshort: t('results.Wshort'), Dshort: t('results.Dshort'), Lshort: t('results.Lshort') };
}

function Roster({ onOpen }) {
  const { t } = useI18n();
  const toOptions = useOptions();
  const { params, set, reset } = useListParams({ tab: 'overview' });
  const roster = useRoster({ search: params.search, position: params.position });
  return (
    <Card>
      <CardHeader title={t('team.roster.title')} subtitle={roster.data ? t('team.roster.count', { count: roster.data.length }) : ''} icon={Users} />
      <div className="mt-4 border-y border-line p-3 sm:p-4">
        <FilterBar
          search={params.search ?? ''}
          onSearch={(v) => set({ search: v })}
          searchPlaceholder={t('team.roster.search')}
          filters={[{ key: 'position', label: t('profile.fields.position'), options: toOptions(POSITIONS, 'positions'), placeholder: t('team.roster.allPositions') }]}
          values={params}
          onChange={set}
          onReset={() => reset(['search', 'position'])}
        />
      </div>
      <CardBody>
        {roster.error ? (
          <ErrorState compact error={roster.error} onRetry={roster.refetch} />
        ) : roster.loading ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} className="h-20" />
            ))}
          </div>
        ) : roster.data.length === 0 ? (
          <EmptyState compact icon={Users} title={t('team.roster.empty')} />
        ) : (
          <ul className={cn('grid gap-3 sm:grid-cols-2 xl:grid-cols-3', roster.fetching && 'opacity-60')}>
            {roster.data.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => onOpen(p.id)}
                  aria-label={t('team.roster.view', { name: p.name })}
                  className={cn('flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-shadow hover:shadow-(--shadow-card)', p.is_me ? 'border-brand-400 bg-brand-50/60 dark:border-brand-500/40 dark:bg-brand-500/5' : 'border-line bg-surface')}
                >
                  <span className="w-8 text-center font-display text-2xl font-bold text-ink-3 tabular">{p.jersey_number}</span>
                  <Avatar name={p.name} src={p.photo} size="md" />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="truncate text-sm font-semibold text-ink">{p.name}</span>
                      {p.is_me && <Badge tone="brand">{t('team.roster.you')}</Badge>}
                    </span>
                    <span className="mt-0.5 flex items-center gap-2 text-xs text-ink-3">
                      {t(`positions.${p.position}`)}
                      {p.status !== 'active' && <StatusBadge value={p.status} className="h-5 px-2 text-[11px]" />}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}

export default function MyTeam() {
  const { t, lang } = useI18n();
  usePageTitle(t('team.title'));
  const labels = useResultLabels();
  const { params, set } = useListParams({ tab: 'overview' });
  const q = useTeam();
  const teammate = params.player ?? null;
  const setTeammate = (id) => set({ player: id ?? undefined });

  if (q.loading) return <PageSkeleton variant="detail" />;
  if (q.error) {
    return (
      <div className="card">
        <ErrorState error={q.error} onRetry={q.refetch} />
      </div>
    );
  }
  const team = q.data;
  const r = team.record;
  const comp = team.competition;

  return (
    <>
      <ProfileHero
        avatar={
          <span className="grid size-24 place-items-center rounded-2xl bg-surface p-2 shadow-(--shadow-card) ring-4 ring-surface sm:size-28">
            <TeamLogo team={team} size="2xl" className="size-full" />
          </span>
        }
        title={team.name}
        badge={<StatusBadge value={team.status} />}
        meta={
          <>
            {comp ? (
              <span className="inline-flex items-center gap-1.5">
                <Trophy className="size-4 text-amber-500" aria-hidden="true" />
                {comp.name} {comp.season}
                {comp.position && <Badge tone="brand">{t('team.position', { pos: comp.position, total: comp.teams })}</Badge>}
              </span>
            ) : (
              <span>{t('team.noCompetition')}</span>
            )}
            {team.coach && (
              <span className="inline-flex items-center gap-1.5">
                <UserRound className="size-4" aria-hidden="true" />
                {t('team.headCoach')}: {team.coach.name}
              </span>
            )}
          </>
        }
      />

      <Tabs
        className="mt-5"
        label={team.name}
        value={params.tab}
        onChange={(v) => set({ tab: v })}
        tabs={[
          { value: 'overview', label: t('team.tabs.overview') },
          { value: 'roster', label: t('team.tabs.roster'), count: team.players_count },
        ]}
      />

      <div className="mt-4" role="tabpanel">
        {params.tab === 'roster' ? (
          <Roster onOpen={setTeammate} />
        ) : (
          <div className="space-y-4 sm:space-y-6">
            <Card>
              <CardHeader title={t('team.overview.stats')} subtitle={comp ? t('team.overview.statsSub', { competition: `${comp.name} ${comp.season}` }) : undefined} />
              <CardBody className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-8">
                <MiniStat label={t('team.stats.played')} value={r?.played ?? 0} icon={Trophy} />
                <MiniStat label={t('team.stats.won')} value={r?.won ?? 0} icon={Layers} accent="text-emerald-600" />
                <MiniStat label={t('team.stats.drawn')} value={r?.drawn ?? 0} icon={Layers} />
                <MiniStat label={t('team.stats.lost')} value={r?.lost ?? 0} icon={Layers} accent="text-red-600" />
                <MiniStat label={t('team.stats.scored')} value={r?.goals_for ?? 0} icon={Goal} />
                <MiniStat label={t('team.stats.conceded')} value={r?.goals_against ?? 0} icon={Shield} />
                <MiniStat label={t('team.stats.points')} value={r?.points ?? 0} icon={Trophy} />
                <MiniStat label={t('team.stats.attendance')} value={team.attendance.rate != null ? formatPercent(team.attendance.rate, lang) : '—'} icon={CalendarCheck} />
              </CardBody>
            </Card>
            <div className="grid gap-4 sm:gap-6 xl:grid-cols-3">
              <Card>
                <CardHeader title={t('team.overview.about')} />
                <CardBody className="space-y-5">
                  <p className="text-sm leading-relaxed text-ink-2">{team.description}</p>
                  <DescriptionList
                    items={[
                      { label: t('team.headCoach'), value: team.coach?.name, icon: UserRound },
                      { label: t('team.assistantCoach'), value: team.assistant_coach?.name, icon: UserRound },
                      { label: t('team.overview.category'), value: `${t(`categories.${team.category}`)} · ${t(`ageGroups.${team.age_group}`)} · ${t(`teamGenders.${team.gender}`)}`, icon: Users },
                      { label: t('team.overview.homeGround'), value: team.home_ground, icon: MapPin },
                      { label: t('team.overview.founded'), value: team.founded, icon: Trophy },
                    ]}
                  />
                </CardBody>
              </Card>
              <Card>
                <CardHeader title={t('team.overview.nextMatch')} />
                <div className="px-1.5 pb-2 pt-2 sm:px-2">{team.next_match ? <MatchRow match={team.next_match} /> : <EmptyState compact icon={Goal} title={t('team.overview.noNextMatch')} />}</div>
              </Card>
              <Card>
                <CardHeader title={t('team.overview.recent')} action={r?.form?.length > 0 && <FormGuide form={r.form} labels={labels} />} />
                <div className="px-1.5 pb-2 pt-2 sm:px-2">{team.recent_results.length ? team.recent_results.map((m) => <MatchRow key={m.id} match={m} />) : <EmptyState compact icon={Trophy} title={t('team.overview.noRecent')} />}</div>
              </Card>
            </div>
          </div>
        )}
      </div>
      <TeammateModal id={teammate} onClose={() => setTeammate(null)} />
    </>
  );
}
