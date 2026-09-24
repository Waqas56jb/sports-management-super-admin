import { useEffect, useState } from 'react';
import { RotateCcw, SlidersHorizontal } from 'lucide-react';
import { useI18n } from '@/i18n';
import { cn } from '@/utils/cn';
import Button from './Button';
import { Input, Select } from './Field';
import Modal from './Modal';
import SearchInput from './SearchInput';

/**
 * Reusable list toolbar: search + filters.
 * Desktop/tablet: filters inline. Phones: a "Filters" button opens a bottom sheet.
 *
 * filters: [{ key, label, type: 'select' | 'date', options, placeholder }]
 */
export default function FilterBar({ search, onSearch, searchPlaceholder, filters = [], values = {}, onChange, onReset, actions, className }) {
  const { t } = useI18n();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [draft, setDraft] = useState(values);
  const activeCount = filters.filter((f) => values[f.key]).length;

  useEffect(() => {
    if (sheetOpen) setDraft(values);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sheetOpen]);

  const renderControl = (f, value, set, inSheet) => {
    const common = {
      label: inSheet ? f.label : undefined,
      'aria-label': f.label,
      value: value ?? '',
      onChange: (e) => set(f.key, e.target.value),
      fieldClassName: inSheet ? '' : cn('w-full sm:w-auto', f.className ?? 'sm:min-w-40'),
    };
    if (f.type === 'date') {
      if (inSheet) return <Input key={f.key} type="date" {...common} />;
      return (
        <div key={f.key} className="flex w-full items-center gap-2 sm:w-auto">
          <span className="shrink-0 text-xs font-medium text-ink-3" aria-hidden="true">
            {f.label}
          </span>
          <Input type="date" {...common} />
        </div>
      );
    }
    return <Select key={f.key} {...common} options={f.options} placeholder={f.placeholder ?? t('common.all')} />;
  };

  return (
    <div className={cn('flex flex-col gap-3 lg:flex-row lg:items-center', className)}>
      <div className="flex min-w-0 flex-1 items-center gap-2">
        {onSearch && <SearchInput value={search} onChange={onSearch} placeholder={searchPlaceholder} className="w-full lg:max-w-sm" />}
        {filters.length > 0 && (
          <Button variant="secondary" size="icon" className="relative md:hidden" onClick={() => setSheetOpen(true)} aria-label={t('common.filters')}>
            <SlidersHorizontal className="size-4" />
            {activeCount > 0 && (
              <span className="absolute -right-1 -top-1 grid size-5 place-items-center rounded-full bg-brand-600 text-[11px] font-semibold text-white dark:bg-brand-500 dark:text-brand-950">
                {activeCount}
              </span>
            )}
          </Button>
        )}
        {actions && <div className="flex items-center gap-2 lg:hidden">{actions}</div>}
      </div>

      {filters.length > 0 && (
        <div className="hidden flex-wrap items-center gap-2 md:flex">
          {filters.map((f) => renderControl(f, values[f.key], (k, v) => onChange({ [k]: v }), false))}
          {activeCount > 0 && onReset && (
            <Button variant="ghost" size="md" icon={RotateCcw} onClick={onReset}>
              {t('common.reset')}
            </Button>
          )}
        </div>
      )}
      {actions && <div className="hidden items-center gap-2 lg:flex">{actions}</div>}

      <Modal
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title={t('common.filters')}
        size="sm"
        footer={
          <>
            <Button
              variant="secondary"
              className="w-full sm:w-auto"
              onClick={() => {
                onReset?.();
                setSheetOpen(false);
              }}
            >
              {t('common.reset')}
            </Button>
            <Button
              className="w-full sm:w-auto"
              onClick={() => {
                onChange(Object.fromEntries(filters.map((f) => [f.key, draft[f.key] ?? ''])));
                setSheetOpen(false);
              }}
            >
              {t('common.applyFilters')}
            </Button>
          </>
        }
      >
        <div className="grid gap-4">{filters.map((f) => renderControl(f, draft[f.key], (k, v) => setDraft((d) => ({ ...d, [k]: v })), true))}</div>
      </Modal>
    </div>
  );
}
