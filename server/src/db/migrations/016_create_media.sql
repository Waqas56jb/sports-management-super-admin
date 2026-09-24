-- Fallback image store used only when Supabase Storage is not configured (no service-role key).
-- Images are served by the API at /api/v1/media/:id. With SUPABASE_SERVICE_ROLE_KEY set, uploads
-- go to the Supabase Storage "uploads" bucket instead and this table stays empty.
CREATE TABLE media (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  folder        text NOT NULL,
  content_type  text NOT NULL,
  size          integer NOT NULL,
  data          bytea NOT NULL,
  created_by    uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT media_type_check CHECK (content_type IN ('image/jpeg', 'image/png', 'image/webp')),
  CONSTRAINT media_folder_check CHECK (folder IN ('players', 'coaches', 'teams', 'competitions', 'users')),
  CONSTRAINT media_size_check CHECK (size BETWEEN 1 AND 10485760)
);
ALTER TABLE media ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON media FROM anon, authenticated;
