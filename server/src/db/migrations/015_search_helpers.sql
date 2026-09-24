-- Accent/case-insensitive search ("ismael" finds "Ismaël").
CREATE EXTENSION IF NOT EXISTS unaccent WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION unaccent_ci(value text) RETURNS text
LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT
SET search_path = public, extensions
AS $$ SELECT lower(extensions.unaccent('extensions.unaccent'::regdictionary, value)) $$;

REVOKE EXECUTE ON FUNCTION unaccent_ci(text) FROM anon, authenticated;
