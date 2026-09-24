import { useCallback, useRef, useState } from 'react';
import { validate } from '@/utils/validators';

/**
 * Minimal form state manager.
 *   const form = useForm({ initial, schema, onSubmit });
 *   <Input label="Email" {...form.field('email')} />
 * After the first submit attempt fields re-validate as the user types.
 * Server-side field errors (ApiError.fields) are mapped onto the matching inputs.
 */
export function useForm({ initial, schema = {}, onSubmit }) {
  const [values, setValuesState] = useState(initial);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const valuesRef = useRef(initial);
  const formRef = useRef(null);
  const submitted = useRef(false);

  const setValues = useCallback((next) => {
    const resolved = typeof next === 'function' ? next(valuesRef.current) : next;
    valuesRef.current = resolved;
    setValuesState(resolved);
  }, []);

  const setValue = useCallback(
    (name, value) => {
      const next = { ...valuesRef.current, [name]: value };
      valuesRef.current = next;
      setValuesState(next);
      setErrors((e) => {
        if (submitted.current) return { ...e, [name]: validate(next, schema)[name] };
        return e[name] ? { ...e, [name]: undefined } : e;
      });
    },
    [schema],
  );

  const field = (name) => ({
    name,
    id: `f-${name}`,
    value: values[name] ?? '',
    onChange: (e) => setValue(name, e?.target ? (e.target.type === 'checkbox' ? e.target.checked : e.target.value) : e),
    error: errors[name],
  });

  const handleSubmit = async (e) => {
    e?.preventDefault?.();
    submitted.current = true;
    setSubmitError(null);
    const found = validate(valuesRef.current, schema);
    setErrors(found);
    if (Object.values(found).some(Boolean)) {
      requestAnimationFrame(() => formRef.current?.querySelector('[aria-invalid="true"]')?.focus());
      return;
    }
    setSubmitting(true);
    try {
      await onSubmit(valuesRef.current);
    } catch (err) {
      if (err?.fields) setErrors(Object.fromEntries(Object.entries(err.fields).map(([k, key]) => [k, { key }])));
      setSubmitError(err);
    } finally {
      setSubmitting(false);
    }
  };

  const reset = useCallback((next) => {
    submitted.current = false;
    valuesRef.current = next;
    setValuesState(next);
    setErrors({});
    setSubmitError(null);
  }, []);

  return { values, setValue, setValues, errors, setErrors, field, handleSubmit, submitting, submitError, reset, formRef };
}
