import { useEffect, useMemo } from 'react';
import TeamLogo from '@/components/common/TeamLogo';
import Button from '@/components/ui/Button';
import { Input, Select, Textarea } from '@/components/ui/Field';
import Modal from '@/components/ui/Modal';
import { useForm } from '@/hooks/useForm';
import { useI18n } from '@/i18n';
import { MATCH_EVENT_TYPES } from '@/utils/constants';
import { cn } from '@/utils/cn';
import { maxLength, notEqual, numberRange, required } from '@/utils/validators';

const BLANK = { event_type: 'goal', side: 'home', player_id: '', related_player_id: '', assist_player_id: '', minute: '', description: '' };

/** Record a goal / assist / card / substitution. Player lists come from the side's line-up or squad. */
export default function EventModal({ open, match, onClose, onSubmit }) {
  const { t } = useI18n();
  const schema = useMemo(
    () => ({
      player_id: [required],
      minute: [required, numberRange(1, 130)],
      related_player_id: [(v, values) => (values.event_type === 'substitution' ? required(v) : null), notEqual('player_id', 'matches.event.samePlayer')],
      assist_player_id: [notEqual('player_id', 'matches.event.samePlayer')],
      description: [maxLength(140)],
    }),
    [],
  );
  const form = useForm({ initial: BLANK, schema, onSubmit });
  const { reset, values, setValue } = form;

  useEffect(() => {
    if (open) reset({ ...BLANK, minute: match?.status === 'live' ? String(match.live_minute ?? '') : '' });
  }, [open, match, reset]);

  const side = values.side;
  const team = side === 'home' ? match?.home_team : match?.away_team;
  const lineup = match?.lineups?.[side];
  const squad = useMemo(() => match?.squads?.[side] ?? [], [match, side]);

  // Prefer players in the line-up; fall back to the whole squad when no line-up was set.
  const involved = useMemo(() => {
    if (!lineup) return squad;
    const ids = new Set([...lineup.starting, ...lineup.substitutes]);
    const inLineup = squad.filter((p) => ids.has(p.id));
    return inLineup.length ? inLineup : squad;
  }, [lineup, squad]);

  const option = (p) => ({ value: p.id, label: `${p.jersey_number ? `#${p.jersey_number} ` : ''}${p.name}` });
  const playerOptions = involved.map(option);
  const benchOptions = (lineup ? squad.filter((p) => lineup.substitutes.includes(p.id) || !lineup.starting.includes(p.id)) : squad).filter((p) => p.id !== values.player_id).map(option);
  const assistOptions = involved.filter((p) => p.id !== values.player_id).map(option);

  const changeSide = (next) => {
    if (next === side) return;
    setValue('side', next);
    setValue('player_id', '');
    setValue('related_player_id', '');
    setValue('assist_player_id', '');
  };

  const type = values.event_type;
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('matches.event.title')}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} className="w-full sm:w-auto">
            {t('common.cancel')}
          </Button>
          <Button type="submit" form="event-form" loading={form.submitting} className="w-full sm:w-auto">
            {t('matches.event.submit')}
          </Button>
        </>
      }
    >
      <form id="event-form" ref={form.formRef} onSubmit={form.handleSubmit} noValidate className="grid gap-4 sm:grid-cols-2">
        <fieldset className="sm:col-span-2">
          <legend className="mb-1.5 text-sm font-medium text-ink">{t('matches.event.type')}</legend>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            {MATCH_EVENT_TYPES.map((et) => (
              <label key={et} className={cn('flex min-h-11 cursor-pointer items-center justify-center rounded-xl border px-2 text-center text-sm font-medium transition-colors', type === et ? 'border-brand-500 bg-brand-50 text-brand-800 ring-1 ring-brand-500 dark:bg-brand-500/10 dark:text-brand-200' : 'border-line text-ink-2 hover:bg-surface-2')}>
                <input type="radio" name="event_type" value={et} checked={type === et} onChange={() => setValue('event_type', et)} className="sr-only" />
                {t(`eventTypes.${et}`)}
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset className="sm:col-span-2">
          <legend className="mb-1.5 text-sm font-medium text-ink">{t('matches.event.team')}</legend>
          <div className="grid grid-cols-2 gap-2">
            {['home', 'away'].map((s) => {
              const tm = s === 'home' ? match?.home_team : match?.away_team;
              return (
                <label key={s} className={cn('flex min-h-12 cursor-pointer items-center gap-2 rounded-xl border px-3 text-sm font-medium transition-colors', side === s ? 'border-brand-500 bg-brand-50 text-ink ring-1 ring-brand-500 dark:bg-brand-500/10' : 'border-line text-ink-2 hover:bg-surface-2')}>
                  <input type="radio" name="side" value={s} checked={side === s} onChange={() => changeSide(s)} className="sr-only" />
                  <TeamLogo team={tm} size="sm" />
                  <span className="truncate">{tm?.name}</span>
                </label>
              );
            })}
          </div>
        </fieldset>

        <Select
          label={type === 'substitution' ? t('matches.event.playerOff') : t('matches.event.player')}
          required
          options={playerOptions}
          placeholder={team?.name ?? ''}
          fieldClassName={type === 'substitution' || type === 'goal' ? '' : 'sm:col-span-2'}
          {...form.field('player_id')}
        />
        {type === 'substitution' && <Select label={t('matches.event.playerOn')} required options={benchOptions} placeholder={t('common.notSet')} {...form.field('related_player_id')} />}
        {type === 'goal' && <Select label={t('matches.event.assist')} options={assistOptions} placeholder={t('matches.event.noAssist')} {...form.field('assist_player_id')} />}
        <Input label={t('matches.event.minute')} type="number" inputMode="numeric" min={1} max={130} required {...form.field('minute')} />
        <Textarea label={t('matches.event.description')} placeholder={t('matches.event.descriptionPlaceholder')} rows={2} fieldClassName="sm:col-span-2" {...form.field('description')} />
      </form>
    </Modal>
  );
}
