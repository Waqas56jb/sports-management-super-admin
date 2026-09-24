import { z } from 'zod';
import { ATTENDANCE_STATUSES, TRAINING_STATUSES, TRAINING_TYPES } from '../config/constants.js';
import { enumOf, isoDate, listQuery, shortText, time, uuid, uuidOr } from './common.js';

const base = {
  team_id: uuid,
  title: shortText(120).optional(),
  training_type: enumOf(TRAINING_TYPES),
  date: isoDate,
  start_time: time,
  end_time: time,
  location: shortText(160).optional(),
  description: shortText(1000).optional(),
  objectives: z.array(shortText(120)).max(10).optional(),
  notes: shortText(2000).optional(),
};

/** Accepts `type` as an alias of `training_type`. */
const aliasType = (v) => (v && typeof v === 'object' && v.type && !v.training_type ? { ...v, training_type: v.type } : v);
const timesInOrder = (v) => !v.start_time || !v.end_time || v.end_time > v.start_time;

export const create = z.preprocess(aliasType, z.object(base).refine(timesInOrder, { message: 'validation.endAfterStart', path: ['end_time'] }));
export const update = z.preprocess(
  aliasType,
  z.object(Object.fromEntries(Object.entries(base).map(([k, v]) => [k, v.optional()]))).refine(timesInOrder, { message: 'validation.endAfterStart', path: ['end_time'] }),
);

export const cancel = z.object({ reason: shortText(200).optional().default('') });

export const query = z.object({
  ...listQuery,
  team_id: uuidOr(),
  type: enumOf(TRAINING_TYPES).optional(),
  status: enumOf(TRAINING_STATUSES).optional(),
  when: z.enum(['upcoming', 'completed', 'cancelled']).optional(),
  tab: z.enum(['upcoming', 'completed', 'cancelled']).optional(),
});

export const calendarQuery = z.object({
  date_from: listQuery.date_from,
  date_to: listQuery.date_to,
  team_id: uuidOr(),
  type: z.string().regex(/^(training|match|competition|event)(,(training|match|competition|event))*$/).optional(),
});

const registerLine = z.object({
  player_id: uuid,
  status: z.preprocess((v) => (v === '' ? null : v), enumOf(ATTENDANCE_STATUSES).nullable().optional()),
  notes: shortText(300).optional().default(''),
});

export const register = z.object({ records: z.array(registerLine).max(80) });
