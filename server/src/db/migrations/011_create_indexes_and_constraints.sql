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
