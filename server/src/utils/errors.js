/**
 * Application error. `code` is a stable machine code (e.g. PLAYER_NOT_FOUND); `i18nKey` is the
 * translation key the React apps display; `fields` maps field → i18n key for form errors.
 */
export class AppError extends Error {
  constructor(status, code, message, { i18nKey, fields, details } = {}) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
    this.i18nKey = i18nKey ?? null;
    this.fields = fields ?? null;
    this.details = details ?? null;
  }
}

export const badRequest = (code, message, opts) => new AppError(400, code, message, opts);
export const unauthorized = (code = 'UNAUTHORIZED', message = 'Authentication required', opts = {}) =>
  new AppError(401, code, message, { i18nKey: 'errors.sessionExpired', ...opts });
export const forbidden = (message = 'You do not have access to this resource', opts = {}) =>
  new AppError(403, 'FORBIDDEN', message, { i18nKey: 'errors.forbidden', ...opts });
export const notFound = (entity = 'Resource', code) =>
  new AppError(404, code ?? `${entity.toUpperCase().replace(/\s+/g, '_')}_NOT_FOUND`, `${entity} not found`, { i18nKey: 'errors.notFound' });
export const conflict = (code, message, opts) => new AppError(409, code, message, opts);
export const unprocessable = (code, message, opts) => new AppError(422, code, message, opts);

/** Field-level business validation error (e.g. email already used). */
export const fieldError = (status, code, message, field, i18nKey) =>
  new AppError(status, code, message, { i18nKey, fields: { [field]: i18nKey } });
