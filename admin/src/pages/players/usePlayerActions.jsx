import { useState } from 'react';
import { Eye, Pencil, Power, Shield, ShieldOff, Trash2, UserX } from 'lucide-react';
import SelectModal from '@/components/common/SelectModal';
import { useConfirm } from '@/context/ConfirmContext';
import { useAction } from '@/hooks/useAction';
import { useI18n } from '@/i18n';
import { playerService } from '@/services/playerService';
import PlayerFormModal from './PlayerFormModal';

/**
 * Player mutations shared by the list and the profile page:
 * row/menu actions, the create/edit form and the assign-team dialog.
 */
export function usePlayerActions({ teams, onChanged, onDeleted, showView = true }) {
  const { t } = useI18n();
  const confirm = useConfirm();
  const run = useAction();
  const [modal, setModal] = useState({ type: null, player: null, teamId: null });
  const close = () => setModal({ type: null, player: null });

  const openCreate = (teamId) => setModal({ type: 'form', player: null, teamId });
  const openEdit = (player) => setModal({ type: 'form', player });

  const save = async (values) => {
    if (modal.player) await run(() => playerService.update(modal.player.id, values), { success: 'players.toasts.updated' });
    else await run(() => playerService.create(values), { success: 'players.toasts.created' });
    close();
    onChanged?.();
  };

  const setStatus = async (p, status) => {
    if (status === 'active') {
      await run(() => playerService.setStatus(p.id, status), { success: 'players.toasts.statusChanged' }).catch(() => {});
      return onChanged?.();
    }
    const action = t(status === 'suspended' ? 'players.actions.suspend' : 'players.actions.deactivate');
    const ok = await confirm({
      title: t('players.confirmStatus.title', { action, name: p.name }),
      message: t(`players.confirmStatus.${status}`),
      confirmLabel: action,
      onConfirm: () => run(() => playerService.setStatus(p.id, status), { success: 'players.toasts.statusChanged' }),
    });
    if (ok) onChanged?.();
  };

  const remove = async (p) => {
    const ok = await confirm({
      title: t('players.confirmDelete.title', { name: p.name }),
      message: t('players.confirmDelete.message'),
      confirmLabel: t('players.actions.delete'),
      onConfirm: () => run(() => playerService.remove(p.id), { success: 'players.toasts.deleted' }),
    });
    if (ok) (onDeleted ?? onChanged)?.();
  };

  const assignTeam = async (teamId) => {
    await run(() => playerService.assignTeam(modal.player.id, teamId), { success: 'players.toasts.teamAssigned' });
    close();
    onChanged?.();
  };

  const actionsFor = (p) => [
    showView && { label: t('players.actions.view'), icon: Eye, to: `/admin/players/${p.id}` },
    { label: t('players.actions.edit'), icon: Pencil, onClick: () => openEdit(p) },
    { label: t('players.actions.assignTeam'), icon: Shield, onClick: () => setModal({ type: 'assign', player: p }) },
    { divider: true },
    p.status !== 'active' && { label: t('players.actions.activate'), icon: Power, onClick: () => setStatus(p, 'active') },
    p.status === 'active' && { label: t('players.actions.deactivate'), icon: UserX, onClick: () => setStatus(p, 'inactive') },
    p.status !== 'suspended' && { label: t('players.actions.suspend'), icon: ShieldOff, onClick: () => setStatus(p, 'suspended') },
    { divider: true },
    { label: t('players.actions.delete'), icon: Trash2, tone: 'danger', onClick: () => remove(p) },
  ];

  const modals = (
    <>
      <PlayerFormModal open={modal.type === 'form'} player={modal.player} teams={teams} defaultTeamId={modal.teamId} onClose={close} onSubmit={save} />
      <SelectModal
        open={modal.type === 'assign'}
        title={modal.player ? t('players.assign.title', { name: modal.player.name }) : ''}
        label={t('players.assign.team')}
        hint={t('players.assign.hint')}
        options={teams.map((tm) => ({ value: tm.id, label: tm.name }))}
        placeholder={t('players.unassigned')}
        value={modal.player?.team_id}
        submitLabel={t('players.assign.submit')}
        onClose={close}
        onSubmit={assignTeam}
      />
    </>
  );

  return { actionsFor, modals, openCreate, openEdit };
}
