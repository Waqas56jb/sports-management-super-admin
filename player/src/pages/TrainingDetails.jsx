import { useParams } from 'react-router-dom';
import { Ban, CalendarCheck, CalendarDays, CheckCircle2, Clock, Dumbbell, MapPin, MessageSquareText, Target, UserRound, Users } from 'lucide-react';
import BackLink from '@/components/common/BackLink';
import DetailGuard from '@/components/common/DetailGuard';
import ProfileHero from '@/components/common/ProfileHero';
import TeamLogo from '@/components/common/TeamLogo';
import TrainingTypeBadge from '@/components/common/TrainingTypeBadge';
import { StatusBadge } from '@/components/ui/Badge';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { DescriptionList } from '@/components/ui/Misc';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useTrainingSession } from '@/hooks/useTraining';
import { useI18n } from '@/i18n';
import { durationMinutes, formatLongDate, formatTime } from '@/utils/formatters';
import { cn } from '@/utils/cn';

const ATTENDANCE_STYLE = {
  present: 'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200',
  late: 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200',
  excused: 'border-sky-200 bg-sky-50 text-sky-900 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-200',
  absent: 'border-red-200 bg-red-50 text-red-900 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200',
  pending: 'border-line bg-surface-2 text-ink-2',
};

export default function TrainingDetails() {
  const { id } = useParams();
  const { t, lang } = useI18n();
  const query = useTrainingSession(id);
  const s = query.data;
  usePageTitle(s ? t(`training.titles.${s.training_type}`) : t('training.title'));

  return (
    <DetailGuard query={query} entity={t('calendar.kinds.training')} backTo="/player/training" backLabel={t('training.detail.back')}>
      {(session) => {
        const cancelled = session.status === 'cancelled';
        const att = session.my_attendance;
        const plan = session.description_key ? t(`training.plans.${session.description_key}`) : session.description;
        return (
          <>
            <BackLink to="/player/training">{t('training.detail.back')}</BackLink>
            <ProfileHero
              avatar={
                <span className="grid size-24 place-items-center rounded-2xl bg-surface p-3 shadow-(--shadow-card) ring-4 ring-surface sm:size-28">
                  <TeamLogo team={session.team} size="2xl" className="size-full" />
                </span>
              }
              title={t(`training.titles.${session.training_type}`)}
              badge={cancelled ? <StatusBadge value="cancelled" /> : <TrainingTypeBadge type={session.training_type} />}
              meta={
                <>
                  <span className="inline-flex items-center gap-1 capitalize">
                    <CalendarDays className="size-3.5" aria-hidden="true" />
                    {formatLongDate(session.date, lang)}
                  </span>
                  <span className="inline-flex items-center gap-1 tabular">
                    <Clock className="size-3.5" aria-hidden="true" />
                    {formatTime(session.start_time)}–{formatTime(session.end_time)} ({t('training.detail.duration', { count: durationMinutes(session.start_time, session.end_time) })})
                  </span>
                </>
              }
            >
              {cancelled && (
                <div role="status" className="flex items-start gap-3 border-t border-line bg-red-50 px-4 py-3 text-sm text-red-800 dark:bg-red-500/10 dark:text-red-200 sm:px-6">
                  <Ban className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                  <span>
                    {t('training.detail.cancelledBanner')}
                    {session.cancellation_key && ` ${t('training.detail.reason', { reason: t(`training.cancelReasons.${session.cancellation_key}`) })}`}
                  </span>
                </div>
              )}
            </ProfileHero>

            <div className="mt-4 grid gap-4 sm:mt-6 sm:gap-6 lg:grid-cols-3">
              <div className="space-y-4 sm:space-y-6 lg:col-span-2">
                <Card>
                  <CardHeader title={t('training.detail.description')} icon={Dumbbell} />
                  <CardBody className="space-y-5">
                    <p className="text-sm leading-relaxed text-ink-2">{plan}</p>
                    {session.objectives?.length > 0 && (
                      <div>
                        <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-ink-3">
                          <Target className="size-3.5" aria-hidden="true" />
                          {t('training.detail.objectives')}
                        </p>
                        <ul className="space-y-2">
                          {session.objectives.map((o) => (
                            <li key={o} className="flex items-start gap-2 text-sm text-ink">
                              <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-brand-600 dark:text-brand-400" aria-hidden="true" />
                              {t(`training.objectives.${o}`)}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </CardBody>
                </Card>
                <Card>
                  <CardHeader title={t('training.detail.notes')} icon={MessageSquareText} />
                  <CardBody>
                    <p className={cn('text-sm', session.player_note ? 'text-ink' : 'text-ink-3')}>{session.player_note ? t(`training.notes.${session.player_note}`) : t('training.detail.noNotes')}</p>
                  </CardBody>
                </Card>
              </div>
              <div className="space-y-4 sm:space-y-6">
                {!cancelled && att && (
                  <section aria-label={t('training.detail.myAttendance')} className={cn('rounded-(--radius-card) border p-5', ATTENDANCE_STYLE[att.status])}>
                    <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide opacity-80">
                      <CalendarCheck className="size-4" aria-hidden="true" />
                      {t('training.detail.myAttendance')}
                    </p>
                    <div className="mt-3 flex items-center gap-3">
                      <StatusBadge value={att.status} />
                    </div>
                    <p className="mt-2 text-sm">{t(`training.detail.attendanceHint.${att.status}`)}</p>
                    {att.notes && <p className="mt-1 text-sm opacity-80">{att.notes}</p>}
                  </section>
                )}
                <Card>
                  <CardBody>
                    <DescriptionList
                      items={[
                        { label: t('training.detail.team'), value: session.team?.name, icon: Users },
                        { label: t('training.detail.coach'), value: session.coach_name, icon: UserRound },
                        { label: t('training.detail.location'), value: session.location, icon: MapPin },
                      ]}
                    />
                  </CardBody>
                </Card>
              </div>
            </div>
          </>
        );
      }}
    </DetailGuard>
  );
}
