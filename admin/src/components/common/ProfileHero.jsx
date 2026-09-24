import { Card } from '@/components/ui/Card';

/** Header card for profile pages: dark pitch banner, overlapping avatar/logo, title, meta and actions. */
export default function ProfileHero({ avatar, title, badge, meta, actions, children }) {
  return (
    <Card className="overflow-hidden">
      <div className="pitch-lines hero-aurora h-20 bg-[#0b1220] sm:h-24" aria-hidden="true" />
      <div className="flex flex-col gap-4 px-4 pb-5 sm:flex-row sm:items-end sm:px-6">
        <div className="-mt-12 shrink-0 sm:-mt-14">{avatar}</div>
        <div className="min-w-0 flex-1 sm:pb-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight text-ink sm:text-[28px]">{title}</h1>
            {badge}
          </div>
          {meta && <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-ink-2">{meta}</div>}
        </div>
        {actions && <div className="flex gap-2 sm:pb-1">{actions}</div>}
      </div>
      {children}
    </Card>
  );
}
