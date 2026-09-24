import { z } from 'zod';
import { GENDERS, PLAYER_STATUSES, POSITIONS, PREFERRED_FEET, RELATIONS } from '../config/constants.js';
import { email, enumOf, image, listQuery, nullableDate, nullableInt, nullableUuid, personName, phone, shortText, uuidOr } from './common.js';

const relation = z.union([enumOf(RELATIONS), z.literal('')]);
const nationality = z.string().trim().toUpperCase().regex(/^[A-Z]{2}$/, 'validation.invalid');

const fields = {
  name: personName,
  email,
  phone: phone.optional(),
  photo: image,
  date_of_birth: nullableDate.refine((v) => !v || v <= new Date().toISOString().slice(0, 10), 'validation.pastDate'),
  gender: enumOf(GENDERS).optional(),
  nationality: nationality.optional(),
  address: shortText(200).optional(),
  position: enumOf(POSITIONS).optional(),
  secondary_position: z.preprocess((v) => (v === '' ? null : v), enumOf(POSITIONS).nullable().optional()),
  preferred_foot: enumOf(PREFERRED_FEET).optional(),
  height: nullableInt(120, 230).optional(),
  weight: nullableInt(35, 150).optional(),
  jersey_number: nullableInt(1, 99).optional(),
  team_id: nullableUuid,
  emergency_contact_name: shortText(80).optional(),
  emergency_contact_phone: phone.optional(),
  emergency_contact_relation: relation.optional(),
  status: enumOf(PLAYER_STATUSES).optional(),
  registration_date: nullableDate,
  license_number: shortText(40).nullable().optional(),
  license_valid_until: nullableDate,
};

export const create = z.object({ ...fields, status: enumOf(PLAYER_STATUSES).optional().default('active') });

export const update = z.object(Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, v.optional()])));

export const query = z.object({
  ...listQuery,
  team_id: uuidOr('none'),
  position: enumOf(POSITIONS).optional(),
  status: enumOf(PLAYER_STATUSES).optional(),
});

export const optionsQuery = z.object({ team_id: uuidOr(), status: enumOf(PLAYER_STATUSES).optional() });

export const statisticsQuery = z.object({
  season: z.string().max(20).optional(),
  competition_id: uuidOr('friendly'),
  date_from: listQuery.date_from,
  date_to: listQuery.date_to,
  match_type: z.enum(['league', 'cup', 'tournament', 'friendly']).optional(),
});

export const attendanceQuery = z.object({
  status: z.enum(['present', 'absent', 'late', 'excused', 'pending']).optional(),
  date_from: listQuery.date_from,
  date_to: listQuery.date_to,
  type: z.string().max(40).optional(),
  page: listQuery.page,
  limit: listQuery.limit,
  pageSize: listQuery.pageSize,
});

export const rosterQuery = z.object({ search: listQuery.search, position: enumOf(POSITIONS).optional() });
