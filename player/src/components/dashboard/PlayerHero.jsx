import { Link } from 'react-router-dom';
import TeamLogo from '@/components/common/TeamLogo';
import Avatar from '@/components/ui/Avatar';
import { StatusBadge } from '@/components/ui/Badge';
import { useI18n } from '@/i18n';
import { formatLongDate } from '@/utils/formatters';

function greetingKey() {
  const h = new Date().getHours();
  if (h < 12) return 'morning';
  if (h < 18) return 'afternoon';
  return 'evening';
}

/** "Who I am" banner: greeting, avatar with shirt number, position, team and status. */
export default function PlayerHero({ player }) {
  const { t, lang } = useI18n();
  const firstName = player.name.split(' ')[0];
  return (
    <section aria-label={player.name} className="pitch-lines hero-aurora relative overflow-hidden rounded-(--radius-card) bg-[#0b1220] p-5 text-white shadow-(--shadow-card) sm:p-6">
      <div className="absolute -right-24 -top-24 size-72 rounded-full bg-brand-500/15 blur-3xl" aria-hidden="true" />
      <div className="absolute -bottom-28 left-1/3 size-64 rounded-full bg-sky-500/10 blur-3xl" aria-hidden="true" />
      <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center">
        <div className="relative w-fit shrink-0">
          <Avatar name={player.name} src={player.photo} size="xl" className="ring-4 ring-white/10" />
          <span className="absolute -bottom-1 -right-1 grid size-9 place-items-center rounded-full bg-brand-500 font-display text-lg font-bold text-brand-950 ring-4 ring-[#0b1220]">
            {player.jersey_number}
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm capitalize text-white/60">{formatLongDate(new Date(), lang)}</p>
          <h1 className="mt-0.5 text-2xl font-semibold tracking-tight sm:text-3xl">{t(`dashboard.greeting.${greetingKey()}`, { name: firstName })}</h1>
          <p className="mt-1 text-sm text-white/70">{t('dashboard.subtitle')}</p>
        </div>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-3 rounded-2xl bg-white/5 p-4 text-sm ring-1 ring-white/10 sm:min-w-72">
          <div>
            <dt className="text-xs text-white/50">{t('profile.fields.position')}</dt>
            <dd className="font-semibold">{t(`positions.${player.position}`)}</dd>
          </div>
          <div>
            <dt className="text-xs text-white/50">{t('profile.fields.jersey')}</dt>
            <dd className="font-display text-lg font-bold leading-6">#{player.jersey_number}</dd>
          </div>
          <div className="min-w-0">
            <dt className="text-xs text-white/50">{t('profile.fields.team')}</dt>
            <dd>
              <Link to="/player/team" className="inline-flex max-w-full items-center gap-1.5 font-semibold hover:underline">
                <TeamLogo team={player.team} size="xs" />
                <span className="truncate">{player.team?.name}</span>
              </Link>
            </dd>
          </div>
          <div>
            <dt className="text-xs text-white/50">{t('profile.fields.status')}</dt>
            <dd className="mt-0.5">
              <StatusBadge value={player.status} />
            </dd>
          </div>
        </dl>
      </div>
    </section>
  );
}
