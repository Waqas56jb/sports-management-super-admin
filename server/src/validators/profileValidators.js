import { z } from 'zod';
import { AppError } from '../utils/errors.js';
import { DEFAULT_PREFERENCES, LANGUAGES, RELATIONS, THEMES, ROLES, USER_STATUSES } from '../config/constants.js';
import { email, enumOf, image, listQuery, personName, phone, shortText, strongPassword } from './common.js';

// ------------------------------------------------------------------ own profile / settings

export const updateProfile = z.object({
  name: personName.optional(),
  email: email.optional(),
  phone: phone.optional(),
  avatar: image,
  photo: image,
});

const preferenceShape = Object.fromEntries(Object.keys(DEFAULT_PREFERENCES).map((k) => [k, z.boolean().optional()]));
export const notificationPreferences = z.object(preferenceShape).strict();

export const settings = z.object({
  language: enumOf(LANGUAGES).optional(),
  theme: enumOf(THEMES).optional(),
  notifications: notificationPreferences.optional(),
});

// ------------------------------------------------------------------ player self-service

/** The only fields a player may change about themselves. */
const PLAYER_EDITABLE = ['email', 'phone', 'address', 'photo', 'emergency_contact_name', 'emergency_contact_phone', 'emergency_contact_relation'];

export const playerProfileSchema = z.object({
  email: email.optional(),
  phone: phone.optional(),
  address: shortText(200).optional(),
  photo: image,
  emergency_contact_name: shortText(80).optional(),
  emergency_contact_phone: phone.optional(),
  emergency_contact_relation: z.union([enumOf(RELATIONS), z.literal('')]).optional(),
});

/** Rejects (403) any attempt to change club-managed data: team, number, statistics, status, role… */
export function assertPlayerEditable(req, _res, next) {
  const blocked = Object.keys(req.body ?? {}).filter((k) => !PLAYER_EDITABLE.includes(k));
  if (blocked.length) {
    return next(
      new AppError(403, 'FIELD_NOT_EDITABLE', `These fields are managed by the club and cannot be changed: ${blocked.join(', ')}`, {
        i18nKey: 'errors.forbidden',
        fields: Object.fromEntries(blocked.map((k) => [k, 'errors.forbidden'])),
      }),
    );
  }
  return next();
}

// ------------------------------------------------------------------ admin: users

export const userCreate = z.object({
  name: personName,
  email,
  phone: phone.optional().default(''),
  role: z.preprocess((v) => (v === 'super_admin' ? 'admin' : v), enumOf(ROLES)),
  status: enumOf(USER_STATUSES).optional().default('active'),
  password: strongPassword.optional(),
});

export const userUpdate = z.object({
  name: personName.optional(),
  email: email.optional(),
  phone: phone.optional(),
  role: z.preprocess((v) => (v === 'super_admin' ? 'admin' : v), enumOf(ROLES)).optional(),
  status: enumOf(USER_STATUSES).optional(),
});

export const userStatus = z.object({ status: enumOf(USER_STATUSES) });

export const userResetPassword = z
  .object({ mode: z.enum(['link', 'temporary']).default('link'), password: strongPassword.optional() })
  .refine((v) => v.mode !== 'temporary' || v.password, { message: 'validation.required', path: ['password'] });

export const userQuery = z.object({
  ...listQuery,
  role: z.preprocess((v) => (v === 'super_admin' ? 'admin' : v), enumOf(ROLES).optional()),
  status: enumOf(USER_STATUSES).optional(),
});
