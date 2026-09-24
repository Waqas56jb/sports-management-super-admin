/**
 * Central error handler. Maps application, validation, JWT, upload and PostgreSQL errors to the
 * standard envelope. In production, internals (stack traces, SQL, Supabase messages) are never
 * sent to the client — they are logged server-side with the request id instead.
 */
import multer from 'multer';
import { env } from '../config/env.js';
import { AppError } from '../utils/errors.js';

/** Unique / check constraints → friendly field errors the apps can display. */
const CONSTRAINTS = {
  users_email_unique: { status: 409, code: 'EMAIL_TAKEN', message: 'This email address is already in use', field: 'email', i18nKey: 'errors.emailTaken' },
  teams_name_unique: { status: 409, code: 'TEAM_NAME_TAKEN', message: 'A team with this name already exists', field: 'name', i18nKey: 'teams.errors.nameTaken' },
  players_team_jersey_unique: { status: 409, code: 'JERSEY_TAKEN', message: 'This shirt number is already used in the team', field: 'jersey_number', i18nKey: 'players.errors.jerseyTaken' },
  players_code_unique: { status: 409, code: 'PLAYER_CODE_TAKEN', message: 'This player code is already in use', field: 'player_code', i18nKey: 'errors.generic' },
  coaches_code_unique: { status: 409, code: 'COACH_CODE_TAKEN', message: 'This coach code is already in use', field: 'coach_code', i18nKey: 'errors.generic' },
  competitions_name_season_unique: { status: 409, code: 'COMPETITION_EXISTS', message: 'A competition with this name already exists for the season', field: 'name', i18nKey: 'errors.generic' },
  training_attendance_unique: { status: 409, code: 'DUPLICATE_ATTENDANCE', message: 'Attendance for this player and session already exists', field: 'player_id', i18nKey: 'errors.generic' },
  coach_teams_unique: { status: 409, code: 'COACH_ALREADY_ASSIGNED', message: 'This coach is already assigned to the team', field: 'coach_id', i18nKey: 'errors.generic' },
  coach_teams_one_head: { status: 409, code: 'TEAM_HAS_HEAD_COACH', message: 'This team already has a head coach', field: 'coach_id', i18nKey: 'errors.generic' },
  competition_teams_unique: { status: 409, code: 'TEAM_ALREADY_IN_COMPETITION', message: 'This team is already in the competition', field: 'team_id', i18nKey: 'errors.generic' },
  match_lineups_unique_player: { status: 409, code: 'DUPLICATE_LINEUP_PLAYER', message: 'A player can only appear once in a line-up', field: 'starting', i18nKey: 'errors.generic' },
  team_players_one_active: { status: 409, code: 'PLAYER_ALREADY_IN_TEAM', message: 'The player already has an active team', field: 'player_id', i18nKey: 'errors.generic' },
  matches_distinct_teams: { status: 422, code: 'SAME_TEAM', message: 'A team cannot play itself', field: 'away_team_id', i18nKey: 'matches.errors.sameTeam' },
  team_in_match: { status: 422, code: 'TEAM_NOT_IN_MATCH', message: 'The team does not play in this match', field: 'team_id', i18nKey: 'matches.errors.playerNotInMatch' },
  match_teams_in_competition: { status: 422, code: 'TEAM_NOT_IN_COMPETITION', message: 'Both teams must be entered in the competition', field: 'competition_id', i18nKey: 'errors.generic' },
  training_time_check: { status: 422, code: 'INVALID_TIME_RANGE', message: 'End time must be after start time', field: 'end_time', i18nKey: 'validation.endAfterStart' },
  competitions_dates_check: { status: 422, code: 'INVALID_DATE_RANGE', message: 'End date cannot be before the start date', field: 'end_date', i18nKey: 'validation.endDateAfterStart' },
};

function fromPostgres(err) {
  const known = err.constraint && CONSTRAINTS[err.constraint];
  if (known) return new AppError(known.status, known.code, known.message, { i18nKey: known.i18nKey, fields: { [known.field]: known.i18nKey } });
  switch (err.code) {
    case '23505':
      return new AppError(409, 'DUPLICATE_RECORD', 'A record with these values already exists', { i18nKey: 'errors.generic' });
    case '23503':
      return new AppError(409, 'RELATED_RECORD', 'The operation conflicts with related records', { i18nKey: 'errors.generic' });
    case '23514':
    case '23502':
      return new AppError(422, 'CONSTRAINT_VIOLATION', 'The data breaks a business rule', { i18nKey: 'errors.generic' });
    case '22P02':
    case '22007':
    case '22008':
    case '22003':
      return new AppError(400, 'INVALID_INPUT', 'Malformed value in request', { i18nKey: 'errors.generic' });
    default:
      return null;
  }
}

function normalize(err) {
  if (err instanceof AppError) return err;
  if (err?.type === 'entity.parse.failed') return new AppError(400, 'INVALID_JSON', 'Request body is not valid JSON');
  if (err?.type === 'entity.too.large') return new AppError(413, 'PAYLOAD_TOO_LARGE', 'Request body is too large', { i18nKey: 'validation.imageSize' });
  if (err instanceof multer.MulterError) {
    return err.code === 'LIMIT_FILE_SIZE'
      ? new AppError(413, 'FILE_TOO_LARGE', 'File is too large', { i18nKey: 'validation.imageSize' })
      : new AppError(400, 'UPLOAD_INVALID', err.message, { i18nKey: 'validation.imageType' });
  }
  if (err?.message?.startsWith('Not allowed by CORS')) return new AppError(403, 'CORS_REJECTED', 'Origin not allowed');
  if (typeof err?.code === 'string' && /^[0-9A-Z]{5}$/.test(err.code)) {
    const mapped = fromPostgres(err);
    if (mapped) return Object.assign(mapped, { cause: err });
  }
  return null;
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, _next) {
  const known = normalize(err);
  const status = known?.status ?? 500;
  const log = req.log ?? console;

  if (status >= 500) {
    log.error({ err: { message: err.message, code: err.code, stack: err.stack }, userId: req.actor?.userId }, 'Unhandled error');
  } else {
    log.warn({ code: known.code, status, userId: req.actor?.userId, pg: known.cause?.constraint ?? known.cause?.code }, known.message);
  }

  const body = {
    success: false,
    message: known?.message ?? 'Something went wrong. Please try again later.',
    error: { code: known?.code ?? 'INTERNAL_ERROR', i18nKey: known?.i18nKey ?? 'errors.generic' },
  };
  if (known?.details) body.errors = known.details;
  else if (known?.fields) body.errors = Object.entries(known.fields).map(([field, i18nKey]) => ({ field, message: known.message, i18nKey }));
  if (!env.isProduction && status >= 500) body.error.debug = err.message;
  if (req.id) body.requestId = req.id;

  res.status(status).json(body);
}
