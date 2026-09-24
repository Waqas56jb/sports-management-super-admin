import { Lock } from 'lucide-react';
import TeamLogo from '@/components/common/TeamLogo';
import Avatar from '@/components/ui/Avatar';
import { StatusBadge } from '@/components/ui/Badge';
import Modal from '@/components/ui/Modal';
import { DescriptionList } from '@/components/ui/Misc';
import { Skeleton } from '@/components/ui/Skeleton';
import { ErrorState } from '@/components/ui/States';
import { useQuery } from '@/hooks/useQuery';
import { useI18n } from '@/i18n';
import { playerService } from '@/services/playerService';
import { countryName } from '@/utils/formatters';

/** Public teammate card — football information only, never contact details. */
export default function TeammateModal({ id, onClose }) {
  const { t, lang } = useI18n();
  const q = useQuery(() => playerService.getTeammate(id), [id], { enabled: !!id });
  const p = q.data;
  return (
    <Modal open={!!id} onClose={onClose} size="sm" title={t('team.teammate.title')}>
      {q.loading || !p ? (
        q.error ? (
          <ErrorState compact error={q.error} onRetry={q.refetch} />
        ) : (
          <div className="space-y-4" aria-hidden="true">
            <div className="flex items-center gap-4">
              <Skeleton className="size-20 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-5 w-2/3" />
                <Skeleton className="h-4 w-1/3" />
              </div>
            </div>
            <Skeleton className="h-24 w-full" />
          </div>
        )
      ) : (
        <div className="space-y-5">
          <div className="flex items-center gap-4">
            <div className="relative">
              <Avatar name={p.name} src={p.photo} size="xl" />
              <span className="absolute -bottom-1 -right-1 grid size-8 place-items-center rounded-full bg-brand-600 font-display text-base font-bold text-white ring-4 ring-surface dark:bg-brand-500 dark:text-brand-950">{p.jersey_number}</span>
            </div>
            <div className="min-w-0">
              <p className="truncate text-lg font-semibold text-ink">{p.name}</p>
              <p className="flex items-center gap-1.5 text-sm text-ink-3">
                <TeamLogo team={p.team} size="xs" />
                {p.team?.name}
              </p>
              <div className="mt-1.5">
                <StatusBadge value={p.status} />
              </div>
            </div>
          </div>
          <DescriptionList
            columns={2}
            items={[
              { label: t('profile.fields.position'), value: t(`positions.${p.position}`) },
              { label: t('profile.fields.secondaryPosition'), value: p.secondary_position ? t(`positions.${p.secondary_position}`) : null },
              { label: t('profile.fields.preferredFoot'), value: t(`preferredFoot.${p.preferred_foot}`) },
              { label: t('profile.fields.nationality'), value: countryName(p.nationality, lang) },
            ]}
          />
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-3">{t('team.teammate.season')}</p>
            <dl className="grid grid-cols-3 gap-2 text-center">
              {[
                ['matches', p.season.matches_played],
                ['goals', p.season.goals],
                ['assists', p.season.assists],
              ].map(([k, v]) => (
                <div key={k} className="rounded-xl bg-surface-2 py-2.5">
                  <dt className="text-xs text-ink-3">{t(`team.teammate.${k}`)}</dt>
                  <dd className="font-display text-2xl font-bold text-ink tabular">{v}</dd>
                </div>
              ))}
            </dl>
          </div>
          <p className="flex items-center gap-2 text-xs text-ink-3">
            <Lock className="size-3.5" aria-hidden="true" />
            {t('team.teammate.privacy')}
          </p>
        </div>
      )}
    </Modal>
  );
}
