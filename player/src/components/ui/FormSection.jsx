import { cn } from '@/utils/cn';

/** Titled group of fields inside long forms (single column on phones, two on larger screens). */
export default function FormSection({ title, children, className }) {
  return (
    <fieldset className={cn('border-t border-line pt-5 first:border-0 first:pt-0', className)}>
      <legend className="float-left mb-4 w-full text-xs font-semibold uppercase tracking-wider text-ink-3">{title}</legend>
      <div className="clear-both grid gap-4 sm:grid-cols-2">{children}</div>
    </fieldset>
  );
}
