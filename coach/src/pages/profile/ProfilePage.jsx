import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Award, CalendarCheck, Clock, Mail, Pencil, Phone, ShieldCheck, Timer, Users } from 'lucide-react';
import DetailGuard from '@/components/common/DetailGuard';
import ProfileHero from '@/components/common/ProfileHero';
import TeamLogo from '@/components/common/TeamLogo';
import Avatar from '@/components/ui/Avatar';
import Badge, { StatusBadge } from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Input } from '@/components/ui/Field';
import { DescriptionList } from '@/components/ui/Misc';
import Modal from '@/components/ui/Modal';
import PhotoUpload from '@/components/ui/PhotoUpload';
import { EmptyState } from '@/components/ui/States';
import { useAction } from '@/hooks/useAction';
import { useAuth } from '@/hooks/useAuth';
import { useForm } from '@/hooks/useForm';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useQuery } from '@/hooks/useQuery';
import { useI18n } from '@/i18n';
import { profileService } from '@/services/profileService';
import { formatDate, formatRelative } from '@/utils/format';
import { maxLength, minLength, phone, required } from '@/utils/validators';

function EditProfileModal({ open, profile, onClose, onSaved }) {
  const { t } = useI18n();
  const run = useAction();
  const form = useForm({
    initial: { name: '', phone: '', photo: null },
    schema: { name: [required, minLength(3), maxLength(80)], phone: [required, phone] },
    onSubmit: async (values) => {
      await run(() => profileService.update(values), { success: 'profile.saved' });
      onSaved();
    },
  });
  const { reset } = form;
  useEffect(() => {
    if (open && profile) reset({ name: profile.name, phone: profile.phone, photo: profile.photo });
  }, [open, profile, reset]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('profile.editTitle')}
      description={t('profile.editDescription')}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} className="w-full sm:w-auto">
            {t('common.cancel')}
          </Button>
          <Button type="submit" form="profile-form" loading={form.submitting} className="w-full sm:w-auto">
            {t('profile.save')}
          </Button>
        </>
      }
    >
      <form id="profile-form" ref={form.formRef} onSubmit={form.handleSubmit} noValidate className="grid gap-4">
        <PhotoUpload label={t('profile.photo')} name={form.values.name} value={form.values.photo} onChange={(v) => form.setValue('photo', v)} />
        <Input label={t('profile.name')} required autoComplete="name" {...form.field('name')} />
        <Input label={t('profile.phone')} type="tel" inputMode="tel" required autoComplete="tel" {...form.field('phone')} />
      </form>
    </Modal>
  );
}

export default function ProfilePage() {
  const { t, lang } = useI18n();
  usePageTitle(t('profile.title'));
  const { refreshUser } = useAuth();
  const query = useQuery(() => profileService.get(), []);
  const [editing, setEditing] = useState(false);

  return (
    <>
      <DetailGuard query={query} entity={t('profile.title')} backTo="/coach/dashboard" backLabel={t('nav.dashboard')}>
        {(p) => (
          <>
            <ProfileHero
              avatar={<Avatar name={p.name} src={p.photo} size="2xl" className="ring-4 ring-surface" />}
              title={p.name}
              badge={<StatusBadge value={p.account_status} />}
              meta={
                <>
                  <Badge tone="brand">{t('roles.coach')}</Badge>
                  <span className="inline-flex items-center gap-1.5">
                    <Award className="size-4 text-amber-500" aria-hidden="true" />
                    {p.license}
                  </span>
                  <span>{t('common.years', { count: p.experience })}</span>
                </>
              }
              actions={
                <Button variant="secondary" icon={Pencil} onClick={() => setEditing(true)} className="flex-1 sm:flex-none">
                  {t('profile.edit')}
                </Button>
              }
            />
            <div className="mt-4 grid gap-4 sm:mt-6 sm:gap-6 lg:grid-cols-3">
              <Card>
                <CardHeader title={t('profile.contact')} />
                <CardBody>
                  <DescriptionList
                    items={[
                      { label: t('profile.email'), value: p.email, icon: Mail },
                      { label: t('profile.phone'), value: p.phone, icon: Phone },
                      { label: t('profile.memberSince'), value: formatDate(p.member_since, lang), icon: CalendarCheck },
                      { label: t('profile.lastLogin'), value: p.last_login_at ? formatRelative(p.last_login_at, lang) : '—', icon: Clock },
                    ]}
                  />
                </CardBody>
              </Card>
              <Card>
                <CardHeader title={t('profile.coaching')} />
                <CardBody>
                  <DescriptionList
                    items={[
                      { label: t('profile.license'), value: p.license, icon: Award },
                      { label: t('profile.experience'), value: t('common.years', { count: p.experience }), icon: Timer },
                      { label: t('profile.status'), value: <StatusBadge value={p.account_status} />, icon: ShieldCheck },
                    ]}
                  />
                  <p className="mt-4 text-xs text-ink-3">{t('profile.managedByFederation')}</p>
                </CardBody>
              </Card>
              <Card>
                <CardHeader title={t('profile.teams')} icon={Users} />
                <CardBody className="space-y-2">
                  {p.teams.length === 0 ? (
                    <EmptyState compact icon={Users} title={t('profile.teamsEmpty')} />
                  ) : (
                    p.teams.map((tm) => (
                      <Link key={tm.id} to={`/coach/teams/${tm.id}`} className="flex items-center gap-3 rounded-xl border border-line p-3 hover:bg-surface-2">
                        <TeamLogo team={tm} size="md" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-medium text-ink">{tm.name}</span>
                          <span className="block text-xs text-ink-3">
                            {t(`categories.${tm.category}`)} · {t(`ageGroups.${tm.age_group}`)} · {t('common.playersCount', { count: tm.players_count })}
                          </span>
                        </span>
                      </Link>
                    ))
                  )}
                </CardBody>
              </Card>
            </div>
          </>
        )}
      </DetailGuard>
      <EditProfileModal
        open={editing}
        profile={query.data}
        onClose={() => setEditing(false)}
        onSaved={() => {
          setEditing(false);
          refreshUser();
          query.refetch();
        }}
      />
    </>
  );
}
