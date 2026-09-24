import { useState } from 'react';
import { BadgeCheck, CalendarCheck, Cake, Eye, EyeOff, Flag, Footprints, Hash, Home, IdCard, Mail, Pencil, Phone, Ruler, Shield, Shirt, UserRound, Weight } from 'lucide-react';
import DetailGuard from '@/components/common/DetailGuard';
import ProfileHero from '@/components/common/ProfileHero';
import { TeamChip } from '@/components/common/TeamLogo';
import EditProfileModal from '@/components/profile/EditProfileModal';
import Avatar from '@/components/ui/Avatar';
import Badge, { StatusBadge } from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { DescriptionList } from '@/components/ui/Misc';
import { useAction } from '@/hooks/useAction';
import { useAuth } from '@/hooks/useAuth';
import { usePageTitle } from '@/hooks/usePageTitle';
import { usePlayerProfile } from '@/hooks/usePlayer';
import { useI18n } from '@/i18n';
import { profileService } from '@/services/profileService';
import { ageFrom, countryName, formatDate } from '@/utils/formatters';

/** Masks all but the last two digits until the player chooses to reveal it. */
function Sensitive({ value, href }) {
  const { t } = useI18n();
  const [shown, setShown] = useState(false);
  if (!value) return null;
  const masked = value.replace(/\d(?=(?:\D*\d){2})/g, '•');
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      {shown && href ? (
        <a href={href} className="hover:underline">
          {value}
        </a>
      ) : (
        <span className="tabular" aria-label={shown ? undefined : t('profile.masked')}>
          {shown ? value : masked}
        </span>
      )}
      <button type="button" onClick={() => setShown((v) => !v)} className="inline-flex h-7 items-center gap-1 rounded-md px-1.5 text-xs font-medium text-brand-700 hover:bg-brand-50 dark:text-brand-300 dark:hover:bg-brand-500/10" aria-pressed={shown}>
        {shown ? <EyeOff className="size-3.5" aria-hidden="true" /> : <Eye className="size-3.5" aria-hidden="true" />}
        {shown ? t('profile.hide') : t('profile.show')}
      </button>
    </span>
  );
}

