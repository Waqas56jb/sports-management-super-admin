import { z } from 'zod';
import { COMPETITION_STATUSES, COMPETITION_TYPES } from '../config/constants.js';
import { enumOf, isoDate, listQuery, shortText, uuid } from './common.js';

const fields = {
  name: z.string({ message: 'validation.required' }).trim().min(2, 'validation.minLength').max(120, 'validation.maxLength'),
  type: enumOf(COMPETITION_TYPES),
  season: z.string({ message: 'validation.required' }).trim().min(4, 'validation.minLength').max(20, 'validation.maxLength'),
  start_date: isoDate,
  end_date: isoDate,
  location: shortText(160).optional(),
  description: shortText(1000).optional(),
  status: enumOf(COMPETITION_STATUSES).optional(),
  team_ids: z.array(uuid).max(64).optional(),
};

const datesInOrder = (v) => !v.start_date || !v.end_date || v.end_date >= v.start_date;

export const create = z
  .object({ ...fields, status: enumOf(COMPETITION_STATUSES).optional().default('upcoming'), team_ids: z.array(uuid).min(2, 'validation.minTeams').max(64) })
  .refine(datesInOrder, { message: 'validation.endDateAfterStart', path: ['end_date'] });

export const update = z
  .object(Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, v.optional()])))
  .refine(datesInOrder, { message: 'validation.endDateAfterStart', path: ['end_date'] })
  .refine((v) => !v.team_ids || v.team_ids.length >= 2, { message: 'validation.minTeams', path: ['team_ids'] });

export const query = z.object({
  ...listQuery,
  status: enumOf(COMPETITION_STATUSES).optional(),
  type: enumOf(COMPETITION_TYPES).optional(),
  season: z.string().max(20).optional(),
});

export const addTeam = z.object({ team_id: uuid });
export const teamParams = z.object({ id: z.uuid({ message: 'errors.notFound' }), teamId: z.uuid({ message: 'errors.notFound' }) });
