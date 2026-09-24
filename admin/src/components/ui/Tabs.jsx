import { useRef } from 'react';
import { cn } from '@/utils/cn';

/**
 * Segmented tabs with roving focus (arrow keys).
 * tabs: [{ value, label, count, icon }]
 */
export default function Tabs({ tabs, value, onChange, className, size = 'md', label, fill = false }) {
  const listRef = useRef(null);
  const onKeyDown = (e) => {
    if (!['ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(e.key)) return;
    e.preventDefault();
    const idx = tabs.findIndex((t) => t.value === value);
    let next = idx;
    if (e.key === 'ArrowRight') next = (idx + 1) % tabs.length;
    if (e.key === 'ArrowLeft') next = (idx - 1 + tabs.length) % tabs.length;
    if (e.key === 'Home') next = 0;
    if (e.key === 'End') next = tabs.length - 1;
    onChange(tabs[next].value);
    listRef.current?.querySelectorAll('[role="tab"]')[next]?.focus();
  };

  return (
    <div className={cn('max-w-full overflow-x-auto no-scrollbar', className)}>
      <div
        ref={listRef}
        role="tablist"
        aria-label={label}
        onKeyDown={onKeyDown}
        className={cn('inline-flex items-center gap-1 rounded-xl bg-surface-3 p-1', fill && 'flex w-full')}
      >
        {tabs.map((tab) => {
          const active = tab.value === value;
          const Icon = tab.icon;
          return (
            <button
              key={tab.value}
              type="button"
              role="tab"
              aria-selected={active}
              tabIndex={active ? 0 : -1}
              onClick={() => onChange(tab.value)}
              className={cn(
                'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg font-medium transition-colors',
                size === 'sm' ? 'h-8 px-3 text-xs' : 'h-10 px-3.5 text-sm sm:h-9',
                fill && 'flex-1',
                active ? 'bg-surface text-ink shadow-sm' : 'text-ink-3 hover:text-ink',
              )}
            >
              {Icon && <Icon className="size-4" aria-hidden="true" />}
              {tab.label}
              {tab.count !== undefined && (
                <span className={cn('rounded-full px-1.5 text-xs tabular', active ? 'bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300' : 'bg-line text-ink-3')}>
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
