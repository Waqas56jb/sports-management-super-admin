import { Card, CardHeader } from '@/components/ui/Card';
import { cn } from '@/utils/cn';

/** A titled group of big-number statistics (General, Attacking, Passing…). items: [{ label, value, hint }] */
export default function StatGroup({ title, icon, items, className }) {
  return (
    <Card className={cn('flex flex-col', className)}>
      <CardHeader title={title} icon={icon} />
      <dl className="grid flex-1 grid-cols-2 gap-px overflow-hidden rounded-b-(--radius-card) border-t border-line bg-line mt-4">
        {items.map((it) => (
          <div key={it.label} className="bg-surface px-4 py-3.5 sm:px-5">
            <dt className="text-xs font-medium text-ink-3">{it.label}</dt>
            <dd className="mt-1 font-display text-[28px] font-bold leading-none text-ink tabular">{it.value}</dd>
            {it.hint && <p className="mt-1 text-[11px] text-ink-3">{it.hint}</p>}
          </div>
        ))}
      </dl>
    </Card>
  );
}
