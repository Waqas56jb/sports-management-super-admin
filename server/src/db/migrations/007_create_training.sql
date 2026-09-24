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
