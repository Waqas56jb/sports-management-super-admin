import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { CalendarCheck, Dumbbell, Goal, Layers, MapPin, Pencil, Shield, Trophy, UserMinus, UserPlus, Users, UserRound } from 'lucide-react';
import BackLink from '@/components/common/BackLink';
import DetailGuard from '@/components/common/DetailGuard';
import MatchRow from '@/components/common/MatchRow';
import MiniStat from '@/components/common/MiniStat';
import ProfileHero from '@/components/common/ProfileHero';
import RowActions from '@/components/common/RowActions';
import SessionRow from '@/components/common/SessionRow';
import TeamLogo from '@/components/common/TeamLogo';
import Avatar from '@/components/ui/Avatar';
import { StatusBadge } from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { DescriptionList, FormGuide, Meter } from '@/components/ui/Misc';
import { EmptyState } from '@/components/ui/States';
import Tabs from '@/components/ui/Tabs';
import { useTeamOptions } from '@/hooks/useOptions';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useQuery } from '@/hooks/useQuery';
import { useI18n } from '@/i18n';
import { teamService } from '@/services/teamService';
import { POSITIONS } from '@/utils/constants';
import { formatPercent } from '@/utils/format';
import { cn } from '@/utils/cn';
import { useTeamActions } from './useTeamActions';

function RosterCard({ player, onRemove }) {
  const { t } = useI18n();
  const s = player.statistics;
  return (
    <li className="group relative flex items-center gap-3 rounded-xl border border-line bg-surface p-3 transition-shadow hover:shadow-(--shadow-card)">
      <span className="w-7 shrink-0 text-center font-display text-2xl font-bold text-ink-3 tabular">{player.jersey_number ?? '–'}</span>
      <Avatar name={player.name} src={player.photo} size="md" />
      <div className="min-w-0 flex-1">
        <Link to={`/admin/players/${player.id}`} className="block truncate text-sm font-semibold text-ink after:absolute after:inset-0 hover:underline">
          {player.name}
        </Link>
        <p className="mt-0.5 flex items-center gap-2 text-xs text-ink-3">
          <span className="tabular">
            {t('teams.detail.apps')} {s?.matches_played ?? 0} · {t('teams.detail.goals')} {s?.goals ?? 0}
          </span>
          {player.status !== 'active' && <StatusBadge value={player.status} className="h-5 px-2 text-[11px]" />}
        </p>
      </div>
      <button
        type="button"
        onClick={() => onRemove(player)}
        className="relative z-10 grid size-10 shrink-0 place-items-center rounded-lg text-ink-3 opacity-100 hover:bg-red-50 hover:text-red-600 focus-visible:opacity-100 dark:hover:bg-red-500/10 sm:size-9 sm:opacity-0 sm:group-hover:opacity-100"
        aria-label={`${t('teams.detail.removeFromTeam')} — ${player.name}`}
        title={t('teams.detail.removeFromTeam')}
      >
        <UserMinus className="size-4" />
      </button>
    </li>
  );
}

