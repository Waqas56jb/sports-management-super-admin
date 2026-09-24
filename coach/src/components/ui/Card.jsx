import { cn } from '@/utils/cn';

export function Card({ className, children, as: Tag = 'section', ...rest }) {
  return (
    <Tag className={cn('card', className)} {...rest}>
      {children}
    </Tag>
  );
}

export function CardHeader({ title, subtitle, action, icon: Icon, className, id }) {
  return (
    <div className={cn('flex flex-wrap items-start justify-between gap-x-4 gap-y-2 px-4 pt-4 sm:px-5 sm:pt-5', className)}>
      <div className="flex min-w-0 items-start gap-3">
        {Icon && (
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-surface-3 text-ink-2 ring-1 ring-inset ring-line/70">
            <Icon className="size-[18px]" aria-hidden="true" />
          </span>
        )}
        <div className="min-w-0">
          <h2 id={id} className="text-[15px] font-semibold leading-6 text-ink">
            {title}
          </h2>
          {subtitle && <p className="mt-0.5 text-sm text-ink-3">{subtitle}</p>}
        </div>
      </div>
      {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
    </div>
  );
}

export function CardBody({ className, children }) {
  return <div className={cn('p-4 sm:p-5', className)}>{children}</div>;
}

export function CardFooter({ className, children }) {
  return <div className={cn('flex items-center justify-end gap-2 border-t border-line px-4 py-3 sm:px-5', className)}>{children}</div>;
}
