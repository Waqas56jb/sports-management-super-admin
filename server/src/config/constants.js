/** Enumerations shared by validators, services and the database CHECK constraints. */

export const API_PREFIX = '/api/v1';
export const SERVICE_NAME = 'sports-management-api';

export const ROLES = ['admin', 'coach', 'player'];
export const USER_STATUSES = ['active', 'inactive', 'suspended', 'pending'];
export const PLAYER_STATUSES = ['active', 'inactive', 'suspended', 'pending'];
export const COACH_STATUSES = ['active', 'inactive'];
export const TEAM_STATUSES = ['active', 'inactive'];
export const GENDERS = ['male', 'female'];
export const TEAM_GENDERS = ['male', 'female', 'mixed'];
export const POSITIONS = ['goalkeeper', 'defender', 'midfielder', 'forward'];
export const PREFERRED_FEET = ['right', 'left', 'both'];
export const RELATIONS = ['father', 'mother', 'brother', 'sister', 'spouse', 'uncle', 'aunt', 'guardian', 'other'];
export const TEAM_CATEGORIES = ['senior', 'youth', 'academy'];
export const AGE_GROUPS = ['open', 'u23', 'u21', 'u19', 'u17', 'u15'];
export const COACH_TEAM_ROLES = ['head_coach', 'assistant_coach'];

export const COMPETITION_TYPES = ['league', 'tournament', 'cup'];
export const COMPETITION_STATUSES = ['upcoming', 'active', 'completed', 'cancelled'];
export const MATCH_STATUSES = ['scheduled', 'live', 'completed', 'postponed', 'cancelled'];
export const PLAYED_MATCH_STATUSES = ['completed', 'live'];
export const MATCH_EVENT_TYPES = ['goal', 'assist', 'yellow_card', 'red_card', 'substitution', 'own_goal', 'penalty'];
export const GOAL_EVENT_TYPES = ['goal', 'penalty'];
export const FORMATIONS = ['4-3-3', '4-4-2', '3-5-2', '4-2-3-1', '3-4-3', '5-3-2', '4-1-4-1'];
export const MATCH_STAT_KEYS = ['possession', 'shots', 'shots_on_target', 'corners', 'fouls', 'offsides', 'yellow_cards', 'red_cards', 'passes', 'completed_passes'];

export const TRAINING_TYPES = ['technical', 'tactical', 'fitness', 'recovery', 'strength', 'match_preparation', 'team_session', 'other'];
export const TRAINING_STATUSES = ['scheduled', 'completed', 'cancelled'];
export const ATTENDANCE_STATUSES = ['present', 'absent', 'late', 'excused', 'pending'];
export const RECORDED_ATTENDANCE = ['present', 'absent', 'late', 'excused'];

/** Notification categories (the `type` column) and the UI sub-types each app displays. */
export const NOTIFICATION_TYPES = ['match', 'training', 'attendance', 'team', 'competition', 'system', 'announcement'];
export const NOTIFICATION_SUBTYPES = {
  match_reminder: 'match',
  match_scheduled: 'match',
  match_result: 'match',
  lineup_announced: 'match',
  training_created: 'training',
  training_reminder: 'training',
  attendance_update: 'attendance',
  team_announcement: 'announcement',
  player_update: 'team',
  account_update: 'system',
  competition_update: 'competition',
  system: 'system',
};
export const ANNOUNCEMENT_AUDIENCES = ['all', 'coaches', 'players', 'team'];
export const TEAM_EVENT_KINDS = ['meeting', 'video', 'medical', 'community', 'other'];

/** Notification preference → the UI sub-types it silences. */
export const PREFERENCE_SUBTYPES = {
  match_reminders: ['match_reminder', 'match_scheduled', 'match_result', 'lineup_announced'],
  training_reminders: ['training_created', 'training_reminder'],
  attendance_updates: ['attendance_update'],
  team_announcements: ['team_announcement', 'player_update'],
  competition_updates: ['competition_update'],
  system_notifications: ['system', 'account_update'],
};
export const DEFAULT_PREFERENCES = {
  match_reminders: true,
  training_reminders: true,
  team_announcements: true,
  attendance_updates: true,
  competition_updates: true,
  system_notifications: false,
};

export const LANGUAGES = ['en', 'fr'];
export const THEMES = ['light', 'dark', 'system'];

export const PAGINATION = { defaultLimit: 20, maxLimit: 100 };
export const POINTS = { win: 3, draw: 1, loss: 0 };

/** Upload rules: images only, validated by MIME type, extension and magic bytes. */
export const IMAGE_TYPES = {
  'image/jpeg': ['jpg', 'jpeg'],
  'image/png': ['png'],
  'image/webp': ['webp'],
};
export const UPLOAD_FOLDERS = ['players', 'coaches', 'teams', 'competitions', 'users'];

/** English/French training labels so search matches what users read in either language. */
export const TRAINING_LABELS = {
  technical: ['Technical', 'Technique'],
  tactical: ['Tactical', 'Tactique'],
  fitness: ['Fitness', 'Condition physique'],
  recovery: ['Recovery', 'Récupération'],
  strength: ['Strength', 'Musculation'],
  match_preparation: ['Match preparation', 'Préparation de match'],
  team_session: ['Team session', "Séance d'équipe"],
  other: ['Other', 'Autre'],
};
