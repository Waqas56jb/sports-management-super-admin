import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { BarChart3, CalendarDays, ClipboardList, Clock, Goal, MapPin, Pencil, Plus, RefreshCw, Trophy, UserRound, Users } from 'lucide-react';
import BackLink from '@/components/common/BackLink';
import DetailGuard from '@/components/common/DetailGuard';
import PersonCell from '@/components/common/PersonCell';
import TeamLogo from '@/components/common/TeamLogo';
import LineupEditor from '@/components/matches/LineupEditor';
import { statRows, TeamStatsComparison, TeamStatsModal } from '@/components/matches/TeamStats';
import { StatusBadge } from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { DescriptionList } from '@/components/ui/Misc';
import { EmptyState } from '@/components/ui/States';
import Tabs from '@/components/ui/Tabs';
import { useConfirm } from '@/context/ConfirmContext';
import { useAction } from '@/hooks/useAction';
import { useListParams } from '@/hooks/useListParams';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useQuery } from '@/hooks/useQuery';
import { useI18n } from '@/i18n';
import { matchService } from '@/services/matchService';
import { formatLongDate, formatTime } from '@/utils/format';
import EventModal from './centre/EventModal';
import PitchView from './centre/PitchView';
import Scoreboard from './centre/Scoreboard';
import ScoreModal from './centre/ScoreModal';
import Timeline from './centre/Timeline';

const TABS = ['overview', 'lineup', 'events', 'statistics'];

