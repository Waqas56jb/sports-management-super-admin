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
