import { useEffect, useMemo, useState } from 'react';
import { Eye, Pencil, Trash2 } from 'lucide-react';
import TeamLogo from '@/components/common/TeamLogo';
import Button from '@/components/ui/Button';
import CheckboxList from '@/components/ui/CheckboxList';
import { Field, Input, Select, Textarea } from '@/components/ui/Field';
import Modal from '@/components/ui/Modal';
import { useConfirm } from '@/context/ConfirmContext';
import { useAction } from '@/hooks/useAction';
import { useForm } from '@/hooks/useForm';
import { useOptions } from '@/hooks/useOptions';
import { useI18n } from '@/i18n';
import { competitionService } from '@/services/competitionService';
import { COMPETITION_STATUSES, COMPETITION_TYPES } from '@/utils/constants';
import { onOrAfter, maxLength, minLength, required } from '@/utils/validators';

const minTeams = (v) => (!v || v.length < 2 ? { key: 'validation.minTeams' } : null);
const SCHEMA = {
  name: [required, minLength(3), maxLength(80)],
  type: [required],
  season: [required, maxLength(12)],
  start_date: [required],
  end_date: [required, onOrAfter('start_date')],
  location: [required],
  team_ids: [minTeams],
  status: [required],
};
const BLANK = { name: '', type: 'league', season: '', start_date: '', end_date: '', location: '', team_ids: [], status: 'upcoming', description: '' };

function CompetitionFormModal({ open, competition, teams, onClose, onSubmit }) {
  const { t } = useI18n();
  const toOptions = useOptions();
  const form = useForm({ initial: BLANK, schema: SCHEMA, onSubmit });
  const { reset } = form;

  useEffect(() => {
    if (open) reset(competition ? Object.fromEntries(Object.keys(BLANK).map((k) => [k, competition[k] ?? BLANK[k]])) : BLANK);
  }, [open, competition, reset]);

  const teamOptions = useMemo(() => teams.map((tm) => ({ value: tm.id, label: tm.name, leading: <TeamLogo team={tm} size="sm" /> })), [teams]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={competition ? t('competitions.form.editTitle') : t('competitions.form.createTitle')}
      description={competition ? undefined : t('competitions.form.createDescription')}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} className="w-full sm:w-auto">
            {t('common.cancel')}
          </Button>
          <Button type="submit" form="competition-form" loading={form.submitting} className="w-full sm:w-auto">
            {competition ? t('common.saveChanges') : t('competitions.form.create')}
          </Button>
        </>
      }
    >
      <form id="competition-form" ref={form.formRef} onSubmit={form.handleSubmit} noValidate className="grid gap-4 sm:grid-cols-2">
        <Input label={t('competitions.form.name')} placeholder={t('competitions.form.namePlaceholder')} required fieldClassName="sm:col-span-2" {...form.field('name')} />
        <Select label={t('competitions.form.type')} required options={toOptions(COMPETITION_TYPES, 'competitionTypes')} {...form.field('type')} />
        <Input label={t('competitions.form.season')} required hint={t('competitions.form.seasonHint')} {...form.field('season')} />
        <Input label={t('competitions.form.startDate')} type="date" required {...form.field('start_date')} />
        <Input label={t('competitions.form.endDate')} type="date" required min={form.values.start_date || undefined} {...form.field('end_date')} />
        <Input label={t('competitions.form.location')} placeholder={t('competitions.form.locationPlaceholder')} required {...form.field('location')} />
        <Select label={t('competitions.form.status')} required options={toOptions(COMPETITION_STATUSES, 'status')} {...form.field('status')} />
        <Field id="f-team_ids" label={t('competitions.form.teams')} required error={form.errors.team_ids} hint={t('competitions.form.teamsSelected', { count: form.values.team_ids.length })} className="sm:col-span-2">
          <CheckboxList options={teamOptions} value={form.values.team_ids} onChange={(v) => form.setValue('team_ids', v)} searchable={false} maxHeight="max-h-64" label={t('competitions.form.teams')} />
        </Field>
        <Textarea label={t('competitions.form.description')} rows={3} fieldClassName="sm:col-span-2" {...form.field('description')} />
      </form>
    </Modal>
  );
}

export function useCompetitionActions({ teams, onChanged, onDeleted, showView = true }) {
  const { t } = useI18n();
  const confirm = useConfirm();
  const run = useAction();
  const [modal, setModal] = useState({ open: false, competition: null });
  const close = () => setModal({ open: false, competition: null });

  const save = async (values) => {
    if (modal.competition) await run(() => competitionService.update(modal.competition.id, values), { success: 'competitions.toasts.updated' });
    else await run(() => competitionService.create(values), { success: 'competitions.toasts.created' });
    close();
    onChanged?.();
  };

  const remove = async (c) => {
    const ok = await confirm({
      title: t('competitions.confirmDelete.title', { name: `${c.name} ${c.season}` }),
      message: t('competitions.confirmDelete.message'),
      confirmLabel: t('competitions.actions.delete'),
      onConfirm: () => run(() => competitionService.remove(c.id), { success: 'competitions.toasts.deleted' }),
    });
    if (ok) (onDeleted ?? onChanged)?.();
  };

  const actionsFor = (c) => [
    showView && { label: t('competitions.actions.view'), icon: Eye, to: `/admin/competitions/${c.id}` },
    { label: t('competitions.actions.edit'), icon: Pencil, onClick: () => setModal({ open: true, competition: c }) },
    { divider: true },
    { label: t('competitions.actions.delete'), icon: Trash2, tone: 'danger', onClick: () => remove(c) },
  ];

  const modals = <CompetitionFormModal open={modal.open} competition={modal.competition} teams={teams} onClose={close} onSubmit={save} />;
  return { actionsFor, modals, openCreate: () => setModal({ open: true, competition: null }), openEdit: (c) => setModal({ open: true, competition: c }) };
}