function PlayerStatsTable({ match, side }) {
  const { t } = useI18n();
  const team = side === 'home' ? match.home_team : match.away_team;
  const squad = Object.fromEntries(match.squads[side].map((p) => [p.id, p]));
  const lines = Object.values(match.player_lines).filter((l) => l.team_id === team?.id);
  lines.sort((a, b) => Number(b.started) - Number(a.started) || (squad[a.player_id]?.jersey_number ?? 99) - (squad[b.player_id]?.jersey_number ?? 99));
  const th = 'py-2.5 text-xs font-semibold uppercase tracking-wide text-ink-3';
  const mine = match.editable_sides.includes(side);
  return (
    <Card>
      <CardHeader title={<span className="flex items-center gap-2"><TeamLogo team={team} size="sm" />{team?.name}</span>} />
      <div className="mt-3 overflow-x-auto scrollbar-thin">
        <table className="w-full min-w-[440px] text-sm">
          <thead>
            <tr className="border-y border-line bg-surface-2/60">
              <th scope="col" className={`${th} pl-5 text-left`}>{t('matches.stats.player')}</th>
              <th scope="col" className={`${th} text-right`}>{t('matches.stats.minutes')}</th>
              <th scope="col" className={`${th} text-right`}>{t('matches.stats.goals')}</th>
              <th scope="col" className={`${th} text-right`}>{t('matches.stats.assists')}</th>
              <th scope="col" className={`${th} text-center`}>{t('matches.stats.cards')}</th>
              <th scope="col" className={`${th} pr-5 text-right`}>{t('matches.stats.rating')}</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l) => {
              const p = squad[l.player_id];
              return (
                <tr key={l.player_id} className="border-b border-line last:border-0">
                  <td className="py-2.5 pl-5">
                    <PersonCell name={p?.name ?? t('matches.centre.formerPlayer')} photo={p?.photo} size="sm" to={p && mine ? `/coach/players/${p.id}` : undefined} sub={l.started ? t('matches.lineup.starting') : t('matches.lineup.substitutes')} />
                  </td>
                  <td className="py-2.5 text-right tabular text-ink-2">{l.minutes}'</td>
                  <td className="py-2.5 text-right font-semibold tabular text-ink">{l.goals || '·'}</td>
                  <td className="py-2.5 text-right tabular text-ink-2">{l.assists || '·'}</td>
                  <td className="py-2.5 text-center">
                    <span className="inline-flex gap-1" aria-label={`${l.yellow_cards} ${t('eventTypes.yellow_card')}, ${l.red_cards} ${t('eventTypes.red_card')}`}>
                      {Array.from({ length: l.yellow_cards }, (_, i) => <span key={`y${i}`} className="h-3.5 w-2.5 rounded-[2px] bg-amber-400" />)}
                      {Array.from({ length: l.red_cards }, (_, i) => <span key={`r${i}`} className="h-3.5 w-2.5 rounded-[2px] bg-red-600" />)}
                      {!l.yellow_cards && !l.red_cards && <span className="text-ink-3">·</span>}
                    </span>
                  </td>
                  <td className="py-2.5 pr-5 text-right font-semibold tabular text-ink">{l.rating.toFixed(1)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function ReadOnlyLineup({ match, side }) {
  const { t } = useI18n();
  const team = side === 'home' ? match.home_team : match.away_team;
  const lineup = match.lineups?.[side];
  const byId = Object.fromEntries(match.squads[side].map((p) => [p.id, p]));
  const known = (ids) => ids.map((id) => byId[id]).filter(Boolean);
  return (
    <Card>
      <CardHeader title={<span className="flex items-center gap-2"><TeamLogo team={team} size="sm" />{t('matches.editor.readOnlyTitle', { team: team?.name })}</span>} subtitle={lineup ? `${t('matches.lineup.formation')} ${lineup.formation}` : undefined} />
      <CardBody>
        {!lineup || !lineup.starting.length ? (
          <EmptyState compact icon={ClipboardList} title={t('matches.lineup.notSet')} />
        ) : (
          <div className="space-y-4">
            <PitchView formation={lineup.formation} starters={known(lineup.starting)} team={team} />
            {lineup.substitutes.length > 0 && (
              <ul className="flex flex-wrap gap-1.5">
                {known(lineup.substitutes).map((p) => (
                  <li key={p.id} className="inline-flex items-center gap-1.5 rounded-lg bg-surface-3 px-2 py-1 text-xs text-ink-2">
                    <span className="font-semibold text-ink tabular">{p.jersey_number ?? '–'}</span>
                    {p.name}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </CardBody>
    </Card>
  );
}

export default function MatchDetailPage() {
  const { id } = useParams();
  const { t, lang } = useI18n();
  const confirm = useConfirm();
  const run = useAction();
  const query = useQuery(() => matchService.get(id), [id]);
  const m = query.data;
  const { params, set } = useListParams({ tab: 'overview' });
  const tab = TABS.includes(params.tab) ? params.tab : 'overview';
  const [dialog, setDialog] = useState(null);
  const [lineupSide, setLineupSide] = useState(null);
  usePageTitle(m ? `${m.home_team?.short_name} ${m.home_score ?? ''}${m.home_score !== null ? '–' : 'v'}${m.away_score ?? ''} ${m.away_team?.short_name}` : t('matches.title'));

  const close = () => setDialog(null);
  const saveStatus = async (values) => {
    await run(() => matchService.updateStatus(id, values), { success: 'matches.toasts.scoreUpdated' });
    close();
    query.refetch();
  };
  const saveEvent = async ({ side, ...values }) => {
    await run(() => matchService.addEvent(id, { ...values, team_id: side === 'home' ? m.home_team_id : m.away_team_id }), { success: 'matches.toasts.eventAdded' });
    close();
    query.refetch();
  };
  const deleteEvent = async (e) => {
    const ok = await confirm({
      title: t('matches.confirmDeleteEvent.title'),
      message: t('matches.confirmDeleteEvent.message'),
      confirmLabel: t('common.delete'),
      onConfirm: () => run(() => matchService.removeEvent(id, e.id), { success: 'matches.toasts.eventDeleted' }),
    });
    if (ok) query.refetch();
  };
  const saveStats = async (stats) => {
    await run(() => matchService.updateTeamStats(id, stats), { success: 'matches.teamStats.saved' });
    close();
    query.refetch();
  };

  const canRecord = m && (m.status === 'live' || m.status === 'completed');

  return (
    <>
      <DetailGuard query={query} entity={t('calendar.kinds.match')} backTo="/coach/matches" backLabel={t('matches.centre.back')}>
        {(match) => {
          const rows = statRows(match);
          const editable = match.editable_sides;
          const side = lineupSide && editable.includes(lineupSide) ? lineupSide : editable[0];
          const otherSide = side === 'home' ? 'away' : 'home';
          const goals = match.events.filter((e) => e.event_type === 'goal');
          return (
            <>
              <BackLink to="/coach/matches">{t('matches.centre.back')}</BackLink>
              <Scoreboard
                match={match}
                actions={
                  match.status !== 'cancelled' && (
                    <>
                      <Button icon={Plus} onClick={() => setDialog('event')} disabled={!canRecord} className="dark:bg-brand-500">
                        {t('matches.actions.event')}
                      </Button>
                      <Button variant="secondary" icon={RefreshCw} onClick={() => setDialog('status')} className="border-white/15 bg-white/10 text-white hover:bg-white/15 dark:border-white/15 dark:bg-white/10">
                        {t('matches.actions.score')}
                      </Button>
                    </>
                  )
                }
              />
              {!canRecord && match.status === 'scheduled' && <p className="mt-3 text-center text-xs text-ink-3">{t('matches.event.notStarted')}</p>}

              <Tabs
                className="mt-5"
                label={t('matches.title')}
                value={tab}
                onChange={(v) => set({ tab: v })}
                tabs={TABS.map((k) => ({ value: k, label: t(`matches.centreTabs.${k}`), count: k === 'events' ? match.events.length : undefined }))}
              />

              <div className="mt-4" role="tabpanel">
                {tab === 'overview' && (
                  <div className="grid gap-4 sm:gap-6 lg:grid-cols-3">
                    <Card>
                      <CardHeader title={t('matches.overview.details')} />
                      <CardBody>
                        <DescriptionList
                          items={[
                            { label: t('common.competition'), icon: Trophy, value: match.competition ? <Link to={`/coach/competitions/${match.competition.id}`} className="hover:underline">{match.competition.name} {match.competition.season}</Link> : t('matches.friendly') },
                            { label: t('common.date'), icon: CalendarDays, value: <span className="capitalize">{formatLongDate(match.date, lang)}</span> },
                            { label: t('matches.centre.kickoff'), icon: Clock, value: formatTime(match.time) },
                            { label: t('matches.centre.venue'), icon: MapPin, value: match.location },
                            { label: t('matches.centre.referee'), icon: UserRound, value: match.referee },
                            { label: t('common.status'), icon: Goal, value: <StatusBadge value={match.status} /> },
                          ]}
                        />
                      </CardBody>
                    </Card>
                    <Card>
                      <CardHeader title={t('matches.overview.scorers')} />
                      <CardBody>
                        {goals.length === 0 ? (
                          <EmptyState compact icon={Goal} title={t('matches.overview.noGoals')} />
                        ) : (
                          <ul className="space-y-2.5">
                            {goals.map((g) => (
                              <li key={g.id} className="flex items-center gap-3 text-sm">
                                <span className="w-10 font-semibold text-ink tabular">{g.minute}'</span>
                                <TeamLogo team={g.team_id === match.home_team_id ? match.home_team : match.away_team} size="xs" />
                                <span className="min-w-0 flex-1 truncate text-ink">{g.player?.name ?? t('matches.centre.formerPlayer')}</span>
                                {g.description && <span className="text-xs text-ink-3">{g.description}</span>}
                              </li>
                            ))}
                          </ul>
                        )}
                      </CardBody>
                    </Card>
                    <div className="space-y-4 sm:space-y-6">
                      {editable.map((s) => {
                        const tm = s === 'home' ? match.home_team : match.away_team;
                        const lu = match.lineups?.[s];
                        const ready = lu?.starting?.length === 11;
                        return (
                          <Card key={s}>
                            <CardBody className="flex items-center gap-3">
                              <TeamLogo team={tm} size="md" />
                              <div className="min-w-0 flex-1">
                                <p className="text-xs font-medium uppercase tracking-wide text-ink-3">{t('matches.overview.yourLineup')}</p>
                                <p className={ready ? 'text-sm font-semibold text-emerald-700 dark:text-emerald-300' : 'text-sm font-semibold text-amber-700 dark:text-amber-300'}>
                                  {ready ? t('matches.overview.lineupReady', { formation: lu.formation }) : t('matches.overview.lineupMissing')}
                                </p>
                              </div>
                              <Button
                                size="sm"
                                variant={ready ? 'secondary' : 'primary'}
                                icon={ClipboardList}
                                onClick={() => {
                                  setLineupSide(s);
                                  set({ tab: 'lineup' });
                                }}
                              >
                                {ready ? t('common.edit') : t('matches.overview.setLineup')}
                              </Button>
                            </CardBody>
                          </Card>
                        );
                      })}
                      <Card>
                        <CardHeader title={t('matches.overview.keyStats')} action={rows.length > 0 && <button type="button" onClick={() => set({ tab: 'statistics' })} className="text-sm font-medium text-brand-700 hover:underline dark:text-brand-300">{t('common.viewAll')}</button>} />
                        <CardBody>{rows.length ? <TeamStatsComparison match={match} rows={rows.filter((r) => ['possession', 'shots', 'shots_on_target', 'corners'].includes(r.key))} /> : <EmptyState compact icon={BarChart3} title={t('matches.teamStats.empty')} />}</CardBody>
                      </Card>
                    </div>
                  </div>
                )}

                {tab === 'lineup' && (
                  <div className="space-y-4 sm:space-y-6">
                    {editable.length > 1 && (
                      <Tabs
                        size="sm"
                        label={t('matches.centreTabs.lineup')}
                        value={side}
                        onChange={setLineupSide}
                        tabs={editable.map((s) => ({ value: s, label: (s === 'home' ? match.home_team : match.away_team)?.name }))}
                      />
                    )}
                    {match.status === 'cancelled' ? (
                      <div className="card">
                        <EmptyState compact icon={ClipboardList} title={t('matches.centre.cancelledNote')} />
                      </div>
                    ) : (
                      <Card>
                        <CardHeader title={t('matches.editor.title', { team: (side === 'home' ? match.home_team : match.away_team)?.name })} icon={Users} />
                        <CardBody>
                          <LineupEditor
                            key={`${match.id}-${side}`}
                            team={side === 'home' ? match.home_team : match.away_team}
                            squad={match.squads[side]}
                            lineup={match.lineups?.[side]}
                            onSave={async (lineup) => {
                              await run(() => matchService.saveLineup(id, side, lineup), { success: 'matches.toasts.lineupSaved' });
                              await query.refetch();
                            }}
                          />
                        </CardBody>
                      </Card>
                    )}
                    {!editable.includes(otherSide) && <ReadOnlyLineup match={match} side={otherSide} />}
                  </div>
                )}

                {tab === 'events' && (
                  <Card>
                    <CardHeader
                      title={t('matches.centre.timeline')}
                      action={
                        canRecord && (
                          <Button size="sm" icon={Plus} onClick={() => setDialog('event')}>
                            {t('matches.actions.event')}
                          </Button>
                        )
                      }
                    />
                    <CardBody>
                      <Timeline match={match} onDelete={canRecord ? deleteEvent : undefined} />
                    </CardBody>
                  </Card>
                )}

                {tab === 'statistics' && (
                  <div className="space-y-4 sm:space-y-6">
                    <Card>
                      <CardHeader
                        title={t('matches.teamStats.title')}
                        action={
                          rows.length > 0 && (
                            <Button size="sm" variant="secondary" icon={Pencil} onClick={() => setDialog('stats')}>
                              {t('matches.teamStats.edit')}
                            </Button>
                          )
                        }
                      />
                      <CardBody>
                        {rows.length ? (
                          <div className="mx-auto max-w-2xl">
                            <TeamStatsComparison match={match} rows={rows} />
                            <p className="mt-4 text-xs text-ink-3">{t('matches.teamStats.fromEvents')}</p>
                          </div>
                        ) : (
                          <EmptyState compact icon={BarChart3} title={t('matches.teamStats.empty')} />
                        )}
                      </CardBody>
                    </Card>
                    {Object.keys(match.player_lines).length > 0 && (
                      <div className="grid gap-4 sm:gap-6 xl:grid-cols-2">
                        <PlayerStatsTable match={match} side="home" />
                        <PlayerStatsTable match={match} side="away" />
                      </div>
                    )}
                  </div>
                )}
              </div>
            </>
          );
        }}
      </DetailGuard>

      {m && (
        <>
          <ScoreModal open={dialog === 'status'} match={m} onClose={close} onSubmit={saveStatus} />
          <EventModal open={dialog === 'event'} match={m} onClose={close} onSubmit={saveEvent} />
          <TeamStatsModal open={dialog === 'stats'} match={m} onClose={close} onSubmit={saveStats} />
        </>
      )}
    </>
  );
}
