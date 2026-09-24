import { Link, useNavigate, useParams } from 'react-router-dom';
import { Activity, CalendarCheck, Clock, Goal, Hash, Home, Mail, Phone, Square, Star, Timer, UserRound } from 'lucide-react';
import ChartCard from '@/components/charts/ChartCard';
import TrendLineChart from '@/components/charts/TrendLineChart';
import BackLink from '@/components/common/BackLink';
import DetailGuard from '@/components/common/DetailGuard';
import MiniStat from '@/components/common/MiniStat';
import ProfileHero from '@/components/common/ProfileHero';
import TeamLogo, { TeamChip } from '@/components/common/TeamLogo';
import Avatar from '@/components/ui/Avatar';
import { StatusBadge } from '@/components/ui/Badge';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { DescriptionList, Meter } from '@/components/ui/Misc';
import { EmptyState } from '@/components/ui/States';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useQuery } from '@/hooks/useQuery';
import { useI18n } from '@/i18n';
import { playerService } from '@/services/playerService';
import { ageFrom, formatDate, formatNumber, formatPercent, formatShortDate } from '@/utils/format';
import { cn } from '@/utils/cn';

function ResultPill({ match, teamId }) {
  const { t } = useI18n();
  const home = match.home_team_id === teamId;
  const gf = home ? match.home_score : match.away_score;
  const ga = home ? match.away_score : match.home_score;
  const r = gf > ga ? 'W' : gf < ga ? 'L' : 'D';
  const tone = { W: 'bg-emerald-600', D: 'bg-slate-400 dark:bg-slate-500', L: 'bg-red-600' }[r];
  return (
    <span className="inline-flex items-center gap-2 tabular">
      <span className={cn('grid size-5 place-items-center rounded text-[10px] font-bold text-white', tone)} title={t(`results.${r}`)}>
        {t(`results.${r}short`)}
      </span>
      <span className="font-medium text-ink">
        {gf}–{ga}
      </span>
    </span>
  );
}

const tel = (v) => v && <a href={`tel:${v.replace(/\s/g, '')}`} className="hover:underline">{v}</a>;

