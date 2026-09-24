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
