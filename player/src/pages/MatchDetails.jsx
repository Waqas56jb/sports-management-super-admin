import { Link, useParams } from 'react-router-dom';
import { BarChart3, CalendarDays, ClipboardList, Clock, Goal, MapPin, Shirt, Trophy, UserRound } from 'lucide-react';
import BackLink from '@/components/common/BackLink';
import DetailGuard from '@/components/common/DetailGuard';
import TeamLogo from '@/components/common/TeamLogo';
import MyPerformance from '@/components/matches/MyPerformance';
import PitchView from '@/components/matches/PitchView';
import Scoreboard from '@/components/matches/Scoreboard';
import { statRows, TeamStatsComparison } from '@/components/matches/TeamStats';
import Timeline from '@/components/matches/Timeline';
import Badge, { StatusBadge } from '@/components/ui/Badge';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { DescriptionList } from '@/components/ui/Misc';
import { EmptyState } from '@/components/ui/States';
import Tabs from '@/components/ui/Tabs';
import { useListParams } from '@/hooks/useListParams';
import { useMatch } from '@/hooks/useMatches';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useI18n } from '@/i18n';
import { formatLongDate, formatTime } from '@/utils/formatters';
import { cn } from '@/utils/cn';

const TABS = ['overview', 'lineup', 'events', 'statistics'];

