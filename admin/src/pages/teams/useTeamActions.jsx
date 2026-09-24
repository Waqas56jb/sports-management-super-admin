import { useEffect, useMemo, useState } from 'react';
import { Eye, Pencil, Power, Trash2, UserPlus, UserRoundCog } from 'lucide-react';
import SelectModal from '@/components/common/SelectModal';
import TeamLogo from '@/components/common/TeamLogo';
import Avatar from '@/components/ui/Avatar';
import Button from '@/components/ui/Button';
import CheckboxList from '@/components/ui/CheckboxList';
import { Input, Select, Textarea } from '@/components/ui/Field';
import Modal from '@/components/ui/Modal';
import PhotoUpload from '@/components/ui/PhotoUpload';
import { useConfirm } from '@/context/ConfirmContext';
import { useAction } from '@/hooks/useAction';
import { useForm } from '@/hooks/useForm';
import { useOptions } from '@/hooks/useOptions';
import { useI18n } from '@/i18n';
import { coachService } from '@/services/coachService';
import { playerService } from '@/services/playerService';
import { teamService } from '@/services/teamService';
import { AGE_GROUPS, TEAM_CATEGORIES, TEAM_GENDERS, TEAM_STATUSES } from '@/utils/constants';
import { maxLength, minLength, numberRange, required } from '@/utils/validators';

const SCHEMA = {
  name: [required, minLength(3), maxLength(60)],
  short_name: [required, minLength(2), maxLength(4)],
  category: [required],
  age_group: [required],
  gender: [required],
  founded: [numberRange(1900, new Date().getFullYear())],
  description: [maxLength(500)],
  status: [required],
};
const BLANK = { name: '', short_name: '', logo: null, category: 'senior', age_group: 'open', gender: 'male', coach_id: '', home_ground: '', founded: '', description: '', status: 'active' };

function TeamFormModal({ open, team, coaches, onClose, onSubmit }) {
  const { t } = useI18n();
  const toOptions = useOptions();
  const form = useForm({ initial: BLANK, schema: SCHEMA, onSubmit });
  const { reset } = form;

  useEffect(() => {
    if (open) reset(team ? Object.fromEntries(Object.keys(BLANK).map((k) => [k, team[k] ?? BLANK[k]])) : BLANK);
  }, [open, team, reset]);

  const preview = { name: form.values.name, short_name: form.values.short_name || form.values.name.slice(0, 3), color: team?.color ?? 4 };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={team ? t('teams.form.editTitle') : t('teams.form.createTitle')}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} className="w-full sm:w-auto">
            {t('common.cancel')}
          </Button>
          <Button type="submit" form="team-form" loading={form.submitting} className="w-full sm:w-auto">
            {team ? t('common.saveChanges') : t('teams.form.create')}
          </Button>
        </>
      }
    >
      <form id="team-form" ref={form.formRef} onSubmit={form.handleSubmit} noValidate className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <PhotoUpload
            shape="square"
            label={t('teams.form.logo')}
            value={form.values.logo}
            onChange={(v) => form.setValue('logo', v)}
            fallback={
              <span className="grid size-20 place-items-center rounded-2xl border border-line bg-surface-2">
                <TeamLogo team={preview} size="lg" />
              </span>
            }
          />
          <p className="mt-2 text-xs text-ink-3">{t('teams.form.logoHint')}</p>
        </div>
        <Input label={t('teams.form.name')} required autoComplete="off" {...form.field('name')} />
        <Input label={t('teams.form.shortName')} required hint={t('teams.form.shortNameHint')} maxLength={4} className="uppercase" {...form.field('short_name')} />
        <Select label={t('teams.form.category')} required options={toOptions(TEAM_CATEGORIES, 'categories')} {...form.field('category')} />
        <Select label={t('teams.form.ageGroup')} required options={toOptions(AGE_GROUPS, 'ageGroups')} {...form.field('age_group')} />
        <Select label={t('teams.form.gender')} required options={toOptions(TEAM_GENDERS, 'teamGenders')} {...form.field('gender')} />
        <Select label={t('teams.form.coach')} options={coaches.map((c) => ({ value: c.id, label: c.name }))} placeholder={t('teams.noCoach')} {...form.field('coach_id')} />
        <Input label={t('teams.form.homeGround')} {...form.field('home_ground')} />
        <Input label={t('teams.form.founded')} type="number" inputMode="numeric" {...form.field('founded')} />
        <Select label={t('teams.form.status')} required options={toOptions(TEAM_STATUSES, 'status')} {...form.field('status')} />
        <Textarea label={t('teams.form.description')} fieldClassName="sm:col-span-2" rows={3} {...form.field('description')} />
      </form>
    </Modal>
  );
}

