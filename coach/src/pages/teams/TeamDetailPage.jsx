import { useNavigate, useParams } from 'react-router-dom';
import { CalendarCheck, CalendarPlus, Dumbbell, Goal, Layers, MapPin, Shield, Trophy, UserRound, Users } from 'lucide-react';
import BackLink from '@/components/common/BackLink';
import DetailGuard from '@/components/common/DetailGuard';
import MatchRow from '@/components/common/MatchRow';
import MiniStat from '@/components/common/MiniStat';
import PersonCell from '@/components/common/PersonCell';
import ProfileHero from '@/components/common/ProfileHero';
import SessionRow from '@/components/common/SessionRow';
import TeamLogo from '@/components/common/TeamLogo';
import Avatar from '@/components/ui/Avatar';
import Badge, { StatusBadge } from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import DataTable from '@/components/ui/DataTable';
import { DescriptionList, FormGuide, Meter } from '@/components/ui/Misc';
import { EmptyState } from '@/components/ui/States';
import Tabs from '@/components/ui/Tabs';
import { useListParams } from '@/hooks/useListParams';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useQuery } from '@/hooks/useQuery';
import { useI18n } from '@/i18n';
import { teamService } from '@/services/teamService';
import { ageFrom, formatPercent } from '@/utils/format';
import { useResultLabels } from './TeamsPage';

const TABS = ['overview', 'roster', 'matches', 'training', 'statistics'];

function MatchList({ title, matches, empty, icon }) {
  return (
    <Card>
      <CardHeader title={title} />
      <div className="px-1.5 pb-2 pt-2 sm:px-2">{matches.length ? matches.map((m) => <MatchRow key={m.id} match={m} />) : <EmptyState compact icon={icon} title={empty} />}</div>
    </Card>
  );
}

function SessionList({ title, sessions, empty, action }) {
  return (
    <Card>
      <CardHeader title={title} action={action} />
      <div className="px-1.5 pb-2 pt-2 sm:px-2">{sessions.length ? sessions.map((s) => <SessionRow key={s.id} session={s} showTeam={false} />) : <EmptyState compact icon={Dumbbell} title={empty} />}</div>
    </Card>
  );
}

