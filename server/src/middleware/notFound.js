import { AppError } from '../utils/errors.js';

export function notFound(req, _res, next) {
  next(new AppError(404, 'ROUTE_NOT_FOUND', `Route ${req.method} ${req.originalUrl.split('?')[0]} not found`, { i18nKey: 'errors.notFound' }));
}
