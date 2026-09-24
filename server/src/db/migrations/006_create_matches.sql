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
