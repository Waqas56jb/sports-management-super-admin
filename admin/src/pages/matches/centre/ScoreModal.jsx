import { useEffect } from 'react';
import { Info } from 'lucide-react';
import Button from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/Field';
import Modal from '@/components/ui/Modal';
import { useForm } from '@/hooks/useForm';
import { useOptions } from '@/hooks/useOptions';
import { useI18n } from '@/i18n';
import { MATCH_STATUSES } from '@/utils/constants';
import { numberRange, required } from '@/utils/validators';

const SCHEMA = {
  status: [required],
  live_minute: [(v, values) => (values.status === 'live' ? required(v) : null), numberRange(1, 130)],
  home_score: [numberRange(0, 30)],
  away_score: [numberRange(0, 30)],
};

export default function ScoreModal({ open, match, onClose, onSubmit }) {
  const { t } = useI18n();
  const toOptions = useOptions();
  const form = useForm({ initial: { status: 'scheduled', live_minute: '', home_score: '0', away_score: '0' }, schema: SCHEMA, onSubmit });
  const { reset } = form;
  const locked = match?.events?.some((e) => e.event_type === 'goal');

  useEffect(() => {
    if (open && match) {
      reset({ status: match.status, live_minute: match.live_minute ? String(match.live_minute) : '', home_score: String(match.home_score ?? 0), away_score: String(match.away_score ?? 0) });
    }
  }, [open, match, reset]);

  const showScores = form.values.status === 'live' || form.values.status === 'completed';

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="sm"
      title={t('matches.score.title')}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} className="w-full sm:w-auto">
            {t('common.cancel')}
          </Button>
          <Button type="submit" form="score-form" loading={form.submitting} className="w-full sm:w-auto">
            {t('matches.score.submit')}
          </Button>
        </>
      }
    >
      <form id="score-form" ref={form.formRef} onSubmit={form.handleSubmit} noValidate className="grid grid-cols-2 gap-4">
        <Select label={t('matches.score.status')} required options={toOptions(MATCH_STATUSES, 'status')} fieldClassName="col-span-2" {...form.field('status')} />
        {form.values.status === 'live' && <Input label={t('matches.score.minute')} type="number" inputMode="numeric" min={1} max={130} required fieldClassName="col-span-2" {...form.field('live_minute')} />}
        {showScores && (
          <>
            <Input label={t('matches.score.home', { team: match?.home_team?.short_name })} type="number" inputMode="numeric" min={0} disabled={locked} {...form.field('home_score')} />
            <Input label={t('matches.score.away', { team: match?.away_team?.short_name })} type="number" inputMode="numeric" min={0} disabled={locked} {...form.field('away_score')} />
            {locked && (
              <p className="col-span-2 flex gap-2 rounded-xl bg-surface-2 p-3 text-xs text-ink-2">
                <Info className="mt-0.5 size-4 shrink-0 text-ink-3" aria-hidden="true" />
                {t('matches.score.lockedHint')}
              </p>
            )}
          </>
        )}
      </form>
    </Modal>
  );
}
