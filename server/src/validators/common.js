/**
 * Reusable zod building blocks. Messages that look like "validation.x" are translation keys the
 * apps display next to the field; plain sentences are for API consumers.
 */
import { z } from 'zod';
import { isValidISODate, todayISO } from '../utils/dates.js';

const blankToUndefined = (v) => (v === '' || v === null ? undefined : v);
const blankToNull = (v) => (v === '' ? null : v);

export const uuid = z.uuid({ message: 'validation.invalid' });
export const optionalUuid = z.preprocess(blankToUndefined, uuid.optional());
export const nullableUuid = z.preprocess(blankToNull, uuid.nullable().optional());
/** team / competition filters also accept the literal "none" / "friendly". */
export const uuidOr = (...literals) => z.preprocess(blankToUndefined, z.union([uuid, ...literals.map((l) => z.literal(l))]).optional());

export const email = z
  .string({ message: 'validation.required' })
  .trim()
  .toLowerCase()
  .max(254, 'validation.maxLength')
  .regex(/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/, 'validation.email');

export const password = z.string({ message: 'validation.required' }).min(1, 'validation.required').max(200, 'validation.maxLength');
export const strongPassword = z
  .string({ message: 'validation.required' })
  .max(200, 'validation.maxLength')
  .refine((v) => v.length >= 8 && /[A-Z]/.test(v) && /[a-z]/.test(v) && /[0-9]/.test(v), 'validation.password');

export const phone = z.string().trim().max(30, 'validation.maxLength').refine((v) => v === '' || /^\+?[0-9\s-]{7,20}$/.test(v), 'validation.phone');
export const personName = z.string({ message: 'validation.required' }).trim().min(3, 'validation.minLength').max(80, 'validation.maxLength');
export const shortText = (max = 200) => z.string().trim().max(max, 'validation.maxLength');

export const isoDate = z.string({ message: 'validation.required' }).refine(isValidISODate, 'validation.invalid');
export const optionalDate = z.preprocess(blankToUndefined, isoDate.optional());
export const nullableDate = z.preprocess(blankToNull, isoDate.nullable().optional());
export const pastDate = isoDate.refine((v) => v <= todayISO(), 'validation.pastDate');
export const time = z.string({ message: 'validation.required' }).regex(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/, 'validation.invalid').transform((v) => v.slice(0, 5));

export const int = (min, max) => z.coerce.number({ message: 'validation.range' }).int('validation.range').min(min, 'validation.range').max(max, 'validation.range');
export const nullableInt = (min, max) => z.preprocess((v) => (v === '' || v === null || v === undefined ? null : v), int(min, max).nullable());

/** Image field: data URL (uploaded by the API), https URL (already stored) or null to remove. */
export const image = z.preprocess(blankToNull, z.string().max(8_000_000, 'validation.imageSize').nullable().optional());

export const enumOf = (values) => z.enum(values, { message: 'validation.invalid' });

export const booleanish = z.preprocess((v) => (v === 'true' ? true : v === 'false' ? false : v), z.boolean());

/** Common list query parameters (pagination, search, sorting, date range). */
export const listQuery = {
  page: z.coerce.number().int().min(1).optional(),
  limit: z.union([z.coerce.number().int().min(1), z.literal('all')]).optional(),
  pageSize: z.union([z.coerce.number().int().min(1), z.literal('all')]).optional(),
  search: z.string().trim().max(100).optional(),
  sortBy: z.string().regex(/^[a-z_]{1,40}$/).optional(),
  sortOrder: z.enum(['asc', 'desc', 'ASC', 'DESC']).optional(),
  date_from: optionalDate,
  date_to: optionalDate,
};

export const idParams = z.object({ id: z.uuid({ message: 'errors.notFound' }) });
