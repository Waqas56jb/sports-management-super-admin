/**
 * Tiny schema validator. Each rule returns an i18n descriptor ({ key, params }) or null.
 * Usage: validate(values, { email: [required, email] })  →  { email: { key: 'validation.email' } }
 */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE_RE = /^\+?[0-9\s-]{7,20}$/;

export const required = (v) =>
  v === undefined ||
  v === null ||
  (typeof v === 'string' && v.trim() === '') ||
  (Array.isArray(v) && v.length === 0)
    ? { key: 'validation.required' }
    : null;

export const email = (v) => (v && !EMAIL_RE.test(v) ? { key: 'validation.email' } : null);

export const phone = (v) => (v && !PHONE_RE.test(v) ? { key: 'validation.phone' } : null);

export const minLength = (n) => (v) =>
  v && v.length < n ? { key: 'validation.minLength', params: { count: n } } : null;

export const maxLength = (n) => (v) =>
  v && v.length > n ? { key: 'validation.maxLength', params: { count: n } } : null;

export const numberRange = (min, max) => (v) => {
  if (v === '' || v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isNaN(n) || n < min || n > max ? { key: 'validation.range', params: { min, max } } : null;
};

export const strongPassword = (v) => {
  if (!v) return null;
  const ok = v.length >= 8 && /[A-Z]/.test(v) && /[a-z]/.test(v) && /[0-9]/.test(v);
  return ok ? null : { key: 'validation.password' };
};

export const pastDate = (v) => (v && new Date(v) > new Date() ? { key: 'validation.pastDate' } : null);

/** Cross-field rules receive all form values as the second argument. */
export const after = (otherField, key = 'validation.endAfterStart') => (v, values) =>
  v && values[otherField] && v <= values[otherField] ? { key } : null;

export const onOrAfter = (otherField, key = 'validation.endDateAfterStart') => (v, values) =>
  v && values[otherField] && v < values[otherField] ? { key } : null;

export const notEqual = (otherField, key) => (v, values) => (v && v === values[otherField] ? { key } : null);

export const sameAs = (otherField, key) => (v, values) => (v !== values[otherField] ? { key } : null);

export function validate(values, schema) {
  const errors = {};
  for (const [field, rules] of Object.entries(schema)) {
    for (const rule of rules) {
      const err = rule(values[field], values);
      if (err) {
        errors[field] = err;
        break;
      }
    }
  }
  return errors;
}
