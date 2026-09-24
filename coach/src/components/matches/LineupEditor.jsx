import { useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Eraser, LayoutGrid, RotateCcw, Save, UserPlus, X } from 'lucide-react';
import Avatar from '@/components/ui/Avatar';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import { Select } from '@/components/ui/Field';
import { useConfirm } from '@/context/ConfirmContext';
import { useUnsavedChanges } from '@/hooks/useUnsavedChanges';
import { useI18n } from '@/i18n';
import { FORMATIONS, POSITIONS, TEAM_COLOR_VARS } from '@/utils/constants';
import { cn } from '@/utils/cn';

const MAX_BENCH = 9;
const ROLE_POSITION = { GK: 'goalkeeper', DEF: 'defender', MID: 'midfielder', FWD: 'forward' };

/** Slot roles and pitch lines for a formation: GK + defence … attack. */
export function formationLayout(formation) {
  const sizes = String(formation || '4-3-3').split('-').map(Number);
  const roles = ['GK'];
  const lines = [[0]];
  let idx = 1;
  sizes.forEach((size, li) => {
    const role = li === 0 ? 'DEF' : li === sizes.length - 1 ? 'FWD' : 'MID';
    const line = [];
    for (let i = 0; i < size; i += 1) {
      roles.push(role);
      line.push(idx);
      idx += 1;
    }
    lines.push(line);
  });
  return { roles, lines };
}

const pad = (ids = []) => Array.from({ length: 11 }, (_, i) => ids[i] ?? null);
const surname = (name = '') => name.split(' ').slice(-1)[0];

/** Put each starter in a slot matching their position where possible. */
function arrange(slots, roles, byId) {
  const players = slots.filter(Boolean);
  const out = Array(11).fill(null);
  const rest = [];
  players.forEach((pid) => rest.push(pid));
  roles.forEach((role, i) => {
    const idx = rest.findIndex((pid) => byId[pid]?.position === ROLE_POSITION[role]);
    if (idx >= 0) out[i] = rest.splice(idx, 1)[0];
  });
  out.forEach((v, i) => {
    if (!v && rest.length) out[i] = rest.shift();
  });
  return out;
}

