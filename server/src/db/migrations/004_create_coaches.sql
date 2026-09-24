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