function AddPlayersModal({ open, team, teams, onClose, onSubmit }) {
  const { t } = useI18n();
  const [players, setPlayers] = useState([]);
  const [selected, setSelected] = useState([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open || !team) return;
    setSelected([]);
    playerService.options().then((list) => setPlayers(list.filter((p) => p.team_id !== team.id)));
  }, [open, team]);

  const teamName = useMemo(() => Object.fromEntries(teams.map((tm) => [tm.id, tm.name])), [teams]);
  const options = useMemo(
    () =>
      [...players]
        .sort((a, b) => (a.team_id ? 1 : 0) - (b.team_id ? 1 : 0) || a.name.localeCompare(b.name))
        .map((p) => ({
          value: p.id,
          label: p.name,
          description: `${t(`positions.${p.position}`)} · ${p.team_id ? t('teams.addPlayers.currentTeam', { team: teamName[p.team_id] }) : t('teams.addPlayers.free')}`,
          leading: <Avatar name={p.name} src={p.photo} size="sm" />,
        })),
    [players, teamName, t],
  );

  const submit = async () => {
    setBusy(true);
    try {
      await onSubmit(selected);
    } catch {
      /* toast shown */
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={team ? t('teams.addPlayers.title', { name: team.name }) : ''}
      description={t('teams.addPlayers.description')}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} className="w-full sm:w-auto">
            {t('common.cancel')}
          </Button>
          <Button onClick={submit} disabled={!selected.length} loading={busy} className="w-full sm:w-auto">
            {t('teams.addPlayers.submit', { count: selected.length })}
          </Button>
        </>
      }
    >
      <CheckboxList options={options} value={selected} onChange={setSelected} emptyLabel={t('teams.addPlayers.empty')} label={t('teams.actions.addPlayers')} />
    </Modal>
  );
}

/** Team mutations shared by the list and the team page. */
export function useTeamActions({ teams = [], onChanged, onDeleted, showView = true }) {
  const { t } = useI18n();
  const confirm = useConfirm();
  const run = useAction();
  const [modal, setModal] = useState({ type: null, team: null });
  const [coaches, setCoaches] = useState([]);
  const close = () => setModal({ type: null, team: null });

  useEffect(() => {
    if (modal.type === 'form' || modal.type === 'coach') coachService.options().then(setCoaches);
  }, [modal.type]);

  const save = async (values) => {
    if (modal.team) await run(() => teamService.update(modal.team.id, values), { success: 'teams.toasts.updated' });
    else await run(() => teamService.create(values), { success: 'teams.toasts.created' });
    close();
    onChanged?.();
  };

  const toggleStatus = async (team) => {
    if (team.status !== 'active') {
      await run(() => teamService.update(team.id, { status: 'active' }), { success: 'teams.toasts.updated' }).catch(() => {});
      return onChanged?.();
    }
    const ok = await confirm({
      title: t('teams.confirmDeactivate.title', { name: team.name }),
      message: t('teams.confirmDeactivate.message'),
      confirmLabel: t('teams.actions.deactivate'),
      onConfirm: () => run(() => teamService.update(team.id, { status: 'inactive' }), { success: 'teams.toasts.updated' }),
    });
    if (ok) onChanged?.();
  };

  const remove = async (team) => {
    const ok = await confirm({
      title: t('teams.confirmDelete.title', { name: team.name }),
      message: t('teams.confirmDelete.message'),
      confirmLabel: t('teams.actions.delete'),
      onConfirm: () => run(() => teamService.remove(team.id), { success: 'teams.toasts.deleted' }),
    });
    if (ok) (onDeleted ?? onChanged)?.();
  };

  const assignCoach = async (coachId) => {
    await run(() => teamService.assignCoach(modal.team.id, coachId), { success: 'teams.toasts.coachAssigned' });
    close();
    onChanged?.();
  };

  const addPlayers = async (ids) => {
    await run(() => teamService.addPlayers(modal.team.id, ids), { success: t('teams.toasts.playersAdded', { count: ids.length }) });
    close();
    onChanged?.();
  };

  const removePlayer = async (team, player) => {
    const ok = await confirm({
      title: t('teams.confirmRemovePlayer.title', { name: player.name, team: team.name }),
      message: t('teams.confirmRemovePlayer.message'),
      confirmLabel: t('teams.confirmRemovePlayer.confirm'),
      onConfirm: () => run(() => teamService.removePlayer(team.id, player.id), { success: 'teams.toasts.playerRemoved' }),
    });
    if (ok) onChanged?.();
  };

  const actionsFor = (team) => [
    showView && { label: t('teams.actions.view'), icon: Eye, to: `/admin/teams/${team.id}` },
    { label: t('teams.actions.edit'), icon: Pencil, onClick: () => setModal({ type: 'form', team }) },
    { label: t('teams.actions.assignCoach'), icon: UserRoundCog, onClick: () => setModal({ type: 'coach', team }) },
    { label: t('teams.actions.addPlayers'), icon: UserPlus, onClick: () => setModal({ type: 'players', team }) },
    { divider: true },
    { label: team.status === 'active' ? t('teams.actions.deactivate') : t('teams.actions.activate'), icon: Power, onClick: () => toggleStatus(team) },
    { label: t('teams.actions.delete'), icon: Trash2, tone: 'danger', onClick: () => remove(team) },
  ];

  const modals = (
    <>
      <TeamFormModal open={modal.type === 'form'} team={modal.team} coaches={coaches} onClose={close} onSubmit={save} />
      <SelectModal
        open={modal.type === 'coach'}
        title={modal.team ? t('teams.assignCoach.title', { name: modal.team.name }) : ''}
        label={t('teams.assignCoach.label')}
        hint={t('teams.assignCoach.hint')}
        options={coaches.map((c) => ({ value: c.id, label: c.name }))}
        placeholder={t('teams.noCoach')}
        value={modal.team?.coach_id}
        submitLabel={t('teams.assignCoach.submit')}
        onClose={close}
        onSubmit={assignCoach}
      />
      <AddPlayersModal open={modal.type === 'players'} team={modal.team} teams={teams} onClose={close} onSubmit={addPlayers} />
    </>
  );

  return {
    actionsFor,
    modals,
    removePlayer,
    openCreate: () => setModal({ type: 'form', team: null }),
    openEdit: (team) => setModal({ type: 'form', team }),
    openAddPlayers: (team) => setModal({ type: 'players', team }),
  };
}
