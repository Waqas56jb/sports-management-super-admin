import { z } from 'zod';
import { AGE_GROUPS, TEAM_CATEGORIES, TEAM_GENDERS, TEAM_STATUSES } from '../config/constants.js';
import { enumOf, image, listQuery, nullableInt, nullableUuid, shortText, uuid } from './common.js';

const fields = {
  name: z.string({ message: 'validation.required' }).trim().min(2, 'validation.minLength').max(80, 'validation.maxLength'),
  short_name: z.string({ message: 'validation.required' }).trim().min(2, 'validation.minLength').max(5, 'validation.maxLength'),
  category: enumOf(TEAM_CATEGORIES).optional(),
  age_group: enumOf(AGE_GROUPS).optional(),
  gender: enumOf(TEAM_GENDERS).optional(),
  coach_id: nullableUuid,
  description: shortText(1000).optional(),
  home_ground: shortText(120).optional(),
  city: shortText(80).optional(),
  country: z.string().trim().toUpperCase().regex(/^[A-Z]{2}$/, 'validation.invalid').optional(),
  founded: nullableInt(1850, 2100).optional(),
  status: enumOf(TEAM_STATUSES).optional(),
  logo: image,
};

export const create = z.object({ ...fields, status: enumOf(TEAM_STATUSES).optional().default('active') });
export const update = z.object(Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, v.optional()])));

export const query = z.object({ ...listQuery, status: enumOf(TEAM_STATUSES).optional(), category: enumOf(TEAM_CATEGORIES).optional() });

/** Accepts { playerIds: [...] } (apps), { player_ids: [...] } or { player_id }. */
export const addPlayers = z
  .object({ playerIds: z.array(uuid).optional(), player_ids: z.array(uuid).optional(), player_id: uuid.optional() })
  .transform((v) => ({ playerIds: [...new Set([...(v.playerIds ?? []), ...(v.player_ids ?? []), ...(v.player_id ? [v.player_id] : [])])] }))
  .refine((v) => v.playerIds.length > 0 && v.playerIds.length <= 60, { message: 'validation.required', path: ['playerIds'] });

export const teamPlayerParams = z.object({ teamId: z.uuid({ message: 'errors.notFound' }), playerId: z.uuid({ message: 'errors.notFound' }) });
export const teamCoachParams = z.object({ teamId: z.uuid({ message: 'errors.notFound' }), coachId: z.uuid({ message: 'errors.notFound' }) });
export const teamParams = z.object({ teamId: z.uuid({ message: 'errors.notFound' }) });