export default function MyProfile() {
  const { t, lang } = useI18n();
  usePageTitle(t('profile.title'));
  const run = useAction();
  const { refreshUser } = useAuth();
  const query = usePlayerProfile();
  const [editing, setEditing] = useState(false);

  const save = async (values) => {
    await run(() => profileService.update(values), { success: 'profile.toasts.saved' });
    setEditing(false);
    refreshUser();
    query.refetch();
  };

  return (
    <>
      <DetailGuard query={query} entity={t('profile.title')} backTo="/player/dashboard" backLabel={t('nav.dashboard')}>
        {(p) => {
          const age = ageFrom(p.date_of_birth);
          const tel = (v) => `tel:${v.replace(/\s/g, '')}`;
          return (
            <>
              <ProfileHero
                avatar={
                  <div className="relative w-fit">
                    <Avatar name={p.name} src={p.photo} size="2xl" className="ring-4 ring-surface" />
                    <span className="absolute -bottom-1 -right-1 grid size-10 place-items-center rounded-full bg-brand-600 font-display text-lg font-bold text-white ring-4 ring-surface dark:bg-brand-500 dark:text-brand-950">{p.jersey_number}</span>
                  </div>
                }
                title={p.name}
                badge={<StatusBadge value={p.status} />}
                meta={
                  <>
                    <span className="font-display text-base font-bold text-ink">#{p.jersey_number}</span>
                    <span>{t(`positions.${p.position}`)}</span>
                    <TeamChip team={p.team} link={false} />
                  </>
                }
                actions={
                  <Button icon={Pencil} onClick={() => setEditing(true)} className="flex-1 sm:flex-none">
                    {t('profile.edit')}
                  </Button>
                }
              />
              <div className="mt-4 grid gap-4 sm:mt-6 sm:gap-6 lg:grid-cols-2">
                <Card>
                  <CardHeader title={t('profile.personal')} icon={UserRound} />
                  <CardBody>
                    <DescriptionList
                      columns={2}
                      items={[
                        { label: t('profile.fields.name'), value: p.name, icon: UserRound },
                        { label: t('profile.fields.email'), value: <a href={`mailto:${p.email}`} className="break-all hover:underline">{p.email}</a>, icon: Mail },
                        { label: t('profile.fields.phone'), value: <Sensitive value={p.phone} href={tel(p.phone)} />, icon: Phone },
                        { label: t('profile.fields.dob'), value: `${formatDate(p.date_of_birth, lang, { day: 'numeric', month: 'long', year: 'numeric' })}${age !== null ? ` · ${t('profile.fields.age', { count: age })}` : ''}`, icon: Cake },
                        { label: t('profile.fields.gender'), value: t(`genders.${p.gender}`), icon: UserRound },
                        { label: t('profile.fields.nationality'), value: countryName(p.nationality, lang), icon: Flag },
                        { label: t('profile.fields.address'), value: p.address, icon: Home },
                        { label: t('profile.fields.registered'), value: formatDate(p.registration_date, lang), icon: CalendarCheck },
                      ]}
                    />
                    <div className="mt-6 rounded-xl border border-line bg-surface-2/60 p-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-ink-3">{t('profile.fields.emergency')}</p>
                      <p className="mt-1.5 text-sm font-medium text-ink">
                        {p.emergency_contact_name}
                        {p.emergency_contact_relation && <span className="font-normal text-ink-3"> · {t(`relations.${p.emergency_contact_relation}`)}</span>}
                      </p>
                      <p className="mt-0.5 text-sm text-ink-2">
                        <Sensitive value={p.emergency_contact_phone} href={tel(p.emergency_contact_phone ?? '')} />
                      </p>
                    </div>
                  </CardBody>
                </Card>
                <Card>
                  <CardHeader title={t('profile.sports')} icon={Shirt} />
                  <CardBody>
                    <DescriptionList
                      columns={2}
                      items={[
                        { label: t('profile.fields.playerId'), value: <span className="font-mono">{p.player_code}</span>, icon: IdCard },
                        { label: t('profile.fields.jersey'), value: `#${p.jersey_number}`, icon: Hash },
                        { label: t('profile.fields.position'), value: t(`positions.${p.position}`), icon: Shirt },
                        { label: t('profile.fields.secondaryPosition'), value: p.secondary_position ? t(`positions.${p.secondary_position}`) : null, icon: Shirt },
                        { label: t('profile.fields.preferredFoot'), value: t(`preferredFoot.${p.preferred_foot}`), icon: Footprints },
                        { label: t('profile.fields.height'), value: t('profile.units.cm', { value: p.height }), icon: Ruler },
                        { label: t('profile.fields.weight'), value: t('profile.units.kg', { value: p.weight }), icon: Weight },
                        { label: t('profile.fields.team'), value: <TeamChip team={p.team} link={false} />, icon: Shield },
                        { label: t('profile.fields.coach'), value: p.coach?.name, icon: UserRound },
                        { label: t('profile.fields.status'), value: <StatusBadge value={p.status} />, icon: BadgeCheck },
                      ]}
                    />
                    <div className="mt-6 flex flex-wrap items-center gap-3 rounded-xl border border-line bg-surface-2/60 p-4">
                      <IdCard className="size-5 text-ink-3" aria-hidden="true" />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold uppercase tracking-wide text-ink-3">{t('profile.fields.registration')}</p>
                        <p className="mt-0.5 text-sm text-ink">
                          {t('profile.fields.license')} <span className="font-mono">{p.license_number}</span>
                        </p>
                      </div>
                      <Badge tone={p.license_valid ? 'success' : 'danger'} dot>
                        {t(p.license_valid ? 'profile.registration.valid' : 'profile.registration.expired', { date: formatDate(p.license_valid_until, lang) })}
                      </Badge>
                    </div>
                    <p className="mt-3 text-xs text-ink-3">{t('profile.managedByClub')}</p>
                  </CardBody>
                </Card>
              </div>
            </>
          );
        }}
      </DetailGuard>
      <EditProfileModal open={editing} profile={query.data} onClose={() => setEditing(false)} onSubmit={save} />
    </>
  );
}
