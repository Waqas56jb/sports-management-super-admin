import { useMemo, useState } from 'react';
import { Check } from 'lucide-react';
import { useI18n } from '@/i18n';
import { normalize } from '@/utils/text';
import { cn } from '@/utils/cn';
import { EmptyState } from './States';
import SearchInput from './SearchInput';

/**
 * Searchable multi-select list (players to add to a team, teams in a competition…).
 * options: [{ value, label, description, leading }]
 */
export default function CheckboxList({ options, value = [], onChange, searchable = true, emptyLabel, maxHeight = 'max-h-80', label }) {
  const { t } = useI18n();
  const [query, setQuery] = useState('');
  const filtered = useMemo(() => options.filter((o) => !query || normalize(o.label).includes(normalize(query))), [options, query]);

  const toggle = (v) => onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v]);

  return (
    <div className="space-y-3">
      {searchable && options.length > 6 && <SearchInput value={query} onChange={setQuery} delay={0} />}
      <div role="group" aria-label={label} className={cn('overflow-y-auto rounded-xl border border-line scrollbar-thin', maxHeight)}>
        {filtered.length === 0 ? (
          <EmptyState compact title={emptyLabel ?? t('common.noResults')} />
        ) : (
          filtered.map((o) => {
            const checked = value.includes(o.value);
            return (
              <label key={o.value} className={cn('flex min-h-14 cursor-pointer items-center gap-3 border-b border-line px-3.5 py-2.5 last:border-0 hover:bg-surface-2', checked && 'bg-brand-50/60 dark:bg-brand-500/5')}>
                <input type="checkbox" className="peer sr-only" checked={checked} onChange={() => toggle(o.value)} />
                <span
                  className={cn(
                    'grid size-5 shrink-0 place-items-center rounded-md border transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-brand-500',
                    checked ? 'border-brand-600 bg-brand-600 text-white dark:border-brand-500 dark:bg-brand-500' : 'border-line-strong bg-surface',
                  )}
                  aria-hidden="true"
                >
                  {checked && <Check className="size-3.5" strokeWidth={3} />}
                </span>
                {o.leading}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-ink">{o.label}</span>
                  {o.description && <span className="block truncate text-xs text-ink-3">{o.description}</span>}
                </span>
              </label>
            );
          })
        )}
      </div>
    </div>
  );
}
