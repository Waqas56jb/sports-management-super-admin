import { forwardRef, useId, useState } from 'react';
import { ChevronDown, Eye, EyeOff } from 'lucide-react';
import { useErrorMessage, useI18n } from '@/i18n';
import { cn } from '@/utils/cn';

/** Label + control + hint/error wrapper. Wires aria-describedby / aria-invalid for screen readers. */
export function Field({ id, label, hint, error, required, children, className, labelAction }) {
  const errorMessage = useErrorMessage();
  const message = error ? errorMessage(error) : null;
  return (
    <div className={cn('flex min-w-0 flex-col gap-1.5', className)}>
      {label && (
        <div className="flex items-center justify-between gap-2">
          <label htmlFor={id} className="text-sm font-medium text-ink">
            {label}
            {required && (
              <span className="ml-0.5 text-red-600" aria-hidden="true">
                *
              </span>
            )}
          </label>
          {labelAction}
        </div>
      )}
      {children}
      {message ? (
        <p id={`${id}-error`} className="text-xs font-medium text-red-600 dark:text-red-400" role="alert">
          {message}
        </p>
      ) : (
        hint && (
          <p id={`${id}-hint`} className="text-xs text-ink-3">
            {hint}
          </p>
        )
      )}
    </div>
  );
}

function describedBy(id, error, hint) {
  if (error) return `${id}-error`;
  if (hint) return `${id}-hint`;
  return undefined;
}

export const Input = forwardRef(function Input({ label, hint, error, required, className, fieldClassName, id: idProp, icon: Icon, suffix, ...rest }, ref) {
  const autoId = useId();
  const id = idProp ?? autoId;
  return (
    <Field id={id} label={label} hint={hint} error={error} required={required} className={fieldClassName}>
      <div className="relative">
        {Icon && <Icon className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-ink-3" aria-hidden="true" />}
        <input
          ref={ref}
          id={id}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={describedBy(id, error, hint)}
          aria-required={required || undefined}
          className={cn('field-control', Icon && 'pl-10', suffix && 'pr-12', className)}
          {...rest}
        />
        {suffix && <div className="absolute inset-y-0 right-1 flex items-center">{suffix}</div>}
      </div>
    </Field>
  );
});

export function PasswordInput(props) {
  const { t } = useI18n();
  const [visible, setVisible] = useState(false);
  return (
    <Input
      {...props}
      type={visible ? 'text' : 'password'}
      suffix={
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          className="grid size-9 place-items-center rounded-lg text-ink-3 hover:bg-surface-3 hover:text-ink"
          aria-label={visible ? t('auth.hidePassword') : t('auth.showPassword')}
          aria-pressed={visible}
        >
          {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
      }
    />
  );
}

export const Textarea = forwardRef(function Textarea({ label, hint, error, required, className, fieldClassName, id: idProp, rows = 4, ...rest }, ref) {
  const autoId = useId();
  const id = idProp ?? autoId;
  return (
    <Field id={id} label={label} hint={hint} error={error} required={required} className={fieldClassName}>
      <textarea
        ref={ref}
        id={id}
        rows={rows}
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={describedBy(id, error, hint)}
        aria-required={required || undefined}
        className={cn('field-control min-h-24 py-2.5 leading-relaxed', className)}
        {...rest}
      />
    </Field>
  );
});

/**
 * Native <select> styled to match — keeps the OS picker on iOS/Android which is the most
 * usable option on touch devices. `options` = [{ value, label }].
 */
export const Select = forwardRef(function Select(
  { label, hint, error, required, className, fieldClassName, id: idProp, options = [], placeholder, children, ...rest },
  ref,
) {
  const autoId = useId();
  const id = idProp ?? autoId;
  return (
    <Field id={id} label={label} hint={hint} error={error} required={required} className={fieldClassName}>
      <div className="relative">
        <select
          ref={ref}
          id={id}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={describedBy(id, error, hint)}
          aria-required={required || undefined}
          className={cn('field-control appearance-none pr-10', className)}
          {...rest}
        >
          {placeholder !== undefined && <option value="">{placeholder}</option>}
          {options.map((o) => (
            <option key={o.value} value={o.value} disabled={o.disabled}>
              {o.label}
            </option>
          ))}
          {children}
        </select>
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-ink-3" aria-hidden="true" />
      </div>
    </Field>
  );
});

export function Checkbox({ label, description, className, id: idProp, ...rest }) {
  const autoId = useId();
  const id = idProp ?? autoId;
  return (
    <label htmlFor={id} className={cn('flex min-h-11 cursor-pointer items-start gap-3 py-1 sm:min-h-0', className)}>
      <input
        id={id}
        type="checkbox"
        className="mt-0.5 size-5 shrink-0 cursor-pointer rounded-md border-line-strong accent-brand-600 sm:size-4"
        {...rest}
      />
      <span className="min-w-0">
        <span className="block text-sm text-ink">{label}</span>
        {description && <span className="block text-xs text-ink-3">{description}</span>}
      </span>
    </label>
  );
}

/** Accessible toggle switch (role="switch"). */
export function Switch({ checked, onChange, label, description, id: idProp, disabled }) {
  const autoId = useId();
  const id = idProp ?? autoId;
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="min-w-0">
        <label htmlFor={id} className="block text-sm font-medium text-ink">
          {label}
        </label>
        {description && <p className="text-xs text-ink-3">{description}</p>}
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors disabled:opacity-50',
          checked ? 'bg-brand-600 dark:bg-brand-500' : 'bg-line-strong',
        )}
      >
        <span className={cn('inline-block size-5 rounded-full bg-white shadow transition-transform', checked ? 'translate-x-6' : 'translate-x-1')} />
      </button>
    </div>
  );
}
