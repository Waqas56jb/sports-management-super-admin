import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ClipboardList, Pencil, Plus, RefreshCw, Users } from 'lucide-react';
import BackLink from '@/components/common/BackLink';
import DetailGuard from '@/components/common/DetailGuard';
import PersonCell from '@/components/common/PersonCell';
import RowActions from '@/components/common/RowActions';
import TeamLogo from '@/components/common/TeamLogo';
import Button from '@/components/ui/Button';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/States';
import Tabs from '@/components/ui/Tabs';
import { useConfirm } from '@/context/ConfirmContext';
import { useAction } from '@/hooks/useAction';
import { useCompetitionOptions } from '@/hooks/useOptions';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useQuery } from '@/hooks/useQuery';
import { useI18n } from '@/i18n';
import { matchService } from '@/services/matchService';
import EventModal from './centre/EventModal';
import LineupModal from './centre/LineupModal';
import PitchView from './centre/PitchView';
import Scoreboard from './centre/Scoreboard';
import ScoreModal from './centre/ScoreModal';
import Timeline from './centre/Timeline';
import { useMatchActions } from './useMatchActions';

function LineupCard({ match, side, onEdit }) {
  const { t } = useI18n();
  const team = side === 'home' ? match.home_team : match.away_team;
  const lineup = match.lineups?.[side];
  const squad = match.squads[side];
  const byId = Object.fromEntries(squad.map((p) => [p.id, p]));
  const canEdit = match.status !== 'cancelled';
  const known = (ids) => ids.map((id) => byId[id]).filter(Boolean);
  return (
    <Card>
      <CardHeader
        title={
          <span className="flex items-center gap-2">
            <TeamLogo team={team} size="sm" />
            {team?.name}
          </span>
        }
        subtitle={lineup ? `${t('matches.lineup.formation')} ${lineup.formation}` : undefined}
        action={
          canEdit && (
            <Button variant="secondary" size="sm" icon={lineup ? Pencil : Plus} onClick={onEdit}>
              {lineup ? t('matches.lineup.edit') : t('matches.lineup.set')}
            </Button>
          )
        }
      />
      <CardBody>
        {!lineup || !lineup.starting.length ? (
          <EmptyState compact icon={ClipboardList} title={t('matches.lineup.notSet')} description={canEdit ? t('matches.lineup.notSetHint') : undefined} />
        ) : (
          <div className="space-y-4">
            <PitchView formation={lineup.formation} starters={known(lineup.starting)} team={team} />
            {lineup.substitutes.length > 0 && (
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-3">{t('matches.lineup.substitutes')}</p>
                <ul className="flex flex-wrap gap-1.5">
                  {known(lineup.substitutes).map((p) => (
                    <li key={p.id} className="inline-flex items-center gap-1.5 rounded-lg bg-surface-3 px-2 py-1 text-xs text-ink-2">
                      <span className="font-semibold text-ink tabular">{p.jersey_number ?? '–'}</span>
                      {p.name}
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

function PlayerStatsTable({ match, side }) {
  const { t } = useI18n();
  const team = side === 'home' ? match.home_team : match.away_team;
  const squad = Object.fromEntries(match.squads[side].map((p) => [p.id, p]));
  const lines = Object.values(match.player_lines).filter((l) => l.team_id === team?.id);
  lines.sort((a, b) => Number(b.started) - Number(a.started) || (squad[a.player_id]?.jersey_number ?? 99) - (squad[b.player_id]?.jersey_number ?? 99));
  const th = 'py-2.5 text-xs font-semibold uppercase tracking-wide text-ink-3';
  return (
    <Card>
      <CardHeader title={<span className="flex items-center gap-2"><TeamLogo team={team} size="sm" />{team?.name}</span>} />
      <div className="mt-3 overflow-x-auto scrollbar-thin">
        <table className="w-full min-w-[440px] text-sm">
          <thead>
            <tr className="border-y border-line bg-surface-2/60">
              <th scope="col" className={`${th} pl-5 text-left`}>{t('matches.stats.player')}</th>
              <th scope="col" className={`${th} text-right`}>{t('matches.stats.minutes')}</th>
              <th scope="col" className={`${th} text-right`}>{t('matches.stats.goals')}</th>
              <th scope="col" className={`${th} text-right`}>{t('matches.stats.assists')}</th>
              <th scope="col" className={`${th} text-center`}>{t('matches.stats.cards')}</th>
              <th scope="col" className={`${th} pr-5 text-right`}>{t('matches.stats.rating')}</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l) => {
              const p = squad[l.player_id];
              return (
                <tr key={l.player_id} className="border-b border-line last:border-0">
                  <td className="py-2.5 pl-5">
                    <PersonCell name={p?.name ?? t('matches.centre.formerPlayer')} photo={p?.photo} size="sm" to={p ? `/admin/players/${p.id}` : undefined} sub={l.started ? t('matches.lineup.starting') : t('matches.lineup.substitutes')} />
                  </td>
                  <td className="py-2.5 text-right tabular text-ink-2">{l.minutes}'</td>
                  <td className="py-2.5 text-right font-semibold tabular text-ink">{l.goals || '·'}</td>
                  <td className="py-2.5 text-right tabular text-ink-2">{l.assists || '·'}</td>
                  <td className="py-2.5 text-center">
                    <span className="inline-flex gap-1" aria-label={`${l.yellow_cards} ${t('eventTypes.yellow_card')}, ${l.red_cards} ${t('eventTypes.red_card')}`}>
                      {Array.from({ length: l.yellow_cards }, (_, i) => <span key={`y${i}`} className="h-3.5 w-2.5 rounded-[2px] bg-amber-400" />)}
                      {Array.from({ length: l.red_cards }, (_, i) => <span key={`r${i}`} className="h-3.5 w-2.5 rounded-[2px] bg-red-600" />)}
                      {!l.yellow_cards && !l.red_cards && <span className="text-ink-3">·</span>}
                    </span>
                  </td>
                  <td className="py-2.5 pr-5 text-right font-semibold tabular text-ink">{l.rating.toFixed(1)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

export default function MatchDetailPage() {
  const { id } = useParams();
  const { t } = useI18n();
  const navigate = useNavigate();
  const confirm = useConfirm();
  const run = useAction();
  const { competitions } = useCompetitionOptions();
  const query = useQuery(() => matchService.get(id), [id]);
  const m = query.data;
  usePageTitle(m ? `${m.home_team?.short_name} ${m.home_score ?? ''}${m.home_score !== null ? '–' : 'v'}${m.away_score ?? ''} ${m.away_team?.short_name}` : t('matches.title'));
  const [tab, setTab] = useState('timeline');
  const [dialog, setDialog] = useState({ type: null, side: null });
  const close = () => setDialog({ type: null, side: null });
  const { actionsFor, modals, openEdit } = useMatchActions({
    competitions,
    onChanged: query.refetch,
    onDeleted: () => navigate('/admin/matches', { replace: true }),
    showView: false,
  });

  const saveScore = async (values) => {
    await run(() => matchService.updateScore(id, values), { success: 'matches.toasts.scoreUpdated' });
    close();
    query.refetch();
  };

  const saveEvent = async ({ side, ...values }) => {
    const teamId = side === 'home' ? m.home_team_id : m.away_team_id;
    await run(() => matchService.addEvent(id, { ...values, team_id: teamId }), { success: 'matches.toasts.eventAdded' });
    close();
    query.refetch();
  };

  const deleteEvent = async (e) => {
    const ok = await confirm({
      title: t('matches.confirmDeleteEvent.title'),
      message: t('matches.confirmDeleteEvent.message'),
      confirmLabel: t('common.delete'),
      onConfirm: () => run(() => matchService.removeEvent(id, e.id), { success: 'matches.toasts.eventDeleted' }),
    });
    if (ok) query.refetch();
  };

  const saveLineup = async (lineup) => {
    await run(() => matchService.saveLineup(id, dialog.side, lineup), { success: 'matches.toasts.lineupSaved' });
    close();
    query.refetch();
  };

  const canRecord = m && (m.status === 'live' || m.status === 'completed');

  return (
    <>
      <DetailGuard query={query} entity={t('calendar.kinds.match')} backTo="/admin/matches" backLabel={t('matches.centre.back')}>
        {(match) => (
          <>
            <BackLink to="/admin/matches">{t('matches.centre.back')}</BackLink>
            <Scoreboard
              match={match}
              actions={
                <>
                  <Button icon={Plus} onClick={() => setDialog({ type: 'event' })} disabled={!canRecord} title={!canRecord ? t('matches.event.notStarted') : undefined} className="dark:bg-brand-500">
                    {t('matches.actions.event')}
                  </Button>
                  <Button variant="secondary" icon={RefreshCw} onClick={() => setDialog({ type: 'score' })} className="border-white/15 bg-white/10 text-white hover:bg-white/15 dark:border-white/15 dark:bg-white/10">
                    {t('matches.actions.score')}
                  </Button>
                  <Button variant="secondary" icon={Pencil} onClick={() => openEdit(match)} className="border-white/15 bg-white/10 text-white hover:bg-white/15 dark:border-white/15 dark:bg-white/10">
                    {t('common.edit')}
                  </Button>
                  <div className="rounded-xl border border-white/15 bg-white/10 text-white [&_button]:text-white/80 [&_button:hover]:bg-white/10">
                    <RowActions items={actionsFor(match)} />
                  </div>
                </>
              }
            />
            {!canRecord && match.status === 'scheduled' && <p className="mt-3 text-center text-xs text-ink-3">{t('matches.event.notStarted')}</p>}

            <Tabs
              className="mt-5"
              label={t('matches.title')}
              value={tab}
              onChange={setTab}
              tabs={[
                { value: 'timeline', label: t('matches.centre.timeline'), count: match.events.length },
                { value: 'lineups', label: t('matches.centre.lineups'), icon: Users },
                { value: 'stats', label: t('matches.centre.playerStats') },
              ]}
            />

            <div className="mt-4" role="tabpanel">
              {tab === 'timeline' && (
                <Card>
                  <CardBody>
                    <Timeline match={match} onDelete={deleteEvent} />
                  </CardBody>
                </Card>
              )}
              {tab === 'lineups' && (
                <div className="grid gap-4 sm:gap-6 lg:grid-cols-2">
                  <LineupCard match={match} side="home" onEdit={() => setDialog({ type: 'lineup', side: 'home' })} />
                  <LineupCard match={match} side="away" onEdit={() => setDialog({ type: 'lineup', side: 'away' })} />
                </div>
              )}
              {tab === 'stats' &&
                (Object.keys(match.player_lines).length === 0 ? (
                  <div className="card">
                    <EmptyState compact icon={Users} title={t('matches.stats.empty')} />
                  </div>
                ) : (
                  <div className="grid gap-4 sm:gap-6 xl:grid-cols-2">
                    <PlayerStatsTable match={match} side="home" />
                    <PlayerStatsTable match={match} side="away" />
                  </div>
                ))}
            </div>
          </>
        )}
      </DetailGuard>

      {m && (
        <>
          <ScoreModal open={dialog.type === 'score'} match={m} onClose={close} onSubmit={saveScore} />
          <EventModal open={dialog.type === 'event'} match={m} onClose={close} onSubmit={saveEvent} />
          <LineupModal
            open={dialog.type === 'lineup'}
            team={dialog.side === 'away' ? m.away_team : m.home_team}
            squad={dialog.side ? m.squads[dialog.side] : []}
            lineup={dialog.side ? m.lineups?.[dialog.side] : null}
            onClose={close}
            onSubmit={saveLineup}
          />
        </>
      )}
      {modals}
    </>
  );
}
