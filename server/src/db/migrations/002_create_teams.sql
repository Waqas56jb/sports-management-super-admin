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
