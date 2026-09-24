export const APP_NAME = 'SportHub';

export const ROLES = ['super_admin', 'coach', 'player'];
export const ACCOUNT_STATUSES = ['active', 'inactive', 'suspended'];
export const COACH_STATUSES = ['active', 'inactive'];
export const TEAM_STATUSES = ['active', 'inactive'];
export const GENDERS = ['male', 'female'];
export const TEAM_GENDERS = ['male', 'female', 'mixed'];
export const POSITIONS = ['goalkeeper', 'defender', 'midfielder', 'forward'];
export const TEAM_CATEGORIES = ['senior', 'youth', 'academy'];
export const AGE_GROUPS = ['open', 'u23', 'u21', 'u19', 'u17', 'u15'];
export const COMPETITION_TYPES = ['league', 'tournament', 'cup'];
export const COMPETITION_STATUSES = ['upcoming', 'active', 'completed'];
export const MATCH_STATUSES = ['scheduled', 'live', 'completed', 'cancelled'];
export const TRAINING_TYPES = ['fitness', 'tactical', 'technical', 'recovery', 'match_preparation', 'other'];
export const ATTENDANCE_STATUSES = ['present', 'absent', 'late', 'excused'];
export const MATCH_EVENT_TYPES = ['goal', 'assist', 'yellow_card', 'red_card', 'substitution'];
export const NOTIFICATION_TYPES = [
  'training_reminder',
  'match_scheduled',
  'match_reminder',
  'attendance_update',
  'team_announcement',
  'player_update',
  'competition_update',
  'system',
];
export const TRAINING_STATUSES = ['scheduled', 'cancelled'];
export const MATCH_STAT_KEYS = ['possession', 'shots', 'shots_on_target', 'corners', 'fouls', 'offsides'];
export const FORMATIONS = ['4-3-3', '4-4-2', '3-5-2', '4-2-3-1'];

export const PAGE_SIZE = 10;

/** Fixed categorical hue per team slot — colour follows the entity, never its rank. */
export const TEAM_COLOR_VARS = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)',
  'var(--chart-6)',
];

/** Tone used by <Badge> for every status value in the app. */
export const STATUS_TONES = {
  active: 'success',
  inactive: 'neutral',
  suspended: 'danger',
  upcoming: 'info',
  completed: 'neutral',
  scheduled: 'info',
  live: 'live',
  cancelled: 'danger',
  present: 'success',
  absent: 'danger',
  late: 'warning',
  excused: 'info',
  super_admin: 'brand',
  coach: 'info',
  player: 'neutral',
};
