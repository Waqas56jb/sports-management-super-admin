import { useNavigate, useParams } from 'react-router-dom';
import { CalendarDays, CalendarPlus, Goal, MapPin, Pencil, Square, Target, Trophy } from 'lucide-react';
import BackLink from '@/components/common/BackLink';
import DetailGuard from '@/components/common/DetailGuard';
import MatchRow from '@/components/common/MatchRow';
import MiniStat from '@/components/common/MiniStat';
import PersonCell from '@/components/common/PersonCell';
import ProfileHero from '@/components/common/ProfileHero';
import RowActions from '@/components/common/RowActions';
import StandingsTable from '@/components/common/StandingsTable';
import { TeamChip } from '@/components/common/TeamLogo';
import Badge, { StatusBadge } from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/States';
import { useTeamOptions } from '@/hooks/useOptions';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useQuery } from '@/hooks/useQuery';
import { useI18n } from '@/i18n';
import { competitionService } from '@/services/competitionService';
import { formatDate, formatNumber } from '@/utils/format';
import { useCompetitionActions } from './useCompetitionActions';

export default function CompetitionDetailPage() {
  const { id } = useParams();
  const { t, lang } = useI18n();
  const navigate = useNavigate();
  const { teams } = useTeamOptions();
  const query = useQuery(() => competitionService.get(id), [id]);
  usePageTitle(query.data ? `${query.data.name} ${query.data.season}` : t('competitions.title'));
  const { actionsFor, modals, openEdit } = useCompetitionActions({
    teams,
    onChanged: query.refetch,
    onDeleted: () => navigate('/admin/competitions', { replace: true }),
    showView: false,
  });

  return (
    <>
      <DetailGuard query={query} entity={t('common.competition')} backTo="/admin/competitions" backLabel={t('competitions.detail.back')}>
        {(c) => (
          <>
            <BackLink to="/admin/competitions">{t('competitions.detail.back')}</BackLink>
            <ProfileHero
              avatar={
                <span className="grid size-24 place-items-center rounded-2xl bg-amber-50 text-amber-500 shadow-(--shadow-card) ring-4 ring-surface dark:bg-amber-500/10 sm:size-28">
                  <Trophy className="size-12" aria-hidden="true" />
                </span>
              }
              title={`${c.name} ${c.season}`}
              badge={<StatusBadge value={c.status} />}
              meta={
                <>
                  <Badge tone="neutral">{t(`competitionTypes.${c.type}`)}</Badge>
                  <span className="inline-flex items-center gap-1">
                    <CalendarDays className="size-3.5" aria-hidden="true" />
                    {formatDate(c.start_date, lang)} – {formatDate(c.end_date, lang)}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="size-3.5" aria-hidden="true" />
                    {c.location}
                  </span>
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
            >
              {c.description && <p className="border-t border-line px-4 py-4 text-sm leading-relaxed text-ink-2 sm:px-6">{c.description}</p>}
            </ProfileHero>

            <section aria-label={t('competitions.detail.overview')} className="mt-4 grid grid-cols-2 gap-3 sm:mt-6 sm:grid-cols-3 xl:grid-cols-6">
              <MiniStat className="bg-surface" label={t('competitions.detail.stats.matches')} value={c.totals.matches} icon={CalendarDays} />
              <MiniStat className="bg-surface" label={t('competitions.detail.stats.played')} value={c.totals.played} icon={Trophy} />
              <MiniStat className="bg-surface" label={t('competitions.detail.stats.goals')} value={c.totals.goals} icon={Goal} />
              <MiniStat className="bg-surface" label={t('competitions.detail.stats.perMatch')} value={formatNumber(c.totals.goals_per_match, lang, { maximumFractionDigits: 2 })} icon={Target} />
              <MiniStat className="bg-surface" label={t('competitions.detail.stats.yellow')} value={c.totals.yellow_cards} icon={Square} accent="fill-amber-400 text-amber-500" />
              <MiniStat className="bg-surface" label={t('competitions.detail.stats.red')} value={c.totals.red_cards} icon={Square} accent="fill-red-500 text-red-600" />
            </section>

            <div className="mt-4 grid gap-4 sm:mt-6 sm:gap-6 xl:grid-cols-3">
              <Card className="xl:col-span-2">
                <CardHeader title={c.type === 'league' ? t('competitions.detail.standings') : t('competitions.detail.teams')} />
                <div className="mt-3">
                  {c.type === 'league' ? (
                    <StandingsTable rows={c.standings} />
                  ) : (
                    <CardBody className="grid gap-2 pt-0 sm:grid-cols-2">
                      {c.teams.map((tm) => (
                        <div key={tm.id} className="rounded-xl border border-line p-3">
                          <TeamChip team={tm} size="md" />
                        </div>
                      ))}
                    </CardBody>
                  )}
                </div>
              </Card>
              <Card>
                <CardHeader title={t('competitions.detail.topScorers')} />
                <CardBody>
                  {c.top_scorers.length === 0 ? (
                    <EmptyState compact icon={Goal} title={t('competitions.detail.noScorers')} />
                  ) : (
                    <ol className="space-y-3">
                      {c.top_scorers.map((s, i) => (
                        <li key={s.player_id} className="flex items-center gap-3">
                          <span className="w-5 text-center font-display text-lg font-bold text-ink-3 tabular">{i + 1}</span>
                          <PersonCell name={s.player.name} photo={s.player.photo} sub={s.team?.name} to={`/admin/players/${s.player.id}`} size="sm" className="flex-1" />
                          <span className="font-display text-2xl font-bold text-ink tabular">{s.goals}</span>
                        </li>
                      ))}
                    </ol>
                  )}
                </CardBody>
              </Card>
            </div>

            <div className="mt-4 grid gap-4 sm:mt-6 sm:gap-6 lg:grid-cols-2">
              <Card>
                <CardHeader
                  title={t('competitions.detail.upcoming')}
                  action={
                    <Button variant="secondary" size="sm" icon={CalendarPlus} to={`/admin/matches?new=1&competition=${c.id}`}>
                      {t('competitions.detail.scheduleMatch')}
                    </Button>
                  }
                />
                <div className="px-1.5 pb-2 pt-2 sm:px-2">
                  {c.upcoming_matches.length ? c.upcoming_matches.map((m) => <MatchRow key={m.id} match={m} showCompetition={false} />) : <EmptyState compact icon={CalendarDays} title={t('competitions.detail.noUpcoming')} />}
                </div>
              </Card>
              <Card>
                <CardHeader title={t('competitions.detail.completed')} />
                <div className="max-h-[560px] overflow-y-auto px-1.5 pb-2 pt-2 scrollbar-thin sm:px-2">
                  {c.completed_matches.length ? c.completed_matches.map((m) => <MatchRow key={m.id} match={m} showCompetition={false} />) : <EmptyState compact icon={Trophy} title={t('competitions.detail.noCompleted')} />}
                </div>
              </Card>
            </div>
          </>
        )}
      </DetailGuard>
      {modals}
    </>
  );
}
