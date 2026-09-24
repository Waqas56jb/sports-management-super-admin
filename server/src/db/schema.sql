-- SportHub — Sports Management System: full PostgreSQL schema (Supabase).
-- GENERATED from src/db/migrations by `npm run schema:build`. Do not edit by hand;
-- add a new migration instead and run `npm run migrate`.

-- ============================================================ 001_create_users.sql
-- Users: authentication identity for every role. Profile data lives in players / coaches.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TABLE users (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email                text NOT NULL,
  password_hash        text NOT NULL,
  first_name           text NOT NULL,
  last_name            text NOT NULL DEFAULT '',
  phone                text NOT NULL DEFAULT '',
  avatar_url           text,
  role                 text NOT NULL,
  status               text NOT NULL DEFAULT 'active',
  language             text NOT NULL DEFAULT 'en',
  theme                text NOT NULL DEFAULT 'system',
  last_login_at        timestamptz,
  password_changed_at  timestamptz,
  created_by           uuid REFERENCES users(id) ON DELETE SET NULL,
  updated_by           uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  deleted_at           timestamptz,
  CONSTRAINT users_role_check     CHECK (role IN ('admin', 'coach', 'player')),
  CONSTRAINT users_status_check   CHECK (status IN ('active', 'inactive', 'suspended', 'pending')),
  CONSTRAINT users_language_check CHECK (language IN ('en', 'fr')),
  CONSTRAINT users_theme_check    CHECK (theme IN ('light', 'dark', 'system')),
  CONSTRAINT users_email_format   CHECK (email = lower(email) AND email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  CONSTRAINT users_first_name_len CHECK (char_length(first_name) BETWEEN 1 AND 80)
);

-- Unique among non-deleted accounts (a removed account frees its email address).
CREATE UNIQUE INDEX users_email_unique ON users (email) WHERE deleted_at IS NULL;
CREATE INDEX users_role_idx ON users (role);
CREATE INDEX users_status_idx ON users (status);

CREATE TRIGGER users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- JWT sessions: one row per issued token so logout / refresh can revoke it server-side.
CREATE TABLE user_sessions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  portal      text,
  remember    boolean NOT NULL DEFAULT false,
  user_agent  text,
  ip          text,
  expires_at  timestamptz NOT NULL,
  revoked_at  timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX user_sessions_user_idx ON user_sessions (user_id);

-- Password reset tokens (only a SHA-256 hash of the token is stored).
CREATE TABLE password_reset_tokens (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash  text NOT NULL UNIQUE,
  expires_at  timestamptz NOT NULL,
  used_at     timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX password_reset_tokens_user_idx ON password_reset_tokens (user_id);

-- ============================================================ 002_create_teams.sql
CREATE TABLE teams (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name         text NOT NULL,
  short_name   text NOT NULL,
  logo_url     text,
  description  text NOT NULL DEFAULT '',
  city         text NOT NULL DEFAULT '',
  country      text NOT NULL DEFAULT 'DJ',
  category     text NOT NULL DEFAULT 'senior',
  age_group    text NOT NULL DEFAULT 'open',
  gender       text NOT NULL DEFAULT 'male',
  home_ground  text NOT NULL DEFAULT '',
  founded      smallint,
  color        smallint NOT NULL DEFAULT 0,
  status       text NOT NULL DEFAULT 'active',
  created_by   uuid REFERENCES users(id) ON DELETE SET NULL,
  updated_by   uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  deleted_at   timestamptz,
  CONSTRAINT teams_status_check    CHECK (status IN ('active', 'inactive')),
  CONSTRAINT teams_category_check  CHECK (category IN ('senior', 'youth', 'academy')),
  CONSTRAINT teams_age_group_check CHECK (age_group IN ('open', 'u23', 'u21', 'u19', 'u17', 'u15')),
  CONSTRAINT teams_gender_check    CHECK (gender IN ('male', 'female', 'mixed')),
  CONSTRAINT teams_name_len        CHECK (char_length(name) BETWEEN 2 AND 80),
  CONSTRAINT teams_short_name_len  CHECK (char_length(short_name) BETWEEN 2 AND 5),
  CONSTRAINT teams_founded_range   CHECK (founded IS NULL OR founded BETWEEN 1850 AND 2100),
  CONSTRAINT teams_color_range     CHECK (color BETWEEN 0 AND 11)
);
CREATE UNIQUE INDEX teams_name_unique ON teams (lower(name)) WHERE deleted_at IS NULL;
CREATE INDEX teams_status_idx ON teams (status);
CREATE TRIGGER teams_updated_at BEFORE UPDATE ON teams FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Non-training team events shown on calendars (meetings, video sessions, medicals…).
CREATE TABLE team_events (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id     uuid NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  kind        text NOT NULL DEFAULT 'meeting',
  title       text NOT NULL DEFAULT '',
  date        date NOT NULL,
  start_time  time NOT NULL,
  end_time    time NOT NULL,
  location    text NOT NULL DEFAULT '',
  created_by  uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT team_events_kind_check CHECK (kind IN ('meeting', 'video', 'medical', 'community', 'other')),
  CONSTRAINT team_events_time_check CHECK (end_time > start_time)
);
CREATE INDEX team_events_team_date_idx ON team_events (team_id, date);
CREATE TRIGGER team_events_updated_at BEFORE UPDATE ON team_events FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================ 003_create_players.sql
CREATE TABLE players (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                     uuid NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  player_code                 text NOT NULL,
  date_of_birth               date,
  gender                      text NOT NULL DEFAULT 'male',
  nationality                 char(2) NOT NULL DEFAULT 'DJ',
  address                     text NOT NULL DEFAULT '',
  emergency_contact_name      text NOT NULL DEFAULT '',
  emergency_contact_phone     text NOT NULL DEFAULT '',
  emergency_contact_relation  text NOT NULL DEFAULT '',
  jersey_number               smallint,
  position                    text NOT NULL DEFAULT 'midfielder',
  secondary_position          text,
  preferred_foot              text NOT NULL DEFAULT 'right',
  height                      smallint,
  weight                      smallint,
  status                      text NOT NULL DEFAULT 'active',
  registration_date           date NOT NULL DEFAULT CURRENT_DATE,
  license_number              text,
  license_valid_until         date,
  team_id                     uuid REFERENCES teams(id) ON DELETE SET NULL,
  created_by                  uuid REFERENCES users(id) ON DELETE SET NULL,
  updated_by                  uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at                  timestamptz NOT NULL DEFAULT now(),
  updated_at                  timestamptz NOT NULL DEFAULT now(),
  deleted_at                  timestamptz,
  CONSTRAINT players_status_check        CHECK (status IN ('active', 'inactive', 'suspended', 'pending')),
  CONSTRAINT players_gender_check        CHECK (gender IN ('male', 'female')),
  CONSTRAINT players_position_check      CHECK (position IN ('goalkeeper', 'defender', 'midfielder', 'forward')),
  CONSTRAINT players_secondary_check     CHECK (secondary_position IS NULL OR secondary_position IN ('goalkeeper', 'defender', 'midfielder', 'forward')),
  CONSTRAINT players_foot_check          CHECK (preferred_foot IN ('right', 'left', 'both')),
  CONSTRAINT players_jersey_range        CHECK (jersey_number IS NULL OR jersey_number BETWEEN 1 AND 99),
  CONSTRAINT players_height_range        CHECK (height IS NULL OR height BETWEEN 120 AND 230),
  CONSTRAINT players_weight_range        CHECK (weight IS NULL OR weight BETWEEN 35 AND 150),
  CONSTRAINT players_nationality_format  CHECK (nationality ~ '^[A-Z]{2}$')
);
CREATE UNIQUE INDEX players_code_unique ON players (player_code);
-- A shirt number can only be worn by one current member of a team.
CREATE UNIQUE INDEX players_team_jersey_unique ON players (team_id, jersey_number)
  WHERE team_id IS NOT NULL AND jersey_number IS NOT NULL AND deleted_at IS NULL;
CREATE INDEX players_team_idx ON players (team_id);
CREATE INDEX players_status_idx ON players (status);
CREATE TRIGGER players_updated_at BEFORE UPDATE ON players FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Team membership history. players.team_id is the current team; this table keeps every spell.
CREATE TABLE team_players (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id     uuid NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  player_id   uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  joined_at   date NOT NULL DEFAULT CURRENT_DATE,
  left_at     date,
  status      text NOT NULL DEFAULT 'active',
  created_by  uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT team_players_status_check CHECK (status IN ('active', 'left')),
  CONSTRAINT team_players_dates_check  CHECK (left_at IS NULL OR left_at >= joined_at),
  CONSTRAINT team_players_open_check   CHECK ((status = 'active') = (left_at IS NULL))
);
-- At most one open membership per player.
CREATE UNIQUE INDEX team_players_one_active ON team_players (player_id) WHERE left_at IS NULL;
CREATE INDEX team_players_team_idx ON team_players (team_id);
CREATE INDEX team_players_player_idx ON team_players (player_id);

-- ============================================================ 004_create_coaches.sql
CREATE TABLE coaches (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  coach_code        text NOT NULL,
  license           text NOT NULL DEFAULT '',
  experience_years  smallint NOT NULL DEFAULT 0,
  specialization    text NOT NULL DEFAULT '',
  phone             text NOT NULL DEFAULT '',
  gender            text NOT NULL DEFAULT 'male',
  status            text NOT NULL DEFAULT 'active',
  created_by        uuid REFERENCES users(id) ON DELETE SET NULL,
  updated_by        uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  deleted_at        timestamptz,
  CONSTRAINT coaches_status_check     CHECK (status IN ('active', 'inactive')),
  CONSTRAINT coaches_gender_check     CHECK (gender IN ('male', 'female')),
  CONSTRAINT coaches_experience_range CHECK (experience_years BETWEEN 0 AND 60)
);
CREATE UNIQUE INDEX coaches_code_unique ON coaches (coach_code);
CREATE INDEX coaches_status_idx ON coaches (status);
CREATE TRIGGER coaches_updated_at BEFORE UPDATE ON coaches FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- A coach can work with several teams; each team has at most one head coach.
CREATE TABLE coach_teams (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id    uuid NOT NULL REFERENCES coaches(id) ON DELETE CASCADE,
  team_id     uuid NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  role        text NOT NULL DEFAULT 'head_coach',
  created_by  uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT coach_teams_role_check CHECK (role IN ('head_coach', 'assistant_coach')),
  CONSTRAINT coach_teams_unique UNIQUE (coach_id, team_id)
);
CREATE UNIQUE INDEX coach_teams_one_head ON coach_teams (team_id) WHERE role = 'head_coach';
CREATE INDEX coach_teams_coach_idx ON coach_teams (coach_id);
CREATE INDEX coach_teams_team_idx ON coach_teams (team_id);

-- ============================================================ 005_create_competitions.sql
CREATE TABLE competitions (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name         text NOT NULL,
  type         text NOT NULL DEFAULT 'league',
  season       text NOT NULL,
  description  text NOT NULL DEFAULT '',
  start_date   date NOT NULL,
  end_date     date NOT NULL,
  status       text NOT NULL DEFAULT 'upcoming',
  location     text NOT NULL DEFAULT '',
  image_url    text,
  created_by   uuid REFERENCES users(id) ON DELETE SET NULL,
  updated_by   uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  deleted_at   timestamptz,
  CONSTRAINT competitions_type_check   CHECK (type IN ('league', 'tournament', 'cup')),
  CONSTRAINT competitions_status_check CHECK (status IN ('upcoming', 'active', 'completed', 'cancelled')),
  CONSTRAINT competitions_dates_check  CHECK (end_date >= start_date),
  CONSTRAINT competitions_name_len     CHECK (char_length(name) BETWEEN 2 AND 120)
);
CREATE UNIQUE INDEX competitions_name_season_unique ON competitions (lower(name), season) WHERE deleted_at IS NULL;
CREATE INDEX competitions_status_idx ON competitions (status);
CREATE INDEX competitions_dates_idx ON competitions (start_date, end_date);
CREATE TRIGGER competitions_updated_at BEFORE UPDATE ON competitions FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Participating teams + the server-calculated standings row for each.
CREATE TABLE competition_teams (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  competition_id  uuid NOT NULL REFERENCES competitions(id) ON DELETE CASCADE,
  team_id         uuid NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  played          smallint NOT NULL DEFAULT 0,
  won             smallint NOT NULL DEFAULT 0,
  drawn           smallint NOT NULL DEFAULT 0,
  lost            smallint NOT NULL DEFAULT 0,
  goals_for       smallint NOT NULL DEFAULT 0,
  goals_against   smallint NOT NULL DEFAULT 0,
  points          smallint NOT NULL DEFAULT 0,
  position        smallint,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT competition_teams_unique UNIQUE (competition_id, team_id),
  CONSTRAINT competition_teams_non_negative CHECK (played >= 0 AND won >= 0 AND drawn >= 0 AND lost >= 0 AND goals_for >= 0 AND goals_against >= 0),
  CONSTRAINT competition_teams_played_sum CHECK (played = won + drawn + lost)
);
CREATE INDEX competition_teams_team_idx ON competition_teams (team_id);
CREATE TRIGGER competition_teams_updated_at BEFORE UPDATE ON competition_teams FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================ 006_create_matches.sql
CREATE TABLE matches (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  competition_id   uuid REFERENCES competitions(id) ON DELETE RESTRICT,
  home_team_id     uuid NOT NULL REFERENCES teams(id) ON DELETE RESTRICT,
  away_team_id     uuid NOT NULL REFERENCES teams(id) ON DELETE RESTRICT,
  match_date       date NOT NULL,
  match_time       time NOT NULL DEFAULT '16:30',
  venue            text NOT NULL DEFAULT '',
  status           text NOT NULL DEFAULT 'scheduled',
  home_score       smallint,
  away_score       smallint,
  live_minute      smallint,
  round            smallint,
  referee          text NOT NULL DEFAULT '',
  notes            text NOT NULL DEFAULT '',
  home_formation   text,
  away_formation   text,
  created_by       uuid REFERENCES users(id) ON DELETE SET NULL,
  updated_by       uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  deleted_at       timestamptz,
  CONSTRAINT matches_status_check     CHECK (status IN ('scheduled', 'live', 'completed', 'postponed', 'cancelled')),
  CONSTRAINT matches_distinct_teams   CHECK (home_team_id <> away_team_id),
  CONSTRAINT matches_score_range      CHECK ((home_score IS NULL OR home_score BETWEEN 0 AND 99) AND (away_score IS NULL OR away_score BETWEEN 0 AND 99)),
  CONSTRAINT matches_score_pair       CHECK ((home_score IS NULL) = (away_score IS NULL)),
  CONSTRAINT matches_played_has_score CHECK (status NOT IN ('live', 'completed') OR home_score IS NOT NULL),
  CONSTRAINT matches_live_minute      CHECK (live_minute IS NULL OR live_minute BETWEEN 0 AND 130),
  CONSTRAINT matches_round_range      CHECK (round IS NULL OR round BETWEEN 1 AND 99)
);
CREATE INDEX matches_competition_idx ON matches (competition_id);
CREATE INDEX matches_home_team_idx ON matches (home_team_id);
CREATE INDEX matches_away_team_idx ON matches (away_team_id);
CREATE INDEX matches_date_idx ON matches (match_date);
CREATE INDEX matches_status_idx ON matches (status);
CREATE TRIGGER matches_updated_at BEFORE UPDATE ON matches FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE match_lineups (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id          uuid NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  team_id           uuid NOT NULL REFERENCES teams(id) ON DELETE RESTRICT,
  player_id         uuid NOT NULL REFERENCES players(id) ON DELETE RESTRICT,
  is_starting       boolean NOT NULL DEFAULT true,
  position          text,
  shirt_number      smallint,
  sort_order        smallint NOT NULL DEFAULT 0,
  substitute_order  smallint,
  created_by        uuid REFERENCES users(id) ON DELETE SET NULL,
  updated_by        uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT match_lineups_unique_player UNIQUE (match_id, player_id),
  CONSTRAINT match_lineups_sub_order CHECK (is_starting OR substitute_order IS NOT NULL)
);
CREATE INDEX match_lineups_match_team_idx ON match_lineups (match_id, team_id);
CREATE INDEX match_lineups_player_idx ON match_lineups (player_id);
CREATE TRIGGER match_lineups_updated_at BEFORE UPDATE ON match_lineups FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE match_events (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id           uuid NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  team_id            uuid NOT NULL REFERENCES teams(id) ON DELETE RESTRICT,
  player_id          uuid NOT NULL REFERENCES players(id) ON DELETE RESTRICT,
  event_type         text NOT NULL,
  minute             smallint NOT NULL,
  additional_minute  smallint,
  description        text NOT NULL DEFAULT '',
  -- substitution: player_id = player coming on, related_player_id = player going off
  -- assist:       related_player_id = the scorer
  related_player_id  uuid REFERENCES players(id) ON DELETE RESTRICT,
  created_by         uuid REFERENCES users(id) ON DELETE SET NULL,
  updated_by         uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT match_events_type_check      CHECK (event_type IN ('goal', 'assist', 'yellow_card', 'red_card', 'substitution', 'own_goal', 'penalty')),
  CONSTRAINT match_events_minute_range    CHECK (minute BETWEEN 0 AND 130),
  CONSTRAINT match_events_added_range     CHECK (additional_minute IS NULL OR additional_minute BETWEEN 0 AND 30),
  CONSTRAINT match_events_distinct_people CHECK (related_player_id IS NULL OR related_player_id <> player_id),
  CONSTRAINT match_events_pair_required   CHECK (event_type NOT IN ('substitution', 'assist') OR related_player_id IS NOT NULL)
);
CREATE INDEX match_events_match_idx ON match_events (match_id, minute);
CREATE INDEX match_events_player_idx ON match_events (player_id);
CREATE INDEX match_events_type_idx ON match_events (event_type);
CREATE TRIGGER match_events_updated_at BEFORE UPDATE ON match_events FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================ 007_create_training.sql
CREATE TABLE training_sessions (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id              uuid NOT NULL REFERENCES teams(id) ON DELETE RESTRICT,
  coach_id             uuid REFERENCES coaches(id) ON DELETE SET NULL,
  title                text NOT NULL DEFAULT '',
  type                 text NOT NULL DEFAULT 'technical',
  date                 date NOT NULL,
  start_time           time NOT NULL,
  end_time             time NOT NULL,
  location             text NOT NULL DEFAULT '',
  description          text NOT NULL DEFAULT '',
  -- Translation keys for seeded plans (the UIs render them in the reader's language).
  description_key      text,
  objectives           text[] NOT NULL DEFAULT '{}',
  player_note          text,
  -- Private coach notes: never returned to players.
  notes                text NOT NULL DEFAULT '',
  status               text NOT NULL DEFAULT 'scheduled',
  cancellation_reason  text NOT NULL DEFAULT '',
  cancellation_key     text,
  created_by           uuid REFERENCES users(id) ON DELETE SET NULL,
  updated_by           uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  deleted_at           timestamptz,
  CONSTRAINT training_type_check   CHECK (type IN ('technical', 'tactical', 'fitness', 'recovery', 'strength', 'match_preparation', 'team_session', 'other')),
  CONSTRAINT training_status_check CHECK (status IN ('scheduled', 'completed', 'cancelled')),
  CONSTRAINT training_time_check   CHECK (end_time > start_time)
);
CREATE INDEX training_sessions_team_idx ON training_sessions (team_id);
CREATE INDEX training_sessions_coach_idx ON training_sessions (coach_id);
CREATE INDEX training_sessions_date_idx ON training_sessions (date);
CREATE INDEX training_sessions_status_idx ON training_sessions (status);
CREATE TRIGGER training_sessions_updated_at BEFORE UPDATE ON training_sessions FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================ 008_create_attendance.sql
CREATE TABLE training_attendance (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  training_session_id  uuid NOT NULL REFERENCES training_sessions(id) ON DELETE CASCADE,
  player_id            uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  status               text NOT NULL,
  notes                text NOT NULL DEFAULT '',
  marked_by            uuid REFERENCES users(id) ON DELETE SET NULL,
  marked_at            timestamptz NOT NULL DEFAULT now(),
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT training_attendance_status_check CHECK (status IN ('present', 'absent', 'late', 'excused', 'pending')),
  CONSTRAINT training_attendance_unique UNIQUE (training_session_id, player_id)
);
CREATE INDEX training_attendance_player_idx ON training_attendance (player_id);
CREATE INDEX training_attendance_session_idx ON training_attendance (training_session_id);
CREATE INDEX training_attendance_status_idx ON training_attendance (status);
CREATE TRIGGER training_attendance_updated_at BEFORE UPDATE ON training_attendance FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================ 009_create_statistics.sql
-- Team statistics per match (one row per side).
CREATE TABLE match_statistics (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id          uuid NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  team_id           uuid NOT NULL REFERENCES teams(id) ON DELETE RESTRICT,
  possession        smallint NOT NULL DEFAULT 50,
  shots             smallint NOT NULL DEFAULT 0,
  shots_on_target   smallint NOT NULL DEFAULT 0,
  corners           smallint NOT NULL DEFAULT 0,
  fouls             smallint NOT NULL DEFAULT 0,
  offsides          smallint NOT NULL DEFAULT 0,
  yellow_cards      smallint NOT NULL DEFAULT 0,
  red_cards         smallint NOT NULL DEFAULT 0,
  passes            smallint NOT NULL DEFAULT 0,
  completed_passes  smallint NOT NULL DEFAULT 0,
  updated_by        uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT match_statistics_unique UNIQUE (match_id, team_id),
  CONSTRAINT match_statistics_possession CHECK (possession BETWEEN 0 AND 100),
  CONSTRAINT match_statistics_non_negative CHECK (shots >= 0 AND shots_on_target >= 0 AND corners >= 0 AND fouls >= 0 AND offsides >= 0 AND yellow_cards >= 0 AND red_cards >= 0 AND passes >= 0 AND completed_passes >= 0),
  CONSTRAINT match_statistics_on_target CHECK (shots_on_target <= shots),
  CONSTRAINT match_statistics_passes CHECK (completed_passes <= passes)
);
CREATE INDEX match_statistics_team_idx ON match_statistics (team_id);
CREATE TRIGGER match_statistics_updated_at BEFORE UPDATE ON match_statistics FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Per-player performance in one match. Rebuilt by the API from the line-up and match events
-- whenever either changes, so aggregates are simple SUMs.
CREATE TABLE player_match_statistics (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id          uuid NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  player_id         uuid NOT NULL REFERENCES players(id) ON DELETE RESTRICT,
  team_id           uuid NOT NULL REFERENCES teams(id) ON DELETE RESTRICT,
  started           boolean NOT NULL DEFAULT false,
  minutes_played    smallint NOT NULL DEFAULT 0,
  goals             smallint NOT NULL DEFAULT 0,
  assists           smallint NOT NULL DEFAULT 0,
  shots             smallint NOT NULL DEFAULT 0,
  shots_on_target   smallint NOT NULL DEFAULT 0,
  passes            smallint NOT NULL DEFAULT 0,
  completed_passes  smallint NOT NULL DEFAULT 0,
  pass_accuracy     numeric(5,1),
  key_passes        smallint NOT NULL DEFAULT 0,
  fouls             smallint NOT NULL DEFAULT 0,
  yellow_cards      smallint NOT NULL DEFAULT 0,
  red_cards         smallint NOT NULL DEFAULT 0,
  rating            numeric(3,1),
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT player_match_statistics_unique UNIQUE (match_id, player_id),
  CONSTRAINT pms_minutes_range CHECK (minutes_played BETWEEN 0 AND 130),
  CONSTRAINT pms_non_negative CHECK (goals >= 0 AND assists >= 0 AND shots >= 0 AND passes >= 0 AND fouls >= 0 AND yellow_cards >= 0 AND red_cards >= 0 AND key_passes >= 0),
  CONSTRAINT pms_goals_on_target CHECK (shots_on_target <= shots),
  CONSTRAINT pms_passes CHECK (completed_passes <= passes),
  CONSTRAINT pms_rating_range CHECK (rating IS NULL OR rating BETWEEN 0 AND 10),
  CONSTRAINT pms_accuracy_range CHECK (pass_accuracy IS NULL OR pass_accuracy BETWEEN 0 AND 100)
);
CREATE INDEX player_match_statistics_player_idx ON player_match_statistics (player_id);
CREATE INDEX player_match_statistics_team_idx ON player_match_statistics (team_id);
CREATE TRIGGER player_match_statistics_updated_at BEFORE UPDATE ON player_match_statistics FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================ 010_create_notifications.sql
CREATE TABLE notifications (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  -- Category used for filtering and preferences.
  type            text NOT NULL,
  -- Finer UI type (match_reminder, training_created…) that drives icons in the apps.
  subtype         text NOT NULL,
  title           text NOT NULL,
  message         text NOT NULL DEFAULT '',
  -- Translation template + parameters so each app renders the text in the reader's language.
  template        text,
  params          jsonb NOT NULL DEFAULT '{}'::jsonb,
  reference_type  text,
  reference_id    uuid,
  link_query      text,
  is_read         boolean NOT NULL DEFAULT false,
  read_at         timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT notifications_type_check CHECK (type IN ('match', 'training', 'attendance', 'team', 'competition', 'system', 'announcement')),
  CONSTRAINT notifications_reference_check CHECK (reference_type IS NULL OR reference_type IN ('match', 'match_lineup', 'training', 'attendance', 'team', 'competition', 'player', 'coach', 'users', 'calendar', 'profile'))
);
CREATE INDEX notifications_user_idx ON notifications (user_id, created_at DESC);
CREATE INDEX notifications_unread_idx ON notifications (user_id) WHERE is_read = false;
CREATE INDEX notifications_is_read_idx ON notifications (is_read);

CREATE TABLE notification_preferences (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               uuid NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  match_reminders       boolean NOT NULL DEFAULT true,
  training_reminders    boolean NOT NULL DEFAULT true,
  team_announcements    boolean NOT NULL DEFAULT true,
  attendance_updates    boolean NOT NULL DEFAULT true,
  competition_updates   boolean NOT NULL DEFAULT true,
  system_notifications  boolean NOT NULL DEFAULT false,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER notification_preferences_updated_at BEFORE UPDATE ON notification_preferences FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Announcements sent by administrators (each recipient also gets a notification row).
CREATE TABLE announcements (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title       text NOT NULL,
  message     text NOT NULL,
  audience    text NOT NULL,
  team_id     uuid REFERENCES teams(id) ON DELETE SET NULL,
  recipients  integer NOT NULL DEFAULT 0,
  created_by  uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT announcements_audience_check CHECK (audience IN ('all', 'coaches', 'players', 'team')),
  CONSTRAINT announcements_team_check CHECK (audience <> 'team' OR team_id IS NOT NULL),
  CONSTRAINT announcements_title_len CHECK (char_length(title) BETWEEN 3 AND 120)
);
CREATE INDEX announcements_created_idx ON announcements (created_at DESC);

-- ============================================================ 011_create_indexes_and_constraints.sql
-- Cross-table integrity rules enforced by the database itself (in addition to the API checks).

-- Line-ups, events and statistics must belong to one of the two teams playing the match.
CREATE OR REPLACE FUNCTION assert_team_in_match() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  ok boolean;
BEGIN
  SELECT NEW.team_id IN (m.home_team_id, m.away_team_id) INTO ok FROM matches m WHERE m.id = NEW.match_id;
  IF NOT coalesce(ok, false) THEN
    RAISE EXCEPTION 'team % does not play in match %', NEW.team_id, NEW.match_id USING ERRCODE = '23514', CONSTRAINT = 'team_in_match';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER match_lineups_team_in_match BEFORE INSERT OR UPDATE ON match_lineups
  FOR EACH ROW EXECUTE FUNCTION assert_team_in_match();
CREATE TRIGGER match_events_team_in_match BEFORE INSERT OR UPDATE ON match_events
  FOR EACH ROW EXECUTE FUNCTION assert_team_in_match();
CREATE TRIGGER match_statistics_team_in_match BEFORE INSERT OR UPDATE ON match_statistics
  FOR EACH ROW EXECUTE FUNCTION assert_team_in_match();
CREATE TRIGGER player_match_statistics_team_in_match BEFORE INSERT OR UPDATE ON player_match_statistics
  FOR EACH ROW EXECUTE FUNCTION assert_team_in_match();

-- Matches in a competition must be between teams entered in that competition.
CREATE OR REPLACE FUNCTION assert_match_teams_in_competition() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.competition_id IS NOT NULL AND (
    SELECT count(*) FROM competition_teams ct
    WHERE ct.competition_id = NEW.competition_id AND ct.team_id IN (NEW.home_team_id, NEW.away_team_id)
  ) < 2 THEN
    RAISE EXCEPTION 'both teams must be entered in the competition' USING ERRCODE = '23514', CONSTRAINT = 'match_teams_in_competition';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER matches_teams_in_competition BEFORE INSERT OR UPDATE OF competition_id, home_team_id, away_team_id ON matches
  FOR EACH ROW EXECUTE FUNCTION assert_match_teams_in_competition();

-- Composite indexes for the most common filtered reads.
CREATE INDEX matches_live_scope_idx ON matches (status, match_date) WHERE deleted_at IS NULL;
CREATE INDEX training_sessions_team_date_idx ON training_sessions (team_id, date) WHERE deleted_at IS NULL;
CREATE INDEX players_active_team_idx ON players (team_id, status) WHERE deleted_at IS NULL;
CREATE INDEX match_events_match_type_idx ON match_events (match_id, event_type);

-- ============================================================ 012_create_audit_logs.sql
-- Who changed what: attendance, match events, line-ups, training, player records, team assignments…
CREATE TABLE audit_logs (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id     uuid REFERENCES users(id) ON DELETE SET NULL,
  actor_role   text,
  action       text NOT NULL,
  entity_type  text NOT NULL,
  entity_id    uuid,
  changes      jsonb NOT NULL DEFAULT '{}'::jsonb,
  ip           text,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audit_logs_entity_idx ON audit_logs (entity_type, entity_id);
CREATE INDEX audit_logs_actor_idx ON audit_logs (actor_id, created_at DESC);

-- ============================================================ 013_security_and_storage.sql
-- The frontends talk only to the Node.js API. Supabase also exposes the public schema through its
-- REST API to anyone holding the publishable (anon) key, so Row Level Security is enabled on every
-- table WITHOUT policies: the anon/authenticated roles get no rows at all. The API connects as the
-- table owner, which is not subject to (non-forced) RLS.
DO $$
DECLARE
  t text;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
  END LOOP;
END;
$$;

REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM anon, authenticated;
-- Tables created by later migrations stay closed too.
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM anon, authenticated;

-- Public-read bucket for images (profile photos, team logos). Writes go through the API only.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'storage' AND table_name = 'buckets') THEN
    INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    VALUES ('uploads', 'uploads', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp'])
    ON CONFLICT (id) DO NOTHING;
  END IF;
END;
$$;

-- ============================================================ 014_create_views.sql
-- Read models used by the API. security_invoker = true means the caller's privileges (and RLS)
-- apply, so the public anon role still sees nothing through these views.

CREATE VIEW v_players WITH (security_invoker = true) AS
SELECT
  p.id, p.user_id, p.player_code, p.date_of_birth, p.gender, p.nationality, p.address,
  p.emergency_contact_name, p.emergency_contact_phone, p.emergency_contact_relation,
  p.jersey_number, p.position, p.secondary_position, p.preferred_foot, p.height, p.weight,
  p.status, p.registration_date, p.license_number, p.license_valid_until, p.team_id,
  p.created_at, p.updated_at,
  trim(u.first_name || ' ' || u.last_name) AS name,
  u.first_name, u.last_name, u.email, u.phone, u.avatar_url AS photo,
  u.status AS account_status, u.last_login_at
FROM players p
JOIN users u ON u.id = p.user_id
WHERE p.deleted_at IS NULL AND u.deleted_at IS NULL;

CREATE VIEW v_coaches WITH (security_invoker = true) AS
SELECT
  c.id, c.user_id, c.coach_code, c.license, c.experience_years AS experience, c.specialization,
  c.gender, c.status, c.created_at, c.updated_at,
  trim(u.first_name || ' ' || u.last_name) AS name,
  u.first_name, u.last_name, u.email, u.phone, u.avatar_url AS photo,
  u.status AS account_status, u.last_login_at,
  coalesce((
    SELECT array_agg(ct.team_id ORDER BY (ct.role <> 'head_coach'), t.name)
    FROM coach_teams ct JOIN teams t ON t.id = ct.team_id AND t.deleted_at IS NULL
    WHERE ct.coach_id = c.id
  ), '{}'::uuid[]) AS team_ids,
  (
    SELECT ct.team_id
    FROM coach_teams ct JOIN teams t ON t.id = ct.team_id AND t.deleted_at IS NULL
    WHERE ct.coach_id = c.id AND ct.role = 'head_coach'
    ORDER BY t.name
    LIMIT 1
  ) AS team_id
FROM coaches c
JOIN users u ON u.id = c.user_id
WHERE c.deleted_at IS NULL AND u.deleted_at IS NULL;

CREATE VIEW v_teams WITH (security_invoker = true) AS
SELECT
  t.id, t.name, t.short_name, t.logo_url AS logo, t.description, t.city, t.country, t.category,
  t.age_group, t.gender, t.home_ground, t.founded, t.color, t.status, t.created_at, t.updated_at,
  (
    SELECT ct.coach_id FROM coach_teams ct JOIN coaches c ON c.id = ct.coach_id AND c.deleted_at IS NULL
    WHERE ct.team_id = t.id AND ct.role = 'head_coach' LIMIT 1
  ) AS coach_id,
  (
    SELECT ct.coach_id FROM coach_teams ct JOIN coaches c ON c.id = ct.coach_id AND c.deleted_at IS NULL
    WHERE ct.team_id = t.id AND ct.role = 'assistant_coach' ORDER BY ct.created_at LIMIT 1
  ) AS assistant_coach_id
FROM teams t
WHERE t.deleted_at IS NULL;

CREATE VIEW v_competitions WITH (security_invoker = true) AS
SELECT
  c.id, c.name, c.type, c.season, c.description, c.start_date, c.end_date, c.status, c.location,
  c.image_url, c.created_at, c.updated_at,
  coalesce((
    SELECT array_agg(ct.team_id ORDER BY t.name)
    FROM competition_teams ct JOIN teams t ON t.id = ct.team_id AND t.deleted_at IS NULL
    WHERE ct.competition_id = c.id
  ), '{}'::uuid[]) AS team_ids
FROM competitions c
WHERE c.deleted_at IS NULL;

CREATE VIEW v_matches WITH (security_invoker = true) AS
SELECT
  m.id, m.competition_id, m.home_team_id, m.away_team_id,
  m.match_date AS date, to_char(m.match_time, 'HH24:MI') AS time, m.venue AS location,
  m.referee, m.round, m.status, m.home_score, m.away_score, m.live_minute, m.notes,
  m.home_formation, m.away_formation, m.created_at, m.updated_at
FROM matches m
WHERE m.deleted_at IS NULL;

CREATE VIEW v_training_sessions WITH (security_invoker = true) AS
SELECT
  s.id, s.team_id, s.coach_id, s.title, s.type AS training_type, s.date,
  to_char(s.start_time, 'HH24:MI') AS start_time, to_char(s.end_time, 'HH24:MI') AS end_time,
  s.location, s.description, s.description_key, s.objectives, s.player_note, s.notes, s.status,
  s.cancellation_reason, s.cancellation_key, s.created_at, s.updated_at
FROM training_sessions s
WHERE s.deleted_at IS NULL;

REVOKE ALL ON v_players, v_coaches, v_teams, v_competitions, v_matches, v_training_sessions FROM anon, authenticated;

-- ============================================================ 015_search_helpers.sql
-- Accent/case-insensitive search ("ismael" finds "Ismaël").
CREATE EXTENSION IF NOT EXISTS unaccent WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION unaccent_ci(value text) RETURNS text
LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT
SET search_path = public, extensions
AS $$ SELECT lower(extensions.unaccent('extensions.unaccent'::regdictionary, value)) $$;

REVOKE EXECUTE ON FUNCTION unaccent_ci(text) FROM anon, authenticated;

-- ============================================================ 016_create_media.sql
-- Fallback image store used only when Supabase Storage is not configured (no service-role key).
-- Images are served by the API at /api/v1/media/:id. With SUPABASE_SERVICE_ROLE_KEY set, uploads
-- go to the Supabase Storage "uploads" bucket instead and this table stays empty.
CREATE TABLE media (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  folder        text NOT NULL,
  content_type  text NOT NULL,
  size          integer NOT NULL,
  data          bytea NOT NULL,
  created_by    uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT media_type_check CHECK (content_type IN ('image/jpeg', 'image/png', 'image/webp')),
  CONSTRAINT media_folder_check CHECK (folder IN ('players', 'coaches', 'teams', 'competitions', 'users')),
  CONSTRAINT media_size_check CHECK (size BETWEEN 1 AND 10485760)
);
ALTER TABLE media ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON media FROM anon, authenticated;
