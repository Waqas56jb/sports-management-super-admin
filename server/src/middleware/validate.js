/**
 * validate({ body, query, params }) — parses the request with zod schemas BEFORE any database work.
 * Parsed values land in req.valid.{body,query,params} (unknown keys are stripped).
 */
import { z } from 'zod';
import { AppError } from '../utils/errors.js';
import { normalizeQuery } from '../utils/filters.js';

/** Maps a zod issue to the frontends' translation keys. */
function i18nKeyFor(issue) {
  if (issue.message?.includes('.') && !issue.message.includes(' ')) return issue.message; // custom i18n key
  switch (issue.code) {
    case 'invalid_format':
      if (issue.format === 'email') return 'validation.email';
      return 'validation.invalid';
    case 'too_small':
      return issue.minimum === 1 && issue.origin === 'string' ? 'validation.required' : issue.origin === 'string' ? 'validation.minLength' : 'validation.range';
    case 'too_big':
      return issue.origin === 'string' ? 'validation.maxLength' : 'validation.range';
    case 'invalid_type':
      return issue.input === undefined ? 'validation.required' : 'validation.invalid';
    default:
      return 'validation.invalid';
  }
}

function humanMessage(issue) {
  if (issue.message?.includes('.') && !issue.message.includes(' ')) {
    return issue.message.split('.').pop().replace(/([A-Z])/g, ' $1').toLowerCase();
  }
  return issue.message;
}

export function toValidationError(error, source) {
  const errors = error.issues.map((issue) => ({
    field: issue.path.join('.') || source,
    message: humanMessage(issue),
    i18nKey: i18nKeyFor(issue),
  }));
  return new AppError(400, 'VALIDATION_FAILED', 'Validation failed', {
    i18nKey: 'errors.formInvalid',
    fields: Object.fromEntries(errors.map((e) => [e.field, e.i18nKey])),
    details: errors,
  });
}

export const validate = (schemas) => (req, _res, next) => {
  req.valid = req.valid ?? {};
  for (const source of ['params', 'query', 'body']) {
    const schema = schemas[source];
    if (!schema) continue;
    const input = source === 'query' ? normalizeQuery(req.query) : source === 'body' ? (req.body ?? {}) : req.params;
    const result = schema.safeParse(input);
    if (!result.success) {
      // A malformed id in the URL simply does not exist.
      if (source === 'params') return next(new AppError(404, 'NOT_FOUND', 'Resource not found', { i18nKey: 'errors.notFound' }));
      return next(toValidationError(result.error, source));
    }
    req.valid[source] = result.data;
  }
  return next();
};

/** Shorthand for routes whose only parameter is :id. */
export const idParam = (name = 'id') => validate({ params: z.object({ [name]: z.uuid({ message: 'errors.notFound' }) }).passthrough() });
