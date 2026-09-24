/** Shared chart chrome: legend, tooltip and axis styling that follow the theme tokens. */
import { cn } from '@/utils/cn';

export const AXIS_PROPS = {
  tick: { fill: 'var(--chart-axis)', fontSize: 12 },
  tickLine: false,
  axisLine: false,
};

export const GRID_PROPS = { stroke: 'var(--chart-grid)', strokeDasharray: undefined, vertical: false };

/** items: [{ label, color, shape: 'square' | 'line' }] */
export function ChartLegend({ items, className }) {
  return (
    <ul className={cn('flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-ink-2', className)}>
      {items.map((item) => (
        <li key={item.label} className="inline-flex items-center gap-1.5">
          {item.shape === 'line' ? (
            <span className="h-0.5 w-3.5 rounded-full" style={{ background: item.color }} aria-hidden="true" />
          ) : (
            <span className="size-2.5 rounded-[3px]" style={{ background: item.color }} aria-hidden="true" />
          )}
          {item.label}
        </li>
      ))}
    </ul>
  );
}

/** Tooltip content: values in ink, identity carried by a colour swatch beside them. */
export function ChartTooltip({ active, payload, label, labelFormatter, valueFormatter, nameFor }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="min-w-40 rounded-xl border border-line bg-surface px-3 py-2.5 text-xs shadow-(--shadow-pop)">
      {label !== undefined && <p className="mb-1.5 font-semibold text-ink">{labelFormatter ? labelFormatter(label) : label}</p>}
      <ul className="space-y-1">
        {payload
          .filter((p) => p.value !== null && p.value !== undefined)
          .map((p) => (
            <li key={p.dataKey ?? p.name} className="flex items-center justify-between gap-4">
              <span className="inline-flex items-center gap-1.5 text-ink-2">
                <span className="size-2 rounded-full" style={{ background: p.color ?? p.payload?.fill }} aria-hidden="true" />
                {nameFor ? nameFor(p.dataKey ?? p.name) : p.name}
              </span>
              <span className="font-semibold tabular text-ink">{valueFormatter ? valueFormatter(p.value, p.dataKey) : p.value}</span>
            </li>
          ))}
      </ul>
    </div>
  );
}