export default function PlayerDetailPage() {
  const { id } = useParams();
  const { t, lang } = useI18n();
  const navigate = useNavigate();
  const query = useQuery(() => playerService.get(id), [id]);
  usePageTitle(query.data?.name ?? t('players.title'));

  return (
    <DetailGuard query={query} entity={t('common.player')} backTo="/coach/players" backLabel={t('players.detail.back')}>
      {(p) => {
        const s = p.statistics ?? {};
        const age = ageFrom(p.date_of_birth);
        const perf = p.performance_trend.map((m) => ({ ...m, label: formatShortDate(m.date, lang) }));
        const att = p.attendance.trend;
        return (
          <>
            <BackLink to="/coach/players">{t('players.detail.back')}</BackLink>
            <ProfileHero
              avatar={
                <div className="relative w-fit">
                  <Avatar name={p.name} src={p.photo} size="2xl" className="ring-4 ring-surface" />
                  {p.jersey_number && (
                    <span className="absolute -bottom-1 -right-1 grid size-10 place-items-center rounded-full bg-brand-600 font-display text-lg font-bold text-white ring-4 ring-surface dark:bg-brand-500 dark:text-brand-950">
                      {p.jersey_number}
                    </span>
                  )}
                </div>
              }
              title={p.name}
              badge={<StatusBadge value={p.status} />}
              meta={
                <>
                  <span>{t(`positions.${p.position}`)}</span>
                  {age !== null && <span>{t('players.detail.age', { count: age })}</span>}
                  <TeamChip team={p.team} />
                </>
              }
            />

            <Card className="mt-4 sm:mt-6">
              <CardHeader title={t('players.detail.statsTitle')} subtitle={t('players.detail.statsSubtitle')} />
              <CardBody className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-8">
                <MiniStat label={t('players.stats.matches')} value={s.matches_played ?? 0} icon={Activity} />
                <MiniStat label={t('players.stats.goals')} value={s.goals ?? 0} icon={Goal} accent="text-emerald-600" />
                <MiniStat label={t('players.stats.assists')} value={s.assists ?? 0} icon={Star} accent="text-sky-600" />
                <MiniStat label={t('players.stats.minutes')} value={formatNumber(s.minutes_played ?? 0, lang)} icon={Timer} />
                <MiniStat label={t('players.stats.yellow')} value={s.yellow_cards ?? 0} icon={Square} accent="fill-amber-400 text-amber-500" />
                <MiniStat label={t('players.stats.red')} value={s.red_cards ?? 0} icon={Square} accent="fill-red-500 text-red-600" />
                <MiniStat label={t('players.stats.rating')} value={s.rating ? s.rating.toFixed(1) : '—'} icon={Star} accent="fill-amber-400 text-amber-500" />
                <MiniStat label={t('players.stats.attendance')} value={p.attendance.rate != null ? formatPercent(p.attendance.rate, lang) : '—'} icon={CalendarCheck} />
              </CardBody>
            </Card>

            <div className="mt-4 grid gap-4 sm:mt-6 sm:gap-6 lg:grid-cols-2">
              <ChartCard
                title={t('players.detail.charts.performance')}
                subtitle={t('players.detail.charts.performanceSub', { count: perf.length })}
                height={220}
                empty={!perf.length}
                table={{
                  columns: [
                    { key: 'date', label: t('common.date') },
                    { key: 'opponent', label: t('players.detail.opponent') },
                    { key: 'rating', label: t('players.detail.charts.rating'), align: 'right' },
                  ],
                  rows: perf.map((m) => ({ date: m.label, opponent: m.opponent?.name, rating: m.rating.toFixed(1) })),
                }}
              >
                <TrendLineChart
                  data={perf}
                  xKey="label"
                  yKey="rating"
                  name={t('players.detail.charts.rating')}
                  domain={[4, 10]}
                  format={(v) => Number(v).toFixed(1)}
                  labelFor={(v) => {
                    const m = perf.find((x) => x.label === v);
                    return m ? `${v} · ${t('matches.vs')} ${m.opponent?.name}` : v;
                  }}
                />
              </ChartCard>
              <ChartCard
                title={t('players.detail.charts.attendance')}
                subtitle={t('players.detail.charts.attendanceSub')}
                height={220}
                empty={!att.length}
                color="var(--chart-3)"
                table={{ columns: [{ key: 'week', label: t('common.date') }, { key: 'rate', label: t('players.detail.charts.rate'), align: 'right' }], rows: att.map((r) => ({ week: formatShortDate(r.week, lang), rate: formatPercent(r.rate, lang) })) }}
              >
                <TrendLineChart
                  data={att}
                  xKey="week"
                  yKey="rate"
                  name={t('players.detail.charts.rate')}
                  domain={[0, 100]}
                  color="var(--chart-3)"
                  format={(v) => `${Math.round(v)}%`}
                  tickFor={(v) => formatShortDate(v, lang)}
                  labelFor={(v) => t('players.detail.charts.week', { date: formatShortDate(v, lang) })}
                />
              </ChartCard>
            </div>

            <div className="mt-4 grid gap-4 sm:mt-6 sm:gap-6 lg:grid-cols-3">
              <div className="space-y-4 sm:space-y-6">
                <Card>
                  <CardHeader title={t('players.detail.profile')} />
                  <CardBody>
                    <DescriptionList
                      items={[
                        { label: t('players.detail.born'), value: p.date_of_birth ? `${formatDate(p.date_of_birth, lang, { day: 'numeric', month: 'long', year: 'numeric' })}${age !== null ? ` (${t('players.detail.age', { count: age })})` : ''}` : null, icon: UserRound },
                        { label: t('players.form.gender'), value: p.gender ? t(`genders.${p.gender}`) : null, icon: UserRound },
                        { label: t('players.form.jersey'), value: p.jersey_number, icon: Hash },
                        { label: t('players.detail.registered'), value: formatDate(p.registration_date, lang), icon: CalendarCheck },
                      ]}
                    />
                  </CardBody>
                </Card>
                <Card>
                  <CardHeader title={t('players.detail.contact')} />
                  <CardBody>
                    <DescriptionList
                      items={[
                        { label: t('players.form.email'), value: <a href={`mailto:${p.email}`} className="hover:underline">{p.email}</a>, icon: Mail },
                        { label: t('players.form.phone'), value: tel(p.phone), icon: Phone },
                        { label: t('players.form.address'), value: p.address, icon: Home },
                      ]}
                    />
                  </CardBody>
                </Card>
                <Card>
                  <CardHeader title={t('players.detail.emergency')} />
                  <CardBody>
                    <DescriptionList
                      items={[
                        { label: t('players.form.emergencyName'), value: p.emergency_contact_name && `${p.emergency_contact_name}${p.emergency_contact_relation ? ` (${t(`relations.${p.emergency_contact_relation}`)})` : ''}`, icon: UserRound },
                        { label: t('players.form.emergencyPhone'), value: tel(p.emergency_contact_phone), icon: Phone },
                      ]}
                    />
                  </CardBody>
                </Card>
              </div>

              <div className="space-y-4 sm:space-y-6 lg:col-span-2">
                <Card>
                  <CardHeader title={t('players.detail.recentMatches')} />
                  {p.recent_matches.length === 0 ? (
                    <EmptyState compact icon={Goal} title={t('players.detail.recentMatchesEmpty')} />
                  ) : (
                    <div className="mt-3 overflow-x-auto scrollbar-thin">
                      <table className="w-full min-w-[560px] text-sm">
                        <thead>
                          <tr className="border-y border-line bg-surface-2/60 text-xs uppercase tracking-wide text-ink-3">
                            <th scope="col" className="py-2.5 pl-5 text-left font-semibold">{t('common.date')}</th>
                            <th scope="col" className="py-2.5 text-left font-semibold">{t('players.detail.opponent')}</th>
                            <th scope="col" className="py-2.5 text-left font-semibold">{t('players.detail.result')}</th>
                            <th scope="col" className="py-2.5 text-right font-semibold">{t('players.detail.minutes')}</th>
                            <th scope="col" className="py-2.5 text-right font-semibold" title={t('players.stats.goals')}>{t('dashboard.topPlayers.goals')}</th>
                            <th scope="col" className="py-2.5 text-right font-semibold" title={t('players.stats.assists')}>{t('dashboard.topPlayers.assists')}</th>
                            <th scope="col" className="py-2.5 pr-5 text-right font-semibold">{t('players.detail.rating')}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {p.recent_matches.map(({ match, line }) => {
                            const home = match.home_team_id === line.team_id;
                            const opp = home ? match.away_team : match.home_team;
                            return (
                              <tr key={match.id} className="cursor-pointer border-b border-line last:border-0 hover:bg-surface-2" onClick={() => navigate(`/coach/matches/${match.id}`)}>
                                <td className="py-3 pl-5 tabular text-ink-2">{formatShortDate(match.date, lang)}</td>
                                <td className="py-3">
                                  <span className="inline-flex items-center gap-2">
                                    <span className="w-4 text-xs text-ink-3">{home ? t('players.detail.home') : t('players.detail.away')}</span>
                                    <TeamLogo team={opp} size="xs" />
                                    <span className="text-ink">{opp?.name}</span>
                                  </span>
                                </td>
                                <td className="py-3">
                                  <ResultPill match={match} teamId={line.team_id} />
                                </td>
                                <td className="py-3 text-right tabular text-ink-2">{line.minutes}'</td>
                                <td className="py-3 text-right font-semibold tabular text-ink">{line.goals || '·'}</td>
                                <td className="py-3 text-right tabular text-ink-2">{line.assists || '·'}</td>
                                <td className="py-3 pr-5 text-right font-semibold tabular text-ink">{line.rating.toFixed(1)}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </Card>

                <Card>
                  <CardHeader title={t('players.detail.attendance')} />
                  {p.attendance.total === 0 ? (
                    <EmptyState compact icon={CalendarCheck} title={t('players.detail.attendanceEmpty')} />
                  ) : (
                    <CardBody className="grid gap-6 md:grid-cols-2">
                      <div>
                        <p className="font-display text-5xl font-bold text-ink">{formatPercent(p.attendance.rate, lang)}</p>
                        <Meter value={p.attendance.rate} className="mt-3" label={t('players.stats.attendance')} />
                        <dl className="mt-5 grid grid-cols-2 gap-3">
                          {['present', 'late', 'excused', 'absent'].map((k) => (
                            <div key={k} className="rounded-lg bg-surface-2 px-3 py-2">
                              <dt className="text-xs text-ink-3">{t(`status.${k}`)}</dt>
                              <dd className="text-lg font-semibold text-ink tabular">{p.attendance[k]}</dd>
                            </div>
                          ))}
                        </dl>
                      </div>
                      <div>
                        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-3">{t('players.detail.recentSessions')}</p>
                        <ul className="divide-y divide-line">
                          {p.attendance.recent.map((r) => (
                            <li key={r.id}>
                              <Link to={`/coach/training/${r.session_id}`} className="flex items-center justify-between gap-3 py-2.5 hover:opacity-80">
                                <span className="min-w-0">
                                  <span className="block text-sm text-ink">{t(`trainingTypes.${r.training_type}`)}</span>
                                  <span className="flex items-center gap-1 truncate text-xs text-ink-3">
                                    <Clock className="size-3 shrink-0" aria-hidden="true" />
                                    {formatDate(r.date, lang, { weekday: 'short', day: 'numeric', month: 'short' })}
                                    {r.notes && ` · ${r.notes}`}
                                  </span>
                                </span>
                                <StatusBadge value={r.status} />
                              </Link>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </CardBody>
                  )}
                </Card>
              </div>
            </div>
          </>
        );
      }}
    </DetailGuard>
  );
}
