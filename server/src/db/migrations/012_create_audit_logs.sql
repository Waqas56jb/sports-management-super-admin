-- Who changed what: attendance, match events, line-ups, training, player records, team assignments…
CREATE TABLE audit_logs (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id     uuid REFERENCES users(id) ON DELETE SET NULL,
  actor_role   text,
  action       text NOT NULL,
  entity_type  text NOT NULL,
  entity_id    uuid,
  changes      jsonb NOT NULL DEFAULT '{}'::jsonb,
  ip           text,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audit_logs_entity_idx ON audit_logs (entity_type, entity_id);
CREATE INDEX audit_logs_actor_idx ON audit_logs (actor_id, created_at DESC);
