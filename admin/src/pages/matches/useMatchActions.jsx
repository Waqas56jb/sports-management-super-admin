import { useEffect, useMemo, useState } from 'react';
import { Eye, Pencil, Trash2 } from 'lucide-react';
import Button from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/Field';
import Modal from '@/components/ui/Modal';
import { useConfirm } from '@/context/ConfirmContext';
import { useAction } from '@/hooks/useAction';
import { useForm } from '@/hooks/useForm';
import { useOptions } from '@/hooks/useOptions';
import { useI18n } from '@/i18n';
import { matchService } from '@/services/matchService';
import { teamService } from '@/services/teamService';
import { MATCH_STATUSES } from '@/utils/constants';
import { notEqual, numberRange, required } from '@/utils/validators';

const SCHEMA = {
  home_team_id: [required],
  away_team_id: [required, notEqual('home_team_id', 'matches.errors.sameTeam')],
  date: [required],
  time: [required],
  location: [required],
  status: [required],
  round: [numberRange(1, 60)],
};
const BLANK = { competition_id: '', home_team_id: '', away_team_id: '', date: '', time: '17:00', location: '', referee: '', status: 'scheduled', round: '' };

function MatchFormModal({ open, match, defaults, competitions, onClose, onSubmit }) {
  const { t } = useI18n();
  const toOptions = useOptions();
  const [teams, setTeams] = useState([]);
  const form = useForm({ initial: BLANK, schema: SCHEMA, onSubmit });
  const { reset, values, setValue } = form;

  useEffect(() => {
    if (!open) return;
    teamService.list({ pageSize: 'all' }).then((r) => setTeams(r.data));
    reset(match ? Object.fromEntries(Object.keys(BLANK).map((k) => [k, match[k] ?? BLANK[k]])) : { ...BLANK, ...defaults });
  }, [open, match, defaults, reset]);

  // Pre-fill the venue with the home ground when the home team changes (unless edited manually).
  const [locationTouched, setLocationTouched] = useState(false);
  useEffect(() => setLocationTouched(!!match), [open, match]);
  useEffect(() => {
    if (locationTouched || !values.home_team_id) return;
    const ground = teams.find((tm) => tm.id === values.home_team_id)?.home_ground;
    if (ground) setValue('location', ground);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [values.home_team_id, teams]);

  const competition = competitions.find((c) => c.id === values.competition_id);
  const teamOptions = useMemo(
    () =>
      teams
        .filter((tm) => tm.status === 'active' || tm.id === match?.home_team_id || tm.id === match?.away_team_id)
        .filter((tm) => !competition || competition.team_ids.includes(tm.id))
        .map((tm) => ({ value: tm.id, label: tm.name })),
    [teams, competition, match],
  );

  const locationField = form.field('location');

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={match ? t('matches.form.editTitle') : t('matches.form.createTitle')}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} className="w-full sm:w-auto">
            {t('common.cancel')}
          </Button>
          <Button type="submit" form="match-form" loading={form.submitting} className="w-full sm:w-auto">
            {match ? t('common.saveChanges') : t('matches.form.create')}
          </Button>
        </>
      }
    >
      <form id="match-form" ref={form.formRef} onSubmit={form.handleSubmit} noValidate className="grid gap-4 sm:grid-cols-2">
        <Select
          label={t('matches.form.competition')}
          options={competitions.filter((c) => c.status !== 'completed' || c.id === match?.competition_id).map((c) => ({ value: c.id, label: `${c.name} ${c.season}` }))}
          placeholder={t('matches.friendly')}
          fieldClassName="sm:col-span-2"
          {...form.field('competition_id')}
        />
        <Select label={t('matches.form.homeTeam')} required options={teamOptions} placeholder={t('common.notSet')} {...form.field('home_team_id')} />
        <Select label={t('matches.form.awayTeam')} required options={teamOptions} placeholder={t('common.notSet')} {...form.field('away_team_id')} />
        <Input label={t('matches.form.date')} type="date" required {...form.field('date')} />
        <Input label={t('matches.form.time')} type="time" required {...form.field('time')} />
        <Input
          label={t('matches.form.location')}
          hint={t('matches.form.locationHint')}
          required
          fieldClassName="sm:col-span-2"
          {...locationField}
          onChange={(e) => {
            setLocationTouched(true);
            locationField.onChange(e);
          }}
        />
        <Input label={t('matches.form.referee')} placeholder={t('matches.form.refereePlaceholder')} {...form.field('referee')} />
        <Input label={t('matches.form.round')} type="number" inputMode="numeric" min={1} {...form.field('round')} />
        {match && <Select label={t('matches.form.status')} required options={toOptions(MATCH_STATUSES, 'status')} {...form.field('status')} />}
      </form>
    </Modal>
  );
}

/** Create / edit / delete for matches, shared by the list and the match centre. */
export function useMatchActions({ competitions, onChanged, onDeleted, showView = true }) {
  const { t } = useI18n();
  const confirm = useConfirm();
  const run = useAction();
  const [modal, setModal] = useState({ open: false, match: null, defaults: null });
  const close = () => setModal({ open: false, match: null, defaults: null });

  const save = async (values) => {
    const payload = { ...values, round: values.round === '' ? null : Number(values.round) };
    if (modal.match) await run(() => matchService.update(modal.match.id, payload), { success: 'matches.toasts.updated' });
    else await run(() => matchService.create(payload), { success: 'matches.toasts.created' });
    close();
    onChanged?.();
  };

  const remove = async (m) => {
    const ok = await confirm({
      title: t('matches.confirmDelete.title'),
      message: t('matches.confirmDelete.message', { home: m.home_team?.name, away: m.away_team?.name }),
      confirmLabel: t('matches.actions.delete'),
      onConfirm: () => run(() => matchService.remove(m.id), { success: 'matches.toasts.deleted' }),
    });
    if (ok) (onDeleted ?? onChanged)?.();
  };

  const actionsFor = (m) => [
    showView && { label: t('matches.actions.view'), icon: Eye, to: `/admin/matches/${m.id}` },
    { label: t('matches.actions.edit'), icon: Pencil, onClick: () => setModal({ open: true, match: m }) },
    { divider: true },
    { label: t('matches.actions.delete'), icon: Trash2, tone: 'danger', onClick: () => remove(m) },
  ];

  const modals = <MatchFormModal open={modal.open} match={modal.match} defaults={modal.defaults} competitions={competitions} onClose={close} onSubmit={save} />;
  return {
    actionsFor,
    modals,
    openCreate: (defaults = {}) => setModal({ open: true, match: null, defaults }),
    openEdit: (m) => setModal({ open: true, match: m }),
  };
}
