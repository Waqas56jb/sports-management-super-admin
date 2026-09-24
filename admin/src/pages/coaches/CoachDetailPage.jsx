import { useNavigate, useParams } from 'react-router-dom';
import { Award, CalendarCheck, Clock, Dumbbell, Mail, Pencil, Phone, Shield, Users } from 'lucide-react';
import BackLink from '@/components/common/BackLink';
import DetailGuard from '@/components/common/DetailGuard';
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
import { useTeamOptions } from '@/hooks/useOptions';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useQuery } from '@/hooks/useQuery';
import { useI18n } from '@/i18n';
import { coachService } from '@/services/coachService';
import { formatDate, formatPercent, formatRelative } from '@/utils/format';
import { useCoachActions } from './useCoachActions';

export default function CoachDetailPage() {
  const { id } = useParams();
  const { t, lang } = useI18n();
  const navigate = useNavigate();
  const { teams } = useTeamOptions();
  const query = useQuery(() => coachService.get(id), [id]);
  usePageTitle(query.data?.name ?? t('coaches.title'));
  const { actionsFor, modals, openEdit, openAssign } = useCoachActions({
    teams,
    onChanged: query.refetch,
    onDeleted: () => navigate('/admin/coaches', { replace: true }),
    showView: false,
  });
  const resultLabels = { W: t('results.W'), D: t('results.D'), L: t('results.L'), Wshort: t('results.Wshort'), Dshort: t('results.Dshort'), Lshort: t('results.Lshort') };

  return (
    <>
      <DetailGuard query={query} entity={t('status.coach')} backTo="/admin/coaches" backLabel={t('coaches.detail.back')}>
        {(c) => (
          <>
            <BackLink to="/admin/coaches">{t('coaches.detail.back')}</BackLink>
            <ProfileHero
              avatar={<Avatar name={c.name} src={c.photo} size="2xl" className="ring-4 ring-surface" />}
              title={c.name}
              badge={<StatusBadge value={c.status} />}
              meta={
                <>
                  <span className="inline-flex items-center gap-1.5">
                    <Award className="size-4 text-amber-500" aria-hidden="true" />
                    {c.license || '—'}
                  </span>
                  <span>{t('coaches.experience', { count: c.experience })}</span>
                </>
              }
              actions={
                <>
                  <Button variant="secondary" icon={Pencil} onClick={() => openEdit(c)} className="flex-1 sm:flex-none">
                    {t('common.edit')}
                  </Button>
                  <div className="rounded-xl border border-line-strong">
                    <RowActions items={actionsFor(c)} />
                  </div>
                </>
              }
            />

            <div className="mt-4 grid gap-4 sm:mt-6 sm:gap-6 lg:grid-cols-3">
              <div className="space-y-4 sm:space-y-6">
                <Card>
                  <CardHeader title={t('coaches.detail.contact')} />
                  <CardBody>
                    <DescriptionList
                      items={[
                        { label: t('coaches.form.email'), value: <a href={`mailto:${c.email}`} className="hover:underline">{c.email}</a>, icon: Mail },
                        { label: t('coaches.form.phone'), value: c.phone && <a href={`tel:${c.phone.replace(/\s/g, '')}`} className="hover:underline">{c.phone}</a>, icon: Phone },
                        { label: t('coaches.detail.memberSince'), value: formatDate(c.created_at, lang), icon: CalendarCheck },
                        { label: t('coaches.detail.lastLogin'), value: c.last_login_at ? formatRelative(c.last_login_at, lang) : t('users.never'), icon: Clock },
                      ]}
                    />
                  </CardBody>
                </Card>
                <Card>
                  <CardHeader title={t('coaches.detail.teamTitle')} />
                  <CardBody>
                    {c.team ? (
                      <button type="button" onClick={() => navigate(`/admin/teams/${c.team.id}`)} className="flex w-full items-center gap-4 rounded-xl border border-line p-3 text-left hover:bg-surface-2">
                        <TeamLogo team={c.team} size="lg" />
                        <span className="min-w-0">
                          <span className="block truncate font-semibold text-ink">{c.team.name}</span>
                          <span className="block text-sm text-ink-3">{t('common.playersCount', { count: c.players_count })}</span>
                          {c.record?.form?.length > 0 && (
                            <span className="mt-1.5 block">
                              <FormGuide form={c.record.form} labels={resultLabels} />
                            </span>
                          )}
                        </span>
                      </button>
                    ) : (
                      <EmptyState compact icon={Shield} title={t('coaches.detail.noTeam')} action={<Button variant="secondary" size="sm" onClick={() => openAssign(c)}>{t('coaches.detail.assignNow')}</Button>} />
                    )}
                  </CardBody>
                </Card>
              </div>

              <div className="space-y-4 sm:space-y-6 lg:col-span-2">
                <Card>
                  <CardBody className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <MiniStat label={t('coaches.detail.sessions')} value={c.sessions_total} icon={Dumbbell} />
                    <MiniStat label={t('coaches.detail.completed')} value={c.sessions_completed} icon={CalendarCheck} />
                    <MiniStat label={t('coaches.detail.squad')} value={c.players_count} icon={Users} />
                    <MiniStat label={t('coaches.detail.attendance')} value={c.attendance?.rate != null ? formatPercent(c.attendance.rate, lang) : '—'} icon={CalendarCheck} />
                  </CardBody>
                  {c.attendance?.rate != null && (
                    <div className="px-4 pb-5 sm:px-5">
                      <Meter value={c.attendance.rate} label={t('coaches.detail.attendance')} />
                    </div>
                  )}
                </Card>
                {c.record && (
                  <Card>
                    <CardHeader title={t('coaches.detail.record')} />
                    <CardBody className="grid grid-cols-3 gap-3 sm:grid-cols-6">
                      <MiniStat label={t('competitions.standings.played')} value={c.record.played} />
                      <MiniStat label={t('results.W')} value={c.record.won} />
                      <MiniStat label={t('results.D')} value={c.record.drawn} />
                      <MiniStat label={t('results.L')} value={c.record.lost} />
                      <MiniStat label={t('competitions.standings.goalsFor')} value={c.record.goals_for} />
                      <MiniStat label={t('competitions.standings.goalsAgainst')} value={c.record.goals_against} />
                    </CardBody>
                  </Card>
                )}
                <Card>
                  <CardHeader title={t('coaches.detail.upcoming')} />
                  <div className="px-1.5 pb-2 pt-2 sm:px-2">
                    {c.upcoming_sessions.length ? c.upcoming_sessions.map((s) => <SessionRow key={s.id} session={s} showTeam={false} />) : <EmptyState compact icon={Dumbbell} title={t('coaches.detail.upcomingEmpty')} />}
                  </div>
                </Card>
              </div>
            </div>
          </>
        )}
      </DetailGuard>
      {modals}
    </>
  );
}