export default function TeamDetailPage() {
  const { id } = useParams();
  const { t, lang } = useI18n();
  const navigate = useNavigate();
  const labels = useResultLabels();
  const { params, set } = useListParams({ tab: 'overview' });
  const tab = TABS.includes(params.tab) ? params.tab : 'overview';
  const query = useQuery(() => teamService.get(id), [id]);
  usePageTitle(query.data?.name ?? t('teams.title'));

  return (
    <DetailGuard query={query} entity={t('common.team')} backTo="/coach/teams" backLabel={t('teams.detail.back')}>
      {(team) => {
        const r = team.record;
        const pct = (v) => (v != null ? formatPercent(v, lang) : '—');
        const summary = (
          <section aria-label={t('teams.detail.summary')} className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-8">
            <MiniStat className="bg-surface" label={t('teams.detail.stats.players')} value={team.roster.length} icon={Users} />
            <MiniStat className="bg-surface" label={t('teams.detail.stats.played')} value={r?.played ?? 0} icon={Trophy} />
            <MiniStat className="bg-surface" label={t('teams.detail.stats.wins')} value={r?.won ?? 0} icon={Layers} accent="text-emerald-600" />
            <MiniStat className="bg-surface" label={t('teams.detail.stats.draws')} value={r?.drawn ?? 0} icon={Layers} />
            <MiniStat className="bg-surface" label={t('teams.detail.stats.losses')} value={r?.lost ?? 0} icon={Layers} accent="text-red-600" />
            <MiniStat className="bg-surface" label={t('teams.detail.stats.scored')} value={r?.goals_for ?? 0} icon={Goal} />
            <MiniStat className="bg-surface" label={t('teams.detail.stats.conceded')} value={r?.goals_against ?? 0} icon={Shield} />
            <MiniStat className="bg-surface" label={t('teams.detail.stats.attendance')} value={pct(team.attendance.rate)} icon={CalendarCheck} />
          </section>
        );

        const rosterColumns = [
          { key: 'jersey_number', header: '#', align: 'center', className: 'w-12', render: (p) => <span className="font-display text-lg font-bold text-ink-3 tabular">{p.jersey_number ?? '–'}</span> },
          { key: 'name', header: t('players.columns.player'), render: (p) => <PersonCell name={p.name} photo={p.photo} to={`/coach/players/${p.id}`} sub={t(`positions.${p.position}`)} size="sm" /> },
          { key: 'age', header: t('teams.detail.age'), align: 'right', render: (p) => <span className="tabular">{ageFrom(p.date_of_birth) ?? '—'}</span> },
          { key: 'status', header: t('common.status'), render: (p) => <StatusBadge value={p.status} /> },
          {
            key: 'attendance',
            header: t('teams.detail.playerAttendance'),
            render: (p) =>
              p.attendance_rate != null ? (
                <div className="flex w-32 items-center gap-2">
                  <Meter value={p.attendance_rate} size="sm" className="flex-1" />
                  <span className="w-10 text-right text-xs font-semibold tabular text-ink">{pct(p.attendance_rate)}</span>
                </div>
              ) : (
                '—'
              ),
          },
          { key: 'goals', header: t('teams.detail.goals'), align: 'right', render: (p) => <span className="tabular">{p.statistics?.goals ?? 0}</span> },
          {
            key: 'rating',
            header: t('teams.detail.rating'),
            align: 'right',
            render: (p) => (p.statistics?.rating ? <span className="rounded-md bg-brand-50 px-2 py-0.5 font-semibold text-brand-800 tabular dark:bg-brand-500/15 dark:text-brand-200">{p.statistics.rating.toFixed(1)}</span> : '—'),
          },
        ];

        return (
          <>
            <BackLink to="/coach/teams">{t('teams.detail.back')}</BackLink>
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
                  <Badge tone="neutral">{t(`categories.${team.category}`)}</Badge>
                  <Badge tone="neutral">{t(`ageGroups.${team.age_group}`)}</Badge>
                  <Badge tone="neutral">{t(`teamGenders.${team.gender}`)}</Badge>
                  {r?.form?.length > 0 && <FormGuide form={r.form} labels={labels} />}
                </>
              }
              actions={
                <Button icon={CalendarPlus} to={`/coach/training?new=1&team=${team.id}`} className="flex-1 sm:flex-none">
                  {t('teams.detail.newSession')}
                </Button>
              }
            />

            <Tabs className="mt-5" label={team.name} value={tab} onChange={(v) => set({ tab: v })} tabs={TABS.map((k) => ({ value: k, label: t(`teams.tabs.${k}`), count: k === 'roster' ? team.roster.length : undefined }))} />

            <div className="mt-4 space-y-4 sm:space-y-6" role="tabpanel">
              {tab === 'overview' && (
                <>
                  {summary}
                  <div className="grid gap-4 sm:gap-6 xl:grid-cols-3">
                    <Card>
                      <CardHeader title={t('teams.detail.info')} />
                      <CardBody className="space-y-5">
                        {team.description && <p className="text-sm leading-relaxed text-ink-2">{team.description}</p>}
                        <DescriptionList
                          items={[
                            { label: t('teams.headCoach'), value: team.coach?.name, icon: UserRound },
                            { label: t('teams.detail.homeGround'), value: team.home_ground, icon: MapPin },
                            { label: t('teams.detail.founded'), value: team.founded, icon: Trophy },
                          ]}
                        />
                      </CardBody>
                    </Card>
                    <MatchList title={t('teams.detail.upcomingMatches')} matches={team.upcoming_matches.slice(0, 3)} empty={t('teams.detail.noUpcoming')} icon={Goal} />
                    <SessionList title={t('teams.detail.upcomingTraining')} sessions={team.upcoming_sessions.slice(0, 4)} empty={t('teams.detail.noTraining')} />
                  </div>
                </>
              )}

              {tab === 'roster' && (
                <Card>
                  <CardHeader title={t('teams.detail.roster')} subtitle={t('teams.detail.rosterCount', { count: team.roster.length })} />
                  <div className="mt-3">
                    <DataTable
                      caption={t('teams.detail.roster')}
                      columns={rosterColumns}
                      rows={team.roster}
                      onRowClick={(p) => navigate(`/coach/players/${p.id}`)}
                      empty={<EmptyState compact icon={Users} title={t('teams.detail.rosterEmpty')} />}
                      mobileCard={(p) => (
                        <div className="flex items-center gap-3">
                          <span className="w-7 text-center font-display text-xl font-bold text-ink-3 tabular">{p.jersey_number ?? '–'}</span>
                          <Avatar name={p.name} src={p.photo} size="md" />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold text-ink">{p.name}</p>
                            <p className="text-xs text-ink-3">
                              {t(`positions.${p.position}`)} · {t('teams.detail.age')} {ageFrom(p.date_of_birth) ?? '—'} · {pct(p.attendance_rate)}
                            </p>
                          </div>
                          {p.status !== 'active' ? <StatusBadge value={p.status} /> : p.statistics?.rating ? <span className="rounded-md bg-brand-50 px-2 py-0.5 text-sm font-semibold text-brand-800 tabular dark:bg-brand-500/15 dark:text-brand-200">{p.statistics.rating.toFixed(1)}</span> : null}
                        </div>
                      )}
                    />
                  </div>
                </Card>
              )}

              {tab === 'matches' && (
                <div className="grid gap-4 sm:gap-6 lg:grid-cols-2">
                  <MatchList title={t('teams.detail.upcomingMatches')} matches={team.upcoming_matches} empty={t('teams.detail.noUpcoming')} icon={Goal} />
                  <MatchList title={t('teams.detail.recentMatches')} matches={team.recent_matches} empty={t('teams.detail.noRecent')} icon={Trophy} />
                </div>
              )}

              {tab === 'training' && (
                <div className="grid gap-4 sm:gap-6 lg:grid-cols-2">
                  <SessionList
                    title={t('teams.detail.upcomingTraining')}
                    sessions={team.upcoming_sessions}
                    empty={t('teams.detail.noTraining')}
                    action={
                      <Button size="sm" variant="secondary" icon={CalendarPlus} to={`/coach/training?new=1&team=${team.id}`}>
                        {t('teams.detail.newSession')}
                      </Button>
                    }
                  />
                  <SessionList title={t('teams.detail.recentTraining')} sessions={team.recent_sessions} empty={t('teams.detail.noTraining')} />
                </div>
              )}

              {tab === 'statistics' && (
                <>
                  {summary}
                  <div className="grid gap-4 sm:gap-6 lg:grid-cols-2">
                    <Card>
                      <CardHeader title={t('teams.detail.byCompetition')} />
                      {team.by_competition.length === 0 ? (
                        <EmptyState compact icon={Trophy} title={t('teams.detail.noRecent')} />
                      ) : (
                        <div className="mt-3 overflow-x-auto scrollbar-thin">
                          <table className="w-full min-w-[420px] text-sm">
                            <thead>
                              <tr className="border-y border-line bg-surface-2/60 text-xs uppercase tracking-wide text-ink-3">
                                <th scope="col" className="py-2.5 pl-5 text-left font-semibold">{t('common.competition')}</th>
                                <th scope="col" className="py-2.5 text-center font-semibold">{t('competitions.standings.playedShort')}</th>
                                <th scope="col" className="py-2.5 text-center font-semibold">{t('competitions.standings.won')}</th>
                                <th scope="col" className="py-2.5 text-center font-semibold">{t('competitions.standings.drawn')}</th>
                                <th scope="col" className="py-2.5 text-center font-semibold">{t('competitions.standings.lost')}</th>
                                <th scope="col" className="py-2.5 pr-5 text-right font-semibold">{t('competitions.standings.goalsShort')}</th>
                              </tr>
                            </thead>
                            <tbody>
                              {team.by_competition.map((row) => (
                                <tr key={row.competition?.id ?? 'friendly'} className="border-b border-line last:border-0">
                                  <td className="py-3 pl-5 font-medium text-ink">{row.competition ? `${row.competition.name} ${row.competition.season}` : t('matches.friendly')}</td>
                                  <td className="py-3 text-center tabular">{row.played}</td>
                                  <td className="py-3 text-center tabular">{row.won}</td>
                                  <td className="py-3 text-center tabular">{row.drawn}</td>
                                  <td className="py-3 text-center tabular">{row.lost}</td>
                                  <td className="py-3 pr-5 text-right tabular">
                                    {row.goals_for}:{row.goals_against}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </Card>
                    <Card>
                      <CardHeader title={t('teams.detail.topScorers')} />
                      <CardBody>
                        {team.top_scorers.length === 0 ? (
                          <EmptyState compact icon={Goal} title={t('teams.detail.noScorers')} />
                        ) : (
                          <ol className="space-y-3">
                            {team.top_scorers.map((s, i) => (
                              <li key={s.player.id} className="flex items-center gap-3">
                                <span className="w-5 text-center font-display text-lg font-bold text-ink-3 tabular">{i + 1}</span>
                                <PersonCell className="flex-1" name={s.player.name} photo={s.player.photo} to={`/coach/players/${s.player.id}`} sub={t(`positions.${s.player.position}`)} size="sm" />
                                <span className="font-display text-2xl font-bold text-ink tabular">{s.goals}</span>
                              </li>
                            ))}
                          </ol>
                        )}
                      </CardBody>
                    </Card>
                  </div>
                </>
              )}
            </div>
          </>
        );
      }}
    </DetailGuard>
  );
}
