import { z } from 'zod';
import { FORMATIONS, MATCH_EVENT_TYPES, MATCH_STATUSES } from '../config/constants.js';
import { enumOf, int, isoDate, listQuery, nullableInt, nullableUuid, optionalUuid, shortText, time, uuid, uuidOr } from './common.js';

const fixture = {
  competition_id: nullableUuid,
  home_team_id: uuid,
  away_team_id: uuid,
  date: isoDate,
  time,
  location: shortText(160).optional(),
  referee: shortText(80).optional(),
  round: nullableInt(1, 99).optional(),
  notes: shortText(1000).optional(),
  status: enumOf(MATCH_STATUSES).optional(),
};

const distinctTeams = (v) => !v.home_team_id || !v.away_team_id || v.home_team_id !== v.away_team_id;

export const create = z.object(fixture).refine(distinctTeams, { message: 'matches.errors.sameTeam', path: ['away_team_id'] });
export const update = z
  .object(Object.fromEntries(Object.entries(fixture).map(([k, v]) => [k, v.optional()])))
  .refine(distinctTeams, { message: 'matches.errors.sameTeam', path: ['away_team_id'] });

export const status = z.object({
  status: enumOf(MATCH_STATUSES),
  home_score: nullableInt(0, 99).optional(),
  away_score: nullableInt(0, 99).optional(),
  live_minute: nullableInt(0, 130).optional(),
});

const stats = z
  .object({
    possession: int(0, 100).optional(),
    shots: int(0, 99).optional(),
    shots_on_target: int(0, 99).optional(),
    corners: int(0, 50).optional(),
    fouls: int(0, 99).optional(),
    offsides: int(0, 50).optional(),
    passes: int(0, 2000).optional(),
    completed_passes: int(0, 2000).optional(),
  })
  .refine((v) => v.shots === undefined || v.shots_on_target === undefined || v.shots_on_target <= v.shots, { message: 'validation.range', path: ['shots_on_target'] })
  .refine((v) => v.passes === undefined || v.completed_passes === undefined || v.completed_passes <= v.passes, { message: 'validation.range', path: ['completed_passes'] });

/** Either { home: {...}, away: {...} } (apps) or { team_id, ...stats } (single side). */
export const teamStats = z.union([
  z.object({ home: stats.optional(), away: stats.optional() }).refine((v) => v.home || v.away, { message: 'validation.required', path: ['home'] }),
  z.object({ team_id: uuid }).and(stats),
]);

export const lineup = z.object({
  team_id: optionalUuid,
  side: z.enum(['home', 'away']).optional(),
  formation: enumOf(FORMATIONS).optional(),
  starting: z.array(uuid).max(11, 'matches.lineup.errors.elevenRequired'),
  substitutes: z.array(uuid).max(9, 'validation.range').optional().default([]),
});

export const event = z
  .object({
    event_type: enumOf(MATCH_EVENT_TYPES),
    team_id: optionalUuid,
    player_id: optionalUuid,
    related_player_id: optionalUuid,
    player_in_id: optionalUuid,
    player_out_id: optionalUuid,
    assist_player_id: optionalUuid,
    minute: int(0, 130),
    additional_minute: nullableInt(0, 30).optional(),
    description: shortText(200).optional(),
  })
  .refine((v) => v.player_id || v.player_in_id, { message: 'validation.required', path: ['player_id'] })
  .refine((v) => v.event_type !== 'substitution' || v.related_player_id || v.player_out_id || (v.player_in_id && v.player_id), { message: 'validation.required', path: ['related_player_id'] })
  .refine((v) => v.event_type !== 'assist' || v.related_player_id, { message: 'validation.required', path: ['related_player_id'] });

export const eventUpdate = z
  .object({ minute: int(0, 130).optional(), additional_minute: nullableInt(0, 30).optional(), description: shortText(200).optional() })
  .refine((v) => Object.keys(v).length > 0, { message: 'validation.required', path: ['minute'] });

export const query = z.object({
  ...listQuery,
  status: enumOf(MATCH_STATUSES).optional(),
  competition_id: uuidOr('friendly'),
  team_id: uuidOr(),
  when: z.enum(['upcoming', 'completed']).optional(),
  tab: z.enum(['upcoming', 'completed', 'cancelled']).optional(),
});

export const eventParams = z.object({ id: z.uuid({ message: 'errors.notFound' }), eventId: z.uuid({ message: 'errors.notFound' }) });
export const sideParams = z.object({ id: z.uuid({ message: 'errors.notFound' }), side: z.enum(['home', 'away']) });
