import { forbidden, unauthorized } from '../utils/errors.js';
import { can } from '../utils/permissions.js';

/** requireRole('admin') / requireRole('admin', 'coach') */
export const requireRole =
  (...roles) =>
  (req, _res, next) => {
    if (!req.actor) return next(unauthorized());
    if (!roles.includes(req.actor.role)) return next(forbidden(`This action requires the ${roles.join(' or ')} role`));
    return next();
  };

/** requirePermission('training:write') — see utils/permissions.js for the matrix. */
export const requirePermission = (permission) => (req, _res, next) => {
  if (!req.actor) return next(unauthorized());
  if (!can(req.actor, permission)) return next(forbidden('You do not have permission for this action'));
  return next();
};
