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
