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
