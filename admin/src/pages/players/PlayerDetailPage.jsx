import { Link, useNavigate, useParams } from 'react-router-dom';
import { Activity, CalendarCheck, Clock, Goal, Hash, Home, Mail, Pencil, Phone, Square, Star, Timer, UserRound } from 'lucide-react';
import BackLink from '@/components/common/BackLink';
import DetailGuard from '@/components/common/DetailGuard';
import MiniStat from '@/components/common/MiniStat';
import ProfileHero from '@/components/common/ProfileHero';
import RowActions from '@/components/common/RowActions';
import TeamLogo, { TeamChip } from '@/components/common/TeamLogo';
import Avatar from '@/components/ui/Avatar';
import { StatusBadge } from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { DescriptionList, Meter } from '@/components/ui/Misc';
import { EmptyState } from '@/components/ui/States';
import { useTeamOptions } from '@/hooks/useOptions';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useQuery } from '@/hooks/useQuery';
import { useI18n } from '@/i18n';
import { playerService } from '@/services/playerService';
import { ageFrom, formatDate, formatNumber, formatPercent, formatShortDate } from '@/utils/format';
import { cn } from '@/utils/cn';
import { usePlayerActions } from './usePlayerActions';

function ResultPill({ match, teamId }) {
  const { t } = useI18n();
  const home = match.home_team_id === teamId;
  const gf = home ? match.home_score : match.away_score;
  const ga = home ? match.away_score : match.home_score;
  const r = gf > ga ? 'W' : gf < ga ? 'L' : 'D';
  const tone = { W: 'bg-emerald-500', D: 'bg-slate-400 dark:bg-slate-500', L: 'bg-red-500' }[r];
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

export default function PlayerDetailPage() {
  const { id } = useParams();
  const { t, lang } = useI18n();
  const navigate = useNavigate();
  const { teams } = useTeamOptions();
  const query = useQuery(() => playerService.get(id), [id]);
  usePageTitle(query.data?.name ?? t('players.title'));
  const { actionsFor, modals, openEdit } = usePlayerActions({
    teams,
    onChanged: query.refetch,
    onDeleted: () => navigate('/admin/players', { replace: true }),
    showView: false,
  });

  return (
    <>
      <DetailGuard query={query} entity={t('common.player')} backTo="/admin/players" backLabel={t('players.detail.back')}>
        {(p) => {
          const s = p.statistics ?? {};
          const age = ageFrom(p.date_of_birth);
          return (
            <>
              <BackLink to="/admin/players">{t('players.detail.back')}</BackLink>

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
                    {p.team ? <TeamChip team={p.team} /> : <span className="text-ink-3">{t('players.noTeam')}</span>}
                  </>
                }
                actions={
                  <>
                    <Button variant="secondary" icon={Pencil} onClick={() => openEdit(p)} className="flex-1 sm:flex-none">
                      {t('common.edit')}
                    </Button>
                    <div className="rounded-xl border border-line-strong">
                      <RowActions items={actionsFor(p)} />
                    </div>
                  </>
                }
              />

              <div className="mt-4 grid gap-4 sm:mt-6 sm:gap-6 lg:grid-cols-3">
                <div className="space-y-4 sm:space-y-6">
                  <Card>
                    <CardHeader title={t('players.detail.profile')} />
                    <CardBody>
                      <DescriptionList
                        items={[
                          { label: t('players.detail.born'), value: p.date_of_birth ? formatDate(p.date_of_birth, lang, { day: 'numeric', month: 'long', year: 'numeric' }) : null, icon: UserRound },
                          { label: t('players.form.gender'), value: p.gender ? t(`genders.${p.gender}`) : null, icon: UserRound },
                          { label: t('players.form.jersey'), value: p.jersey_number, icon: Hash },
                          { label: t('players.detail.registered'), value: formatDate(p.registration_date, lang), icon: CalendarCheck },
                          { label: t('players.detail.coach'), value: p.coach ? <Link className="hover:underline" to={`/admin/coaches/${p.coach.id}`}>{p.coach.name}</Link> : null, icon: Activity },
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
                          { label: t('players.form.phone'), value: p.phone && <a href={`tel:${p.phone.replace(/\s/g, '')}`} className="hover:underline">{p.phone}</a>, icon: Phone },
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
                          { label: t('players.form.emergencyPhone'), value: p.emergency_contact_phone && <a href={`tel:${p.emergency_contact_phone.replace(/\s/g, '')}`} className="hover:underline">{p.emergency_contact_phone}</a>, icon: Phone },
                        ]}
                      />
                    </CardBody>
                  </Card>
                </div>

                <div className="space-y-4 sm:space-y-6 lg:col-span-2">
                  <Card>
                    <CardHeader title={t('players.detail.statsTitle')} subtitle={t('players.detail.statsSubtitle')} />
                    <CardBody className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                      <MiniStat label={t('players.stats.matches')} value={s.matches_played ?? 0} icon={Activity} />
                      <MiniStat label={t('players.stats.goals')} value={s.goals ?? 0} icon={Goal} accent="text-emerald-600" />
                      <MiniStat label={t('players.stats.assists')} value={s.assists ?? 0} icon={Star} accent="text-sky-600" />
                      <MiniStat label={t('players.stats.minutes')} value={formatNumber(s.minutes_played ?? 0, lang)} icon={Timer} />
                      <MiniStat label={t('players.stats.yellow')} value={s.yellow_cards ?? 0} icon={Square} accent="fill-amber-400 text-amber-500" />
                      <MiniStat label={t('players.stats.red')} value={s.red_cards ?? 0} icon={Square} accent="fill-red-500 text-red-600" />
                      <MiniStat label={t('players.stats.rating')} value={s.rating ? s.rating.toFixed(1) : '—'} icon={Star} accent="fill-amber-400 text-amber-500" />
                      <MiniStat label={t('players.stats.attendance')} value={p.attendance.rate !== null ? formatPercent(p.attendance.rate, lang) : '—'} icon={CalendarCheck} />
                    </CardBody>
                  </Card>

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
                              const home = match.home_team_id === p.team_id;
                              const opp = home ? match.away_team : match.home_team;
                              return (
                                <tr key={match.id} className="cursor-pointer border-b border-line last:border-0 hover:bg-surface-2" onClick={() => navigate(`/admin/matches/${match.id}`)}>
                                  <td className="py-3 pl-5 tabular text-ink-2">{formatShortDate(match.date, lang)}</td>
                                  <td className="py-3">
                                    <span className="inline-flex items-center gap-2">
                                      <span className="w-4 text-xs text-ink-3">{home ? t('players.detail.home') : t('players.detail.away')}</span>
                                      <TeamLogo team={opp} size="xs" />
                                      <span className="text-ink">{opp?.name}</span>
                                    </span>
                                  </td>
                                  <td className="py-3">
                                    <ResultPill match={match} teamId={p.team_id} />
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
                                <Link to={`/admin/training/${r.session_id}`} className="flex items-center justify-between gap-3 py-2.5 hover:opacity-80">
                                  <span className="min-w-0">
                                    <span className="block text-sm text-ink">{t(`trainingTypes.${r.training_type}`)}</span>
                                    <span className="flex items-center gap-1 text-xs text-ink-3">
                                      <Clock className="size-3" aria-hidden="true" />
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
      {modals}
    </>
  );
}
