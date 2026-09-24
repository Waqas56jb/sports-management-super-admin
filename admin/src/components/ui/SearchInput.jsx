import { useEffect, useState } from 'react';
import { Search, X } from 'lucide-react';
import { useI18n } from '@/i18n';
import { useDebounce } from '@/hooks/useDebounce';
import { cn } from '@/utils/cn';

/** Debounced search box. Calls onChange with the settled value. */
export default function SearchInput({ value = '', onChange, placeholder, className, label, delay = 300 }) {
  const { t } = useI18n();
  const [text, setText] = useState(value);
  const debounced = useDebounce(text, delay);

  useEffect(() => {
    setText(value);
  }, [value]);

  useEffect(() => {
    if (debounced !== value) onChange(debounced);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced]);

  return (
    <div className={cn('relative min-w-0', className)} role="search">
      <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-ink-3" aria-hidden="true" />
      <input
        type="search"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={placeholder ?? t('common.search')}
        aria-label={label ?? placeholder ?? t('common.search')}
        className="field-control pl-10 pr-10 [&::-webkit-search-cancel-button]:hidden"
      />
      {text && (
        <button
          type="button"
          onClick={() => {
            setText('');
            onChange('');
          }}
          className="absolute right-1.5 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-lg text-ink-3 hover:bg-surface-3 hover:text-ink"
          aria-label={t('common.clearSearch')}
        >
          <X className="size-4" />
        </button>
      )}
    </div>
  );
}