export default function LineupEditor({ team, squad, lineup, onSave }) {
  const { t } = useI18n();
  const confirm = useConfirm();
  const byId = useMemo(() => Object.fromEntries(squad.map((p) => [p.id, p])), [squad]);
  const initial = useMemo(() => ({ formation: lineup?.formation ?? '4-3-3', slots: pad(lineup?.starting), bench: lineup?.substitutes ?? [] }), [lineup]);
  const [formation, setFormation] = useState(initial.formation);
  const [slots, setSlots] = useState(initial.slots);
  const [bench, setBench] = useState(initial.bench);
  const [selected, setSelected] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const resetTo = (v) => {
    setFormation(v.formation);
    setSlots(v.slots);
    setBench(v.bench);
    setSelected(null);
    setError(null);
  };
  useEffect(() => resetTo(initial), [initial]);

  const { roles, lines } = formationLayout(formation);
  const dirty = JSON.stringify({ formation, slots, bench }) !== JSON.stringify(initial);
  useUnsavedChanges(dirty);
  const color = TEAM_COLOR_VARS[(team?.color ?? 0) % TEAM_COLOR_VARS.length];
  const starters = slots.filter(Boolean).length;
  const roleLabel = (i) => t(`matches.editor.roles.${roles[i]}`);

  const clickSlot = (i) => {
    setError(null);
    if (selected === null) return setSelected(i);
    if (selected === i) return setSelected(null);
    setSlots((s) => {
      const next = [...s];
      [next[i], next[selected]] = [next[selected], next[i]];
      return next;
    });
    setSelected(null);
  };

  const toXI = (pid) => {
    setError(null);
    const current = slots.indexOf(pid);
    if (current >= 0) {
      if (selected !== null && selected !== current) clickSlot(current);
      return;
    }
    let target = selected;
    if (target === null) {
      target = roles.findIndex((role, i) => !slots[i] && byId[pid]?.position === ROLE_POSITION[role]);
      if (target < 0) target = slots.findIndex((s) => !s);
    }
    if (target < 0) {
      setError(t('matches.editor.errors.full'));
      return;
    }
    setBench((b) => b.filter((x) => x !== pid));
    setSlots((s) => s.map((v, i) => (i === target ? pid : v)));
    setSelected(null);
  };

  const toBench = (pid) => {
    setError(null);
    if (bench.includes(pid)) return;
    if (bench.length >= MAX_BENCH) {
      setError(t('matches.editor.errors.benchFull'));
      return;
    }
    setSlots((s) => s.map((v) => (v === pid ? null : v)));
    setBench((b) => [...b, pid]);
  };

  const remove = async (pid) => {
    const ok = await confirm({
      title: t('matches.editor.confirmRemove.title', { name: byId[pid]?.name }),
      message: t('matches.editor.confirmRemove.message'),
      confirmLabel: t('matches.editor.confirmRemove.confirm'),
    });
    if (!ok) return;
    setSlots((s) => s.map((v) => (v === pid ? null : v)));
    setBench((b) => b.filter((x) => x !== pid));
    setSelected(null);
  };

  const moveBench = (idx, dir) =>
    setBench((b) => {
      const next = [...b];
      const j = idx + dir;
      if (j < 0 || j >= next.length) return b;
      [next[idx], next[j]] = [next[j], next[idx]];
      return next;
    });

  const save = async () => {
    if (starters !== 11) return setError(t('matches.lineup.errors.elevenRequired'));
    if (byId[slots[0]]?.position !== 'goalkeeper' && !slots.some((pid) => byId[pid]?.position === 'goalkeeper')) return setError(t('matches.lineup.errors.goalkeeper'));
    const ordered = byId[slots[0]]?.position === 'goalkeeper' ? slots : arrange(slots, roles, byId);
    setSaving(true);
    try {
      await onSave({ formation, starting: ordered, substitutes: bench });
    } catch {
      /* toast shown by caller */
    } finally {
      setSaving(false);
    }
  };

  const stateOf = (pid) => (slots.includes(pid) ? 'xi' : bench.includes(pid) ? 'sub' : null);

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] xl:grid-cols-[minmax(0,5fr)_minmax(0,4fr)]">
      <div className="min-w-0 space-y-4">
        <div className="flex flex-wrap items-end gap-3">
          <Select label={t('matches.editor.formation')} value={formation} onChange={(e) => setFormation(e.target.value)} options={FORMATIONS.map((f) => ({ value: f, label: f }))} fieldClassName="w-36" />
          <Badge tone={starters === 11 ? 'success' : 'neutral'} className="mb-2.5">
            {t('matches.editor.starting')} {t('matches.editor.count', { count: starters })}
          </Badge>
          <div className="mb-0.5 ml-auto flex gap-2">
            <Button variant="secondary" size="sm" icon={LayoutGrid} onClick={() => setSlots((s) => arrange(s, roles, byId))}>
              {t('matches.editor.autoArrange')}
            </Button>
            <Button variant="ghost" size="sm" icon={Eraser} onClick={() => resetTo({ formation, slots: pad(), bench: [] })}>
              {t('matches.editor.clear')}
            </Button>
          </div>
        </div>
        <p className="text-xs text-ink-3">{selected !== null ? t('matches.editor.pickFor', { role: roleLabel(selected).toLowerCase() }) : t('matches.editor.hint')}</p>

        {/* Pitch */}
        <div className="relative overflow-hidden rounded-2xl bg-[#0f6b4f] px-1 py-4 dark:bg-[#0c4a39] sm:px-3">
          <div className="absolute inset-0" aria-hidden="true" style={{ backgroundImage: 'repeating-linear-gradient(0deg, rgba(255,255,255,0.045) 0 40px, transparent 40px 80px)' }} />
          <svg className="absolute inset-0 size-full" viewBox="0 0 100 140" preserveAspectRatio="none" aria-hidden="true">
            <g fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="0.5" vectorEffect="non-scaling-stroke">
              <rect x="3" y="3" width="94" height="134" />
              <rect x="25" y="113" width="50" height="24" />
              <rect x="38" y="128" width="24" height="9" />
              <path d="M 35 3 A 15 15 0 0 0 65 3" />
            </g>
          </svg>
          <div className="relative flex min-h-[26rem] flex-col-reverse justify-between gap-2 sm:min-h-[30rem]" role="group" aria-label={t('matches.editor.starting')}>
            {lines.map((line, li) => (
              <div key={li} className="flex justify-around gap-0.5">
                {line.map((i) => {
                  const pid = slots[i];
                  const p = pid && byId[pid];
                  const isSel = selected === i;
                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={() => clickSlot(i)}
                      aria-pressed={isSel}
                      aria-label={`${roleLabel(i)}: ${p ? p.name : t('matches.editor.empty')}`}
                      className={cn('flex w-[4.25rem] flex-col items-center rounded-xl py-1 text-center outline-none transition-transform focus-visible:ring-2 focus-visible:ring-white sm:w-20', isSel && 'scale-105')}
                    >
                      <span
                        className={cn(
                          'grid size-11 place-items-center rounded-full border-2 font-display text-base font-bold shadow-md tabular',
                          p ? 'border-white/90 text-white' : 'border-dashed border-white/60 bg-white/10 text-white/80',
                          isSel && 'ring-4 ring-amber-300',
                        )}
                        style={p ? { background: p.position === 'goalkeeper' ? '#111827' : color } : undefined}
                      >
                        {p ? p.jersey_number ?? '–' : <UserPlus className="size-4" aria-hidden="true" />}
                      </span>
                      <span className="mt-1 max-w-full truncate rounded bg-black/35 px-1 text-[11px] font-medium leading-4 text-white">{p ? surname(p.name) : t(`matches.editor.rolesShort.${roles[i]}`)}</span>
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        {/* Bench */}
        <div>
          <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-ink-3">
            {t('matches.editor.bench')}
            <span className="rounded-full bg-surface-3 px-1.5 tabular">{t('matches.editor.benchCount', { count: bench.length, max: MAX_BENCH })}</span>
          </p>
          {bench.length === 0 ? (
            <p className="rounded-xl border border-dashed border-line px-3 py-4 text-center text-sm text-ink-3">{t('matches.editor.empty')}</p>
          ) : (
            <ol className="divide-y divide-line rounded-xl border border-line">
              {bench.map((pid, idx) => {
                const p = byId[pid];
                return (
                  <li key={pid} className="flex items-center gap-2 px-2 py-1.5">
                    <span className="w-7 text-center font-display text-base font-bold text-ink-3 tabular">{p?.jersey_number ?? '–'}</span>
                    <span className="min-w-0 flex-1 truncate text-sm text-ink">{p?.name}</span>
                    <Button variant="ghost" size="icon-sm" onClick={() => moveBench(idx, -1)} disabled={idx === 0} aria-label={`${t('matches.editor.moveUp')} — ${p?.name}`}>
                      <ArrowUp className="size-4" />
                    </Button>
                    <Button variant="ghost" size="icon-sm" onClick={() => moveBench(idx, 1)} disabled={idx === bench.length - 1} aria-label={`${t('matches.editor.moveDown')} — ${p?.name}`}>
                      <ArrowDown className="size-4" />
                    </Button>
                    <Button variant="ghost" size="icon-sm" onClick={() => toXI(pid)} aria-label={`${t('matches.editor.toXI')} — ${p?.name}`}>
                      <UserPlus className="size-4" />
                    </Button>
                    <Button variant="danger-ghost" size="icon-sm" onClick={() => remove(pid)} aria-label={`${t('matches.editor.remove')} — ${p?.name}`}>
                      <X className="size-4" />
                    </Button>
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      </div>

      {/* Squad */}
      <div className="min-w-0">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-3">{t('matches.editor.squad')}</p>
        <div className="space-y-4">
          {POSITIONS.map((pos) => {
            const group = squad.filter((p) => p.position === pos);
            if (!group.length) return null;
            return (
              <div key={pos}>
                <p className="mb-1.5 text-xs font-medium text-ink-3">{t(`positions.${pos}`)}</p>
                <ul className="space-y-1.5">
                  {group.map((p) => {
                    const state = stateOf(p.id);
                    const unavailable = p.status !== 'active';
                    return (
                      <li
                        key={p.id}
                        className={cn(
                          'flex items-center gap-2 rounded-xl border px-2 py-1.5',
                          state === 'xi' && 'border-brand-500 bg-brand-50/70 dark:bg-brand-500/10',
                          state === 'sub' && 'border-sky-400 bg-sky-50/70 dark:border-sky-500/50 dark:bg-sky-500/10',
                          !state && 'border-line',
                        )}
                      >
                        <span className="w-6 text-center font-display text-base font-bold text-ink-3 tabular">{p.jersey_number ?? '–'}</span>
                        <Avatar name={p.name} src={p.photo} size="sm" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium text-ink">{p.name}</span>
                          {unavailable && <span className="text-[11px] font-medium text-red-600 dark:text-red-400">{t(`status.${p.status}`)}</span>}
                        </span>
                        {state === 'xi' && <Badge tone="brand">{t('matches.lineup.starterTag')}</Badge>}
                        {state === 'sub' && <Badge tone="info">{t('matches.lineup.subTag')}</Badge>}
                        {state !== 'xi' && (
                          <Button variant="secondary" size="sm" className="px-2" onClick={() => toXI(p.id)} disabled={unavailable && !state}>
                            {t('matches.lineup.starterTag')}
                          </Button>
                        )}
                        {state !== 'sub' && (
                          <Button variant="ghost" size="sm" className="px-2" onClick={() => toBench(p.id)} disabled={unavailable && !state} aria-label={`${t('matches.editor.toBench')} — ${p.name}`}>
                            {t('matches.lineup.subTag')}
                          </Button>
                        )}
                        {state && (
                          <Button variant="danger-ghost" size="icon-sm" onClick={() => remove(p.id)} aria-label={`${t('matches.editor.remove')} — ${p.name}`}>
                            <X className="size-4" />
                          </Button>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </div>
      </div>

      {/* Sticky save bar */}
      <div className="sticky bottom-[4.5rem] z-10 -mx-4 flex flex-col gap-2 border-t border-line bg-surface/95 px-4 py-3 backdrop-blur sm:-mx-5 sm:flex-row sm:items-center sm:justify-between sm:px-5 md:bottom-0 lg:col-span-2">
        <p className={cn('text-sm', error ? 'font-medium text-red-600 dark:text-red-400' : dirty ? 'font-medium text-amber-600 dark:text-amber-400' : 'text-ink-3')} role={error ? 'alert' : undefined}>
          {error ?? (dirty ? t('matches.editor.unsaved') : t('matches.editor.hint'))}
        </p>
        <div className="flex gap-2">
          <Button variant="secondary" icon={RotateCcw} onClick={() => resetTo(initial)} disabled={!dirty || saving} className="flex-1 sm:flex-none">
            {t('matches.editor.reset')}
          </Button>
          <Button
            icon={Save}
            loading={saving}
            disabled={!dirty}
            onClick={save}
            className="flex-1 sm:flex-none"
          >
            {t('matches.editor.save')}
          </Button>
        </div>
      </div>
    </div>
  );
}
