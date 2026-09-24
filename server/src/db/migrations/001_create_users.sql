-- Users: authentication identity for every role. Profile data lives in players / coaches.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TABLE users (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email                text NOT NULL,
  password_hash        text NOT NULL,
  first_name           text NOT NULL,
  last_name            text NOT NULL DEFAULT '',
  phone                text NOT NULL DEFAULT '',
  avatar_url           text,
  role                 text NOT NULL,
  status               text NOT NULL DEFAULT 'active',
  language             text NOT NULL DEFAULT 'en',
  theme                text NOT NULL DEFAULT 'system',
  last_login_at        timestamptz,
  password_changed_at  timestamptz,
  created_by           uuid REFERENCES users(id) ON DELETE SET NULL,
  updated_by           uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  deleted_at           timestamptz,
  CONSTRAINT users_role_check     CHECK (role IN ('admin', 'coach', 'player')),
  CONSTRAINT users_status_check   CHECK (status IN ('active', 'inactive', 'suspended', 'pending')),
  CONSTRAINT users_language_check CHECK (language IN ('en', 'fr')),
  CONSTRAINT users_theme_check    CHECK (theme IN ('light', 'dark', 'system')),
  CONSTRAINT users_email_format   CHECK (email = lower(email) AND email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  CONSTRAINT users_first_name_len CHECK (char_length(first_name) BETWEEN 1 AND 80)
);

-- Unique among non-deleted accounts (a removed account frees its email address).
CREATE UNIQUE INDEX users_email_unique ON users (email) WHERE deleted_at IS NULL;
CREATE INDEX users_role_idx ON users (role);
CREATE INDEX users_status_idx ON users (status);

CREATE TRIGGER users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- JWT sessions: one row per issued token so logout / refresh can revoke it server-side.
CREATE TABLE user_sessions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  portal      text,
  remember    boolean NOT NULL DEFAULT false,
  user_agent  text,
  ip          text,
  expires_at  timestamptz NOT NULL,
  revoked_at  timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX user_sessions_user_idx ON user_sessions (user_id);

-- Password reset tokens (only a SHA-256 hash of the token is stored).
CREATE TABLE password_reset_tokens (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash  text NOT NULL UNIQUE,
  expires_at  timestamptz NOT NULL,
  used_at     timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX password_reset_tokens_user_idx ON password_reset_tokens (user_id);
