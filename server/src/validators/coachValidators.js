import { z } from 'zod';
import { COACH_STATUSES, COACH_TEAM_ROLES, GENDERS } from '../config/constants.js';
import { email, enumOf, image, int, listQuery, nullableUuid, personName, phone, shortText, uuid, uuidOr } from './common.js';

const fields = {
  name: personName,
  email,
  phone: phone.optional(),
  photo: image,
  gender: enumOf(GENDERS).optional(),
  license: shortText(80).optional(),
  experience: int(0, 60).optional(),
  specialization: shortText(80).optional(),
  team_id: nullableUuid,
  status: enumOf(COACH_STATUSES).optional(),
};

export const create = z.object({ ...fields, status: enumOf(COACH_STATUSES).optional().default('active') });
export const update = z.object(Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, v.optional()])));

export const selfUpdate = z.object({ name: personName.optional(), email: email.optional(), phone: phone.optional(), photo: image });

export const query = z.object({ ...listQuery, status: enumOf(COACH_STATUSES).optional(), team_id: uuidOr('none') });

export const assignToTeam = z.object({ coach_id: uuid, role: enumOf(COACH_TEAM_ROLES).optional().default('head_coach') });
