import { z } from 'zod';
import { ANNOUNCEMENT_AUDIENCES, ATTENDANCE_STATUSES } from '../config/constants.js';
import { enumOf, listQuery, optionalUuid, shortText, uuid, uuidOr } from './common.js';

export const create = z.object({
  training_session_id: uuid,
  player_id: uuid,
  status: enumOf(ATTENDANCE_STATUSES),
  notes: shortText(300).optional().default(''),
});

export const update = z
  .object({ status: enumOf(ATTENDANCE_STATUSES).optional(), notes: shortText(300).optional() })
  .refine((v) => v.status !== undefined || v.notes !== undefined, { message: 'validation.required', path: ['status'] });

export const query = z.object({
  ...listQuery,
  team_id: uuidOr(),
  player_id: optionalUuid,
  session_id: optionalUuid,
  status: enumOf(ATTENDANCE_STATUSES).optional(),
  granularity: z.enum(['day', 'week', 'month']).optional(),
});

// ------------------------------------------------------------------ notifications (kept here: both are register-style resources)

export const notificationQuery = z.object({
  page: listQuery.page,
  limit: listQuery.limit,
  pageSize: listQuery.pageSize,
  search: listQuery.search,
  status: z.enum(['read', 'unread']).optional(),
  type: z.string().regex(/^[a-z_]{2,40}$/).optional(),
  category: z.enum(['matches', 'training', 'team', 'system']).optional(),
});

export const notificationPatch = z.object({ is_read: z.boolean().optional().default(true) });

export const announcement = z
  .object({
    title: z.string({ message: 'validation.required' }).trim().min(3, 'validation.minLength').max(120, 'validation.maxLength'),
    message: z.string({ message: 'validation.required' }).trim().min(3, 'validation.minLength').max(1000, 'validation.maxLength'),
    audience: enumOf(ANNOUNCEMENT_AUDIENCES),
    team_id: z.preprocess((v) => (v === '' ? undefined : v), uuid.nullable().optional()),
  })
  .refine((v) => v.audience !== 'team' || v.team_id, { message: 'validation.required', path: ['team_id'] });

export const reportQuery = z.object({
  date_from: listQuery.date_from,
  date_to: listQuery.date_to,
  team_id: uuidOr(),
  competition_id: uuidOr(),
  season: z.string().max(20).optional(),
});

export const statisticsQuery = z.object({
  ...listQuery,
  team_id: uuidOr(),
  player_id: optionalUuid,
  competition_id: uuidOr('friendly'),
  season: z.string().max(20).optional(),
  position: z.enum(['goalkeeper', 'defender', 'midfielder', 'forward']).optional(),
  match_type: z.enum(['league', 'cup', 'tournament', 'friendly']).optional(),
  onlyPlayed: z.enum(['true', 'false']).optional(),
});
