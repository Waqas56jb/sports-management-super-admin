-- Read models used by the API. security_invoker = true means the caller's privileges (and RLS)
-- apply, so the public anon role still sees nothing through these views.

CREATE VIEW v_players WITH (security_invoker = true) AS
SELECT
  p.id, p.user_id, p.player_code, p.date_of_birth, p.gender, p.nationality, p.address,
  p.emergency_contact_name, p.emergency_contact_phone, p.emergency_contact_relation,
  p.jersey_number, p.position, p.secondary_position, p.preferred_foot, p.height, p.weight,
  p.status, p.registration_date, p.license_number, p.license_valid_until, p.team_id,
  p.created_at, p.updated_at,
  trim(u.first_name || ' ' || u.last_name) AS name,
  u.first_name, u.last_name, u.email, u.phone, u.avatar_url AS photo,
  u.status AS account_status, u.last_login_at
FROM players p
JOIN users u ON u.id = p.user_id
WHERE p.deleted_at IS NULL AND u.deleted_at IS NULL;

CREATE VIEW v_coaches WITH (security_invoker = true) AS
SELECT
  c.id, c.user_id, c.coach_code, c.license, c.experience_years AS experience, c.specialization,
  c.gender, c.status, c.created_at, c.updated_at,
  trim(u.first_name || ' ' || u.last_name) AS name,
  u.first_name, u.last_name, u.email, u.phone, u.avatar_url AS photo,
  u.status AS account_status, u.last_login_at,
  coalesce((
    SELECT array_agg(ct.team_id ORDER BY (ct.role <> 'head_coach'), t.name)
    FROM coach_teams ct JOIN teams t ON t.id = ct.team_id AND t.deleted_at IS NULL
    WHERE ct.coach_id = c.id
  ), '{}'::uuid[]) AS team_ids,
  (
    SELECT ct.team_id
    FROM coach_teams ct JOIN teams t ON t.id = ct.team_id AND t.deleted_at IS NULL
    WHERE ct.coach_id = c.id AND ct.role = 'head_coach'
    ORDER BY t.name
    LIMIT 1
  ) AS team_id
FROM coaches c
JOIN users u ON u.id = c.user_id
WHERE c.deleted_at IS NULL AND u.deleted_at IS NULL;

CREATE VIEW v_teams WITH (security_invoker = true) AS
SELECT
  t.id, t.name, t.short_name, t.logo_url AS logo, t.description, t.city, t.country, t.category,
  t.age_group, t.gender, t.home_ground, t.founded, t.color, t.status, t.created_at, t.updated_at,
  (
    SELECT ct.coach_id FROM coach_teams ct JOIN coaches c ON c.id = ct.coach_id AND c.deleted_at IS NULL
    WHERE ct.team_id = t.id AND ct.role = 'head_coach' LIMIT 1
  ) AS coach_id,
  (
    SELECT ct.coach_id FROM coach_teams ct JOIN coaches c ON c.id = ct.coach_id AND c.deleted_at IS NULL
    WHERE ct.team_id = t.id AND ct.role = 'assistant_coach' ORDER BY ct.created_at LIMIT 1
  ) AS assistant_coach_id
FROM teams t
WHERE t.deleted_at IS NULL;

CREATE VIEW v_competitions WITH (security_invoker = true) AS
SELECT
  c.id, c.name, c.type, c.season, c.description, c.start_date, c.end_date, c.status, c.location,
  c.image_url, c.created_at, c.updated_at,
  coalesce((
    SELECT array_agg(ct.team_id ORDER BY t.name)
    FROM competition_teams ct JOIN teams t ON t.id = ct.team_id AND t.deleted_at IS NULL
    WHERE ct.competition_id = c.id
  ), '{}'::uuid[]) AS team_ids
FROM competitions c
WHERE c.deleted_at IS NULL;

CREATE VIEW v_matches WITH (security_invoker = true) AS
SELECT
  m.id, m.competition_id, m.home_team_id, m.away_team_id,
  m.match_date AS date, to_char(m.match_time, 'HH24:MI') AS time, m.venue AS location,
  m.referee, m.round, m.status, m.home_score, m.away_score, m.live_minute, m.notes,
  m.home_formation, m.away_formation, m.created_at, m.updated_at
FROM matches m
WHERE m.deleted_at IS NULL;

CREATE VIEW v_training_sessions WITH (security_invoker = true) AS
SELECT
  s.id, s.team_id, s.coach_id, s.title, s.type AS training_type, s.date,
  to_char(s.start_time, 'HH24:MI') AS start_time, to_char(s.end_time, 'HH24:MI') AS end_time,
  s.location, s.description, s.description_key, s.objectives, s.player_note, s.notes, s.status,
  s.cancellation_reason, s.cancellation_key, s.created_at, s.updated_at
FROM training_sessions s
WHERE s.deleted_at IS NULL;

REVOKE ALL ON v_players, v_coaches, v_teams, v_competitions, v_matches, v_training_sessions FROM anon, authenticated;