export default function TeamDetailPage() {
  const { id } = useParams();
  const { t, lang } = useI18n();
  const navigate = useNavigate();
  const query = useQuery(() => teamService.get(id), [id]);
  const { teams } = useTeamOptions();
  usePageTitle(query.data?.name ?? t('teams.title'));
  const { actionsFor, modals, removePlayer, openEdit, openAddPlayers } = useTeamActions({
    teams,
    onChanged: query.refetch,
    onDeleted: () => navigate('/admin/teams', { replace: true }),
    showView: false,
  });
  const [trainingTab, setTrainingTab] = useState('upcoming');
  const labels = { W: t('results.W'), D: t('results.D'), L: t('results.L'), Wshort: t('results.Wshort'), Dshort: t('results.Dshort'), Lshort: t('results.Lshort') };

  return (
    <>
      <DetailGuard query={query} entity={t('common.team')} backTo="/admin/teams" backLabel={t('teams.detail.back')}>
        {(team) => {
          const r = team.record;
          const sessions = trainingTab === 'upcoming' ? team.upcoming_sessions : team.recent_sessions;
          return (
            <>
              <BackLink to="/admin/teams">{t('teams.detail.back')}</BackLink>
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
                    <span>
                      {t(`categories.${team.category}`)} · {t(`ageGroups.${team.age_group}`)} · {t(`teamGenders.${team.gender}`)}
                    </span>
                    {team.home_ground && (
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="size-3.5" aria-hidden="true" />
                        {team.home_ground}
                      </span>
                    )}
                    {r?.form?.length > 0 && <FormGuide form={r.form} labels={labels} />}
                  </>
                }
                actions={
                  <>
                    <Button variant="secondary" icon={Pencil} onClick={() => openEdit(team)} className="flex-1 sm:flex-none">
                      {t('common.edit')}
                    </Button>
                    <div className="rounded-xl border border-line-strong">
                      <RowActions items={actionsFor(team)} />
                    </div>
                  </>
                }
              />

              <section aria-label={t('teams.detail.statistics')} className="mt-4 grid grid-cols-2 gap-3 sm:mt-6 sm:grid-cols-3 lg:grid-cols-6">
                <MiniStat className="bg-surface" label={t('teams.card.players')} value={team.roster.length} icon={Users} />
                <MiniStat className="bg-surface" label={t('competitions.standings.played')} value={r?.played ?? 0} icon={Trophy} />
                <MiniStat className="bg-surface" label={t('teams.card.record')} value={r ? `${r.won}-${r.drawn}-${r.lost}` : '—'} icon={Layers} />
                <MiniStat className="bg-surface" label={t('competitions.standings.goalsFor')} value={r?.goals_for ?? 0} icon={Goal} />
                <MiniStat className="bg-surface" label={t('competitions.standings.goalsAgainst')} value={r?.goals_against ?? 0} icon={Shield} />
                <MiniStat className="bg-surface" label={t('teams.card.attendance')} value={team.attendance.rate != null ? formatPercent(team.attendance.rate, lang) : '—'} icon={CalendarCheck} />
              </section>

              <div className="mt-4 grid gap-4 sm:mt-6 sm:gap-6 xl:grid-cols-3">
                <Card className="xl:col-span-2">
                  <CardHeader
                    title={t('teams.detail.roster')}
                    subtitle={t('teams.detail.rosterCount', { count: team.roster.length })}
                    action={
                      <Button variant="secondary" size="sm" icon={UserPlus} onClick={() => openAddPlayers(team)}>
                        {t('teams.actions.addPlayers')}
                      </Button>
                    }
                  />
                  <CardBody>
                    {team.roster.length === 0 ? (
                      <EmptyState compact icon={Users} title={t('teams.detail.rosterEmpty')} description={t('teams.detail.rosterEmptyHint')} action={<Button icon={UserPlus} onClick={() => openAddPlayers(team)}>{t('teams.actions.addPlayers')}</Button>} />
                    ) : (
                      <div className="space-y-5">
                        {POSITIONS.map((pos) => {
                          const group = team.roster.filter((p) => p.position === pos);
                          if (!group.length) return null;
                          return (
                            <div key={pos}>
                              <h3 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-ink-3">
                                {t(`positions.${pos}`)}
                                <span className="rounded-full bg-surface-3 px-1.5 tabular">{group.length}</span>
                              </h3>
                              <ul className="grid gap-2 sm:grid-cols-2">
                                {group.map((p) => (
                                  <RosterCard key={p.id} player={p} onRemove={(pl) => removePlayer(team, pl)} />
                                ))}
                              </ul>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </CardBody>
                </Card>

                <div className="space-y-4 sm:space-y-6">
                  <Card>
                    <CardHeader title={t('teams.detail.info')} />
                    <CardBody className="space-y-5">
                      {team.description && <p className="text-sm leading-relaxed text-ink-2">{team.description}</p>}
                      <DescriptionList
                        items={[
                          {
                            label: t('teams.card.coach'),
                            icon: UserRound,
                            value: team.coach ? (
                              <Link to={`/admin/coaches/${team.coach.id}`} className="inline-flex items-center gap-2 hover:underline">
                                <Avatar name={team.coach.name} src={team.coach.photo} size="xs" />
                                {team.coach.name}
                              </Link>
                            ) : (
                              <span className="text-ink-3">{t('teams.noCoach')}</span>
                            ),
                          },
                          { label: t('teams.form.homeGround'), value: team.home_ground, icon: MapPin },
                          { label: t('teams.form.founded'), value: team.founded, icon: Trophy },
                        ]}
                      />
                      {team.attendance.rate != null && (
                        <div>
                          <div className="mb-1.5 flex justify-between text-sm">
                            <span className="text-ink-2">{t('teams.card.attendance')}</span>
                            <span className="font-semibold text-ink tabular">{formatPercent(team.attendance.rate, lang)}</span>
                          </div>
                          <Meter value={team.attendance.rate} label={t('teams.card.attendance')} />
                        </div>
                      )}
                    </CardBody>
                  </Card>

                  <Card>
                    <CardHeader title={t('teams.detail.training')} action={<Tabs size="sm" value={trainingTab} onChange={setTrainingTab} label={t('teams.detail.training')} tabs={[{ value: 'upcoming', label: t('teams.detail.upcomingTraining') }, { value: 'recent', label: t('teams.detail.recentTraining') }]} />} />
                    <div className="px-1.5 pb-2 pt-2 sm:px-2">
                      {sessions.length ? sessions.map((s) => <SessionRow key={s.id} session={s} showTeam={false} />) : <EmptyState compact icon={Dumbbell} title={t('teams.detail.noTraining')} />}
                    </div>
                  </Card>
                </div>
              </div>

              <div className="mt-4 grid gap-4 sm:mt-6 sm:gap-6 lg:grid-cols-2">
                <Card>
                  <CardHeader title={t('teams.detail.upcomingMatches')} />
                  <div className={cn('px-1.5 pb-2 pt-2 sm:px-2')}>
                    {team.upcoming_matches.length ? team.upcoming_matches.map((m) => <MatchRow key={m.id} match={m} />) : <EmptyState compact icon={Goal} title={t('teams.detail.noUpcoming')} />}
                  </div>
                </Card>
                <Card>
                  <CardHeader title={t('teams.detail.recentMatches')} />
                  <div className="px-1.5 pb-2 pt-2 sm:px-2">
                    {team.recent_matches.length ? team.recent_matches.map((m) => <MatchRow key={m.id} match={m} />) : <EmptyState compact icon={Trophy} title={t('teams.detail.noRecent')} />}
                  </div>
                </Card>
              </div>
            </>
          );
        }}
      </DetailGuard>
      {modals}
    </>
  );
}
