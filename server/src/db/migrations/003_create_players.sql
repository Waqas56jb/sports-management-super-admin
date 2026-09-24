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
