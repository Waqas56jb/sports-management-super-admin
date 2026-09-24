import { Link } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { cn } from '@/utils/cn';

export default function PageHeader({ title, description, actions, back, backLabel, className, children }) {
  return (
    <header className={cn('mb-5 sm:mb-6', className)}>
      {back && (
        <Link to={back} className="press mb-3 inline-flex min-h-9 items-center gap-1 rounded-full border border-line bg-surface/70 py-1 pl-2 pr-3 text-sm font-medium text-ink-2 shadow-[0_1px_2px_rgb(16_24_40/0.04)] hover:text-ink">
          <ChevronLeft className="size-4" aria-hidden="true" />
          {backLabel}
        </Link>
      )}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-[26px] font-bold leading-tight tracking-tight text-ink sm:text-[30px]">{title}</h1>
          {description && <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-ink-3 sm:text-[15px]">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2 [&>*]:flex-1 sm:[&>*]:flex-none">{actions}</div>}
      </div>
      {children}
    </header>
  );
}