function LineupCard({ match, side }) {
  const { t } = useI18n();
  const team = side === 'home' ? match.home_team : match.away_team;
  const lineup = match.lineups?.[side];
  const mine = match.my_side === side;
  return (
    <Card className={cn(mine && 'ring-2 ring-brand-500/30')}>
      <CardHeader
        title={
          <span className="flex items-center gap-2">
            <TeamLogo team={team} size="sm" />
            {team?.name}
          </span>
        }
        subtitle={lineup ? `${t('matches.lineup.formation')} ${lineup.formation}` : undefined}
      />
      <CardBody>
        {!lineup ? (
          <EmptyState compact icon={ClipboardList} title={t('matches.lineup.notSet')} />
        ) : (
          <div className="space-y-4">
            <PitchView formation={lineup.formation} starters={lineup.starting} team={team} />
            {lineup.substitutes.length > 0 && (
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-3">{t('matches.lineup.substitutes')}</p>
                <ul className="flex flex-wrap gap-1.5">
                  {lineup.substitutes.map((p) => (
                    <li key={p.id} className={cn('inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs', p.is_me ? 'bg-amber-100 font-semibold text-amber-900 dark:bg-amber-500/20 dark:text-amber-200' : 'bg-surface-3 text-ink-2')}>
                      <span className="font-semibold tabular">{p.jersey_number ?? '–'}</span>
                      {p.name}
                      {p.is_me && ` · ${t('matches.you')}`}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </CardBody>
    </Card>
  );
}

export default function MatchDetails() {
  const { id } = useParams();
  const { t, lang } = useI18n();
  const query = useMatch(id);
  const m = query.data;
  const { params, set } = useListParams({ tab: 'overview' });
  const tab = TABS.includes(params.tab) ? params.tab : 'overview';
  usePageTitle(m ? `${m.home_team?.short_name} ${m.home_score ?? ''}${m.home_score !== null ? '–' : 'v'}${m.away_score ?? ''} ${m.away_team?.short_name}` : t('matches.title'));

  return (
    <DetailGuard query={query} entity={t('calendar.kinds.match')} backTo="/player/matches" backLabel={t('matches.centre.back')}>
      {(match) => {
        const rows = statRows(match);
        const played = match.status === 'completed' || match.status === 'live';
        const selection = match.my_selection ?? 'pending';
        const myTeamScore = match.my_side === 'home' ? match.home_score : match.away_score;
        const oppScore = match.my_side === 'home' ? match.away_score : match.home_score;
        const result = played && match.status === 'completed' ? (myTeamScore > oppScore ? 'W' : myTeamScore < oppScore ? 'L' : 'D') : null;
        return (
          <>
            <BackLink to="/player/matches">{t('matches.centre.back')}</BackLink>
            <Scoreboard match={match} />
            <Tabs
              className="mt-5"
              label={t('matches.title')}
              value={tab}
              onChange={(v) => set({ tab: v })}
              tabs={TABS.map((k) => ({ value: k, label: t(`matches.centreTabs.${k}`), count: k === 'events' ? match.events.length : undefined }))}
            />
            <div className="mt-4" role="tabpanel">
              {tab === 'overview' && (
                <div className="space-y-4 sm:space-y-6">
                  <div className="grid gap-4 sm:gap-6 lg:grid-cols-2">
                    <Card>
                      <CardHeader title={t('matches.overview.details')} />
                      <CardBody>
                        <DescriptionList
                          columns={2}
                          items={[
                            { label: t('common.competition'), icon: Trophy, value: match.competition ? <Link to={`/player/competitions/${match.competition.id}`} className="hover:underline">{match.competition.name} {match.competition.season}</Link> : t('matches.friendly') },
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
                      <CardHeader title={t('matches.participation.title')} icon={Shirt} />
                      <CardBody className="space-y-4">
                        {result && (
                          <div className="flex items-center justify-between rounded-xl bg-surface-2 px-4 py-3">
                            <span className="text-sm text-ink-2">{t('matches.participation.finalResult')}</span>
                            <span className="flex items-center gap-2">
                              <Badge tone={result === 'W' ? 'success' : result === 'L' ? 'danger' : 'neutral'}>{t(`results.${result}`)}</Badge>
                              <span className="font-display text-2xl font-bold text-ink tabular">
                                {match.home_score}–{match.away_score}
                              </span>
                            </span>
                          </div>
                        )}
                        <div className="flex items-center justify-between rounded-xl bg-surface-2 px-4 py-3">
                          <span className="text-sm text-ink-2">{t('matches.participation.title')}</span>
                          <Badge tone={selection === 'starting' ? 'brand' : selection === 'substitute' ? 'info' : 'neutral'}>{t(`matches.participation.${selection}`)}</Badge>
                        </div>
                        {match.my_performance && (
                          <dl className="grid grid-cols-4 gap-2 text-center">
                            {[
                              ['minutes', `${match.my_performance.minutes}'`],
                              ['goals', match.my_performance.goals],
                              ['assists', match.my_performance.assists],
                              ['rating', match.my_performance.rating.toFixed(1)],
                            ].map(([k, v]) => (
                              <div key={k} className="rounded-xl border border-line py-2">
                                <dt className="truncate px-1 text-[11px] text-ink-3">{t(`matches.myPerformance.${k}`)}</dt>
                                <dd className="font-display text-xl font-bold text-ink tabular">{v}</dd>
                              </div>
                            ))}
                          </dl>
                        )}
                      </CardBody>
                    </Card>
                  </div>
                  {played && <MyPerformance line={match.my_performance} />}
                </div>
              )}

              {tab === 'lineup' &&
                (match.status === 'cancelled' ? (
                  <div className="card">
                    <EmptyState compact icon={ClipboardList} title={t('matches.centre.cancelledNote')} />
                  </div>
                ) : (
                  <div className="grid gap-4 sm:gap-6 lg:grid-cols-2">
                    <LineupCard match={match} side="home" />
                    <LineupCard match={match} side="away" />
                  </div>
                ))}

              {tab === 'events' && (
                <Card>
                  <CardHeader title={t('matches.centre.timeline')} />
                  <CardBody>
                    <Timeline match={match} />
                  </CardBody>
                </Card>
              )}

              {tab === 'statistics' && (
                <div className="space-y-4 sm:space-y-6">
                  <Card>
                    <CardHeader title={t('matches.teamStats.title')} icon={BarChart3} />
                    <CardBody>
                      {rows.length ? (
                        <div className="mx-auto max-w-2xl">
                          <TeamStatsComparison match={match} rows={rows} />
                        </div>
                      ) : (
                        <EmptyState compact icon={BarChart3} title={t('matches.teamStats.empty')} />
                      )}
                    </CardBody>
                  </Card>
                  {played && <MyPerformance line={match.my_performance} />}
                </div>
              )}
            </div>
          </>
        );
      }}
    </DetailGuard>
  );
}
