import { useEffect, useMemo, useState } from 'react';
import { AlertCircle } from 'lucide-react';
import Avatar from '@/components/ui/Avatar';
import Button from '@/components/ui/Button';
import { Select } from '@/components/ui/Field';
import Modal from '@/components/ui/Modal';
import { useI18n } from '@/i18n';
import { FORMATIONS, POSITIONS } from '@/utils/constants';
import { cn } from '@/utils/cn';
import PitchView from './PitchView';

const MAX_SUBS = 9;

/**
 * Line-up builder: tap a player to cycle Starting XI → Substitute → not selected.
 * A live pitch preview shows the chosen formation.
 */
export default function LineupModal({ open, team, squad, lineup, onClose, onSubmit }) {
  const { t } = useI18n();
  const [formation, setFormation] = useState('4-3-3');
  const [starting, setStarting] = useState([]);
  const [subs, setSubs] = useState([]);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setFormation(lineup?.formation ?? '4-3-3');
    setStarting(lineup?.starting ?? []);
    setSubs(lineup?.substitutes ?? []);
    setError(null);
  }, [open, lineup]);

  const selectable = useMemo(() => squad.filter((p) => p.status === 'active' || starting.includes(p.id) || subs.includes(p.id)), [squad, starting, subs]);

  const cycle = (id) => {
    setError(null);
    if (starting.includes(id)) {
      setStarting((s) => s.filter((x) => x !== id));
      if (subs.length < MAX_SUBS) setSubs((s) => [...s, id]);
    } else if (subs.includes(id)) {
      setSubs((s) => s.filter((x) => x !== id));
    } else if (starting.length < 11) {
      setStarting((s) => [...s, id]);
    } else if (subs.length < MAX_SUBS) {
      setSubs((s) => [...s, id]);
    }
  };

  const submit = async () => {
    if (starting.length !== 11) return setError(t('matches.lineup.errors.elevenRequired'));
    if (!squad.some((p) => starting.includes(p.id) && p.position === 'goalkeeper')) return setError(t('matches.lineup.errors.goalkeeper'));
    setBusy(true);
    try {
      await onSubmit({ formation, starting, substitutes: subs });
    } catch {
      /* toast shown */
    } finally {
      setBusy(false);
    }
  };

  const starters = squad.filter((p) => starting.includes(p.id));

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="xl"
      title={t('matches.lineup.title', { team: team?.name })}
      description={t('matches.lineup.hint')}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} className="w-full sm:w-auto">
            {t('common.cancel')}
          </Button>
          <Button onClick={submit} loading={busy} className="w-full sm:w-auto">
            {t('matches.lineup.save')}
          </Button>
        </>
      }
    >
      <div className="grid gap-5 md:grid-cols-[1fr_280px]">
        <div className="space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <Select label={t('matches.lineup.formation')} value={formation} onChange={(e) => setFormation(e.target.value)} options={FORMATIONS.map((f) => ({ value: f, label: f }))} fieldClassName="w-40" />
            <div className="flex gap-2 text-xs font-medium">
              <span className={cn('rounded-full px-2.5 py-1 tabular', starting.length === 11 ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300' : 'bg-surface-3 text-ink-2')}>
                {t('matches.lineup.selectStarting', { count: starting.length })}
              </span>
              <span className="rounded-full bg-surface-3 px-2.5 py-1 text-ink-2 tabular">{t('matches.lineup.selectSubs', { count: subs.length, max: MAX_SUBS })}</span>
            </div>
          </div>
          {error && (
            <p role="alert" className="flex items-center gap-2 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300">
              <AlertCircle className="size-4 shrink-0" aria-hidden="true" />
              {error}
            </p>
          )}
          {POSITIONS.map((pos) => {
            const group = selectable.filter((p) => p.position === pos);
            if (!group.length) return null;
            return (
              <div key={pos}>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-3">{t(`positions.${pos}`)}</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {group.map((p) => {
                    const state = starting.includes(p.id) ? 'xi' : subs.includes(p.id) ? 'sub' : null;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => cycle(p.id)}
                        aria-pressed={!!state}
                        className={cn(
                          'flex min-h-12 items-center gap-3 rounded-xl border px-3 py-2 text-left transition-colors',
                          state === 'xi' && 'border-brand-500 bg-brand-50 ring-1 ring-brand-500 dark:bg-brand-500/10',
                          state === 'sub' && 'border-sky-400 bg-sky-50 dark:border-sky-500/50 dark:bg-sky-500/10',
                          !state && 'border-line hover:bg-surface-2',
                        )}
                      >
                        <span className="w-6 text-center font-display text-lg font-bold text-ink-3 tabular">{p.jersey_number ?? '–'}</span>
                        <Avatar name={p.name} src={p.photo} size="sm" />
                        <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink">{p.name}</span>
                        {state && (
                          <span className={cn('rounded-md px-1.5 py-0.5 text-[10px] font-bold', state === 'xi' ? 'bg-brand-600 text-white dark:bg-brand-500 dark:text-brand-950' : 'bg-sky-600 text-white')}>
                            {state === 'xi' ? t('matches.lineup.starterTag') : t('matches.lineup.subTag')}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
        <div className="md:sticky md:top-0 md:self-start">
          <PitchView formation={formation} starters={starters} team={team} />
        </div>
      </div>
    </Modal>
  );
}
