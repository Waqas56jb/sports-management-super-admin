/**
 * Shared chart chrome: gradients, animation, legend, tooltip and axis styling that follow the theme
 * tokens. Colours always come from the validated categorical / status tokens (--chart-N, --good…);
 * gradients only vary the opacity of that same hue, so identity never changes.
 */
import { useId, useMemo } from 'react';
import { cn } from '@/utils/cn';

export const AXIS_PROPS = {
  tick: { fill: 'var(--chart-axis)', fontSize: 11.5, fontWeight: 500 },
  tickLine: false,
  axisLine: false,
  tickMargin: 8,
};

export const GRID_PROPS = { stroke: 'var(--chart-grid)', strokeDasharray: '3 5', vertical: false };

/** Rounded, softly tinted hover band behind the hovered category. */
export const BAR_CURSOR = { fill: 'var(--surface-3)', opacity: 0.55, radius: 8 };
export const LINE_CURSOR = { stroke: 'var(--ink-3)', strokeWidth: 1, strokeDasharray: '4 4', strokeOpacity: 0.6 };

const TOKENS = ['chart-1', 'chart-2', 'chart-3', 'chart-4', 'chart-5', 'chart-6', 'good', 'warning', 'serious', 'critical', 'neutral', 'ink-3', 'color-brand-500'];

const reducedMotion = () => typeof window !== 'undefined' && Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);

/**
 * Entrance animation for a series, cascading by index through a longer duration.
 * animationBegin stays 0: in Recharts 3 a delayed start can stall a Line mid-draw when the chart re-renders.
 * Off when the user prefers reduced motion.
 */
export function animation(index = 0, duration = 950) {
  if (reducedMotion()) return { isAnimationActive: false };
  return { isAnimationActive: true, animationBegin: 0, animationDuration: duration + index * 140, animationEasing: 'ease-out' };
}

/**
 * Lines and areas: Recharts' own draw-in can freeze part-way when the chart re-renders mid-animation,
 * so it is switched off and the series is revealed left-to-right by CSS instead (`.chart-glow`
 * in index.css; the class also carries the soft glow).
 */
export function reveal() {
  return { isAnimationActive: false };
}

/**
 * Per-chart gradient paint. Returns `defs` (render as the first child of the chart) and
 * `fill(color, kind)` → 'v' vertical columns, 'h' horizontal bars, 'area' fading area wash.
 * Ids are unique per chart so charts in hidden tabs never lose their fills.
 */
export function useChartPaint() {
  const uid = `p${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  return useMemo(() => {
    const tokenOf = (color) => /var\(--([\w-]+)\)/.exec(color ?? '')?.[1];
    const fill = (color, kind = 'v') => {
      const token = tokenOf(color);
      return token && TOKENS.includes(token) ? `url(#${uid}-${kind}-${token})` : color;
    };
    const stop = (token, offset, opacity) => <stop offset={offset} style={{ stopColor: `var(--${token})`, stopOpacity: opacity }} />;
    const defs = (
      <defs>
        {TOKENS.map((token) => (
          <linearGradient key={`v-${token}`} id={`${uid}-v-${token}`} x1="0" y1="0" x2="0" y2="1">
            {stop(token, '0%', 1)}
            {stop(token, '100%', 0.68)}
          </linearGradient>
        ))}
        {TOKENS.map((token) => (
          <linearGradient key={`h-${token}`} id={`${uid}-h-${token}`} x1="0" y1="0" x2="1" y2="0">
            {stop(token, '0%', 0.7)}
            {stop(token, '100%', 1)}
          </linearGradient>
        ))}
        {TOKENS.map((token) => (
          <linearGradient key={`a-${token}`} id={`${uid}-area-${token}`} x1="0" y1="0" x2="0" y2="1">
            {stop(token, '0%', 0.32)}
            {stop(token, '65%', 0.08)}
            {stop(token, '100%', 0)}
          </linearGradient>
        ))}
      </defs>
    );
    return { defs, fill };
  }, [uid]);
}

/** items: [{ label, color, shape: 'square' | 'line' | 'dashed' }] */
export function ChartLegend({ items, className }) {
  return (
    <ul className={cn('flex flex-wrap items-center gap-1.5 text-xs text-ink-2', className)}>
      {items.map((item) => (
        <li key={item.label} className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface-2/70 py-1 pl-2 pr-2.5 font-medium">
          {item.shape === 'line' || item.shape === 'dashed' ? (
            <span
              className="h-[3px] w-4 rounded-full"
              style={item.shape === 'dashed' ? { backgroundImage: `repeating-linear-gradient(90deg, ${item.color} 0 4px, transparent 4px 7px)` } : { background: item.color }}
              aria-hidden="true"
            />
          ) : (
            <span className="size-2.5 rounded-[4px] shadow-[inset_0_0_0_1px_rgb(255_255_255/0.25)]" style={{ background: item.color }} aria-hidden="true" />
          )}
          {item.label}
        </li>
      ))}
    </ul>
  );
}

/** Tooltip content: values in ink, identity carried by a colour swatch beside them. */
export function ChartTooltip({ active, payload, label, labelFormatter, valueFormatter, nameFor, colorFor }) {
  if (!active || !payload?.length) return null;
  const rows = payload.filter((p) => p.value !== null && p.value !== undefined);
  if (!rows.length) return null;
  const swatch = (p) => {
    const explicit = colorFor?.(p.dataKey ?? p.name, p.payload);
    if (explicit) return explicit;
    const c = p.color ?? p.payload?.fill ?? p.payload?.color;
    return typeof c === 'string' && c.startsWith('url(') ? p.payload?.color ?? 'var(--ink-3)' : c;
  };
  return (
    <div className="glass min-w-44 animate-fade-in rounded-2xl border border-line/80 px-3.5 py-3 text-xs shadow-(--shadow-pop)">
      {label !== undefined && <p className="mb-2 border-b border-line/70 pb-2 text-[12.5px] font-semibold text-ink">{labelFormatter ? labelFormatter(label) : label}</p>}
      <ul className="space-y-1.5">
        {rows.map((p) => (
          <li key={p.dataKey ?? p.name} className="flex items-center justify-between gap-5">
            <span className="inline-flex items-center gap-2 text-ink-2">
              <span className="size-2.5 rounded-full ring-2 ring-surface" style={{ background: swatch(p) }} aria-hidden="true" />
              {nameFor ? nameFor(p.dataKey ?? p.name) : p.name}
            </span>
            <span className="font-display text-[15px] font-bold tabular text-ink">{valueFormatter ? valueFormatter(p.value, p.dataKey) : p.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
