import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { CornerDownLeft, Dumbbell, Goal, Search, SearchX, Shield, Shirt, Trophy, X } from 'lucide-react';
import TeamLogo from '@/components/common/TeamLogo';
import Avatar from '@/components/ui/Avatar';
import Spinner from '@/components/ui/Spinner';
import { StatusBadge } from '@/components/ui/Badge';
import { useDebounce } from '@/hooks/useDebounce';
import { useI18n } from '@/i18n';
import { searchService } from '@/services/searchService';
import { formatRelativeDay, formatShortDate } from '@/utils/format';
import { cn } from '@/utils/cn';

const GROUPS = [
  { key: 'players', icon: Shirt },
  { key: 'teams', icon: Shield },
  { key: 'matches', icon: Goal },
  { key: 'training', icon: Dumbbell },
  { key: 'competitions', icon: Trophy },
];

/** Command-palette style global search (Ctrl/⌘ + K), results grouped by type. */
export default function GlobalSearch({ open, onClose }) {
  const { t, lang } = useI18n();
  const navigate = useNavigate();
  const inputRef = useRef(null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0);
  const debounced = useDebounce(query, 200);

  useEffect(() => {
    if (!open) return undefined;
    setQuery('');
    setResults(null);
    const prev = document.activeElement;
    document.body.style.overflow = 'hidden';
    requestAnimationFrame(() => inputRef.current?.focus());
    return () => {
      document.body.style.overflow = '';
      if (prev instanceof HTMLElement) prev.focus();
    };
  }, [open]);

  useEffect(() => {
    let cancelled = false;
    if (debounced.trim().length < 2) {
      setResults(null);
      return undefined;
    }
    setLoading(true);
    searchService
      .global(debounced, { trainingLabel: (type) => t(`trainingTypes.${type}`) })
      .then((r) => !cancelled && setResults(r))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced]);

  const flat = useMemo(() => {
    if (!results) return [];
    return GROUPS.flatMap((g) =>
      results[g.key].map((item) => {
        const base = { group: g.key, item };
        if (g.key === 'players') return { ...base, to: `/coach/players/${item.id}` };
        if (g.key === 'training') return { ...base, to: `/coach/training/${item.id}` };
        if (g.key === 'teams') return { ...base, to: `/coach/teams/${item.id}` };
        if (g.key === 'matches') return { ...base, to: `/coach/matches/${item.id}` };
        return { ...base, to: `/coach/competitions/${item.id}` };
      }),
    );
  }, [results]);

  useEffect(() => setActive(0), [results]);

  if (!open) return null;

  const go = (entry) => {
    onClose();
    navigate(entry.to);
  };

  const onKeyDown = (e) => {
    if (e.key === 'Escape') onClose();
    if (!flat.length) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((a) => (a + 1) % flat.length);
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => (a - 1 + flat.length) % flat.length);
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      go(flat[active]);
    }
  };

  const renderItem = (entry) => {
    const { group, item } = entry;
    if (group === 'players')
      return (
        <>
          <Avatar name={item.name} src={item.photo} size="sm" />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium text-ink">{item.name}</span>
            <span className="block truncate text-xs text-ink-3">
              {t(`positions.${item.position}`)}
              {item.jersey_number ? ` · #${item.jersey_number}` : ''}
              {item.team ? ` · ${item.team.name}` : ''}
            </span>
          </span>
        </>
      );
    if (group === 'training')
      return (
        <>
          <span className="grid size-8 place-items-center rounded-lg bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-300">
            <Dumbbell className="size-4" aria-hidden="true" />
          </span>
          <span className="min-w-0 flex-1">
            <span className={cn('block truncate text-sm font-medium text-ink', item.status === 'cancelled' && 'line-through opacity-70')}>
              {t(`trainingTypes.${item.training_type}`)} — {item.team?.name}
            </span>
            <span className="block truncate text-xs capitalize text-ink-3">
              {formatRelativeDay(item.date, lang, t)} · {item.start_time}
            </span>
          </span>
          {item.status === 'cancelled' && <StatusBadge value="cancelled" />}
        </>
      );
    if (group === 'teams')
      return (
        <>
          <TeamLogo team={item} size="sm" />
          <span className="flex-1 truncate text-sm font-medium text-ink">{item.name}</span>
        </>
      );
    if (group === 'matches')
      return (
        <>
          <span className="flex -space-x-1.5">
            <TeamLogo team={item.home_team} size="sm" />
            <TeamLogo team={item.away_team} size="sm" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium text-ink">
              {item.home_team?.name} {t('matches.vs')} {item.away_team?.name}
            </span>
            <span className="block truncate text-xs text-ink-3">
              {formatShortDate(item.date, lang)}
              {item.home_score !== null ? ` · ${item.home_score}–${item.away_score}` : ''}
            </span>
          </span>
        </>
      );
    return (
      <>
        <span className="grid size-8 place-items-center rounded-lg bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
          <Trophy className="size-4" aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-ink">{item.name}</span>
          <span className="block truncate text-xs text-ink-3">{item.season}</span>
        </span>
        <StatusBadge value={item.status} />
      </>
    );
  };

  let index = -1;
  return createPortal(
    <div className="fixed inset-0 z-50 flex justify-center sm:items-start sm:p-6 sm:pt-[12vh]">
      <div className="absolute inset-0 animate-fade-in bg-slate-950/50 backdrop-blur-[2px]" onClick={onClose} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t('search.title')}
        className="relative flex h-full w-full animate-slide-up flex-col overflow-hidden bg-surface sm:h-auto sm:max-h-[70vh] sm:max-w-2xl sm:rounded-2xl sm:border sm:border-line sm:shadow-(--shadow-pop)"
        onKeyDown={onKeyDown}
      >
        <div className="flex items-center gap-3 border-b border-line px-4">
          <Search className="size-5 shrink-0 text-ink-3" aria-hidden="true" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('search.placeholder')}
            className="h-14 min-w-0 flex-1 bg-transparent text-base text-ink outline-none placeholder:text-ink-3"
            role="combobox"
            aria-label={t('search.title')}
            aria-expanded={flat.length > 0}
            aria-controls="global-search-results"
            aria-activedescendant={flat.length ? `gs-${active}` : undefined}
            aria-autocomplete="list"
          />
          {loading && <Spinner className="size-4 text-ink-3" />}
          <button type="button" onClick={onClose} className="grid size-10 place-items-center rounded-lg text-ink-3 hover:bg-surface-3 hover:text-ink" aria-label={t('common.close')}>
            <X className="size-5" />
          </button>
        </div>

        <div id="global-search-results" role="listbox" className="min-h-0 flex-1 overflow-y-auto p-2 scrollbar-thin">
          {!results && (
            <div className="px-4 py-10 text-center">
              <p className="text-sm text-ink-2">{t('search.hint')}</p>
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                {GROUPS.map(({ key, icon: Icon }) => (
                  <span key={key} className="inline-flex items-center gap-1.5 rounded-full bg-surface-3 px-3 py-1 text-xs text-ink-2">
                    <Icon className="size-3.5" aria-hidden="true" />
                    {t(`search.groups.${key}`)}
                  </span>
                ))}
              </div>
            </div>
          )}
          {results && flat.length === 0 && !loading && (
            <div className="flex flex-col items-center px-4 py-12 text-center">
              <SearchX className="size-8 text-ink-3" aria-hidden="true" />
              <p className="mt-3 text-sm font-medium text-ink">{t('search.noResults', { query: debounced })}</p>
              <p className="mt-1 text-xs text-ink-3">{t('search.noResultsHint')}</p>
            </div>
          )}
          {results &&
            GROUPS.filter((g) => results[g.key].length).map((g) => (
              <div key={g.key} className="mb-2" role="group" aria-label={t(`search.groups.${g.key}`)}>
                <p className="px-3 pb-1 pt-2 text-xs font-semibold uppercase tracking-wide text-ink-3">{t(`search.groups.${g.key}`)}</p>
                {results[g.key].map(() => {
                  index += 1;
                  const i = index;
                  const entry = flat[i];
                  return (
                    <button
                      key={`${entry.group}-${entry.item.id}`}
                      id={`gs-${i}`}
                      type="button"
                      role="option"
                      aria-selected={active === i}
                      onMouseMove={() => setActive(i)}
                      onClick={() => go(entry)}
                      className={cn('flex min-h-12 w-full items-center gap-3 rounded-xl px-3 py-2 text-left', active === i && 'bg-surface-3')}
                    >
                      {renderItem(entry)}
                      {active === i && <CornerDownLeft className="hidden size-4 shrink-0 text-ink-3 sm:block" aria-hidden="true" />}
                    </button>
                  );
                })}
              </div>
            ))}
        </div>
      </div>
    </div>,
    document.body,
  );
}
