# SportHub API — Reference (v1)

Base URL: `https://<your-api-domain>/api/v1` (local: `http://localhost:5000/api/v1`)

One API serves the three apps: **Admin** (`/admin`), **Coach** (`/coach`) and **Player** (`/player`).
Every rule below is enforced on the server — the apps' own checks are only for convenience.

---

## 1. Conventions

### Authentication
Send the JWT returned by `POST /auth/login`:

```
Authorization: Bearer <token>
```

The token contains only `sub` (user id), `role` and `jti` (session id). Each token is backed by a
server-side session: logout, refresh, password changes and account deactivation revoke it
immediately. Tokens last `JWT_EXPIRES_IN` (default 7 days) or `JWT_REMEMBER_EXPIRES_IN` (30 days)
when `remember: true`.

### Roles
| Role | Scope |
| --- | --- |
| `admin` | Everything. |
| `coach` | Teams in their `coach_teams` rows (head or assistant) — their players, matches, training, attendance, statistics, competitions. |
| `player` | Their own profile, team, matches, training, attendance, statistics, competitions, calendar, notifications and settings. Identity always comes from the token. |

Outside their scope a request returns **403**. A player can never pass another player's id.

### Response envelope
```json
{ "success": true, "message": "Players retrieved successfully", "data": [ ... ],
  "pagination": { "page": 1, "limit": 20, "total": 64, "totalPages": 4 },
  "meta": { } }
```
`pagination` is present on paginated lists; `meta` carries extras (e.g. statistics totals).

### Errors
```json
{ "success": false, "message": "This team already has a session at that time",
  "error": { "code": "TRAINING_OVERLAP", "i18nKey": "training.errors.overlap" },
  "errors": [ { "field": "start_time", "message": "...", "i18nKey": "training.errors.overlap" } ],
  "requestId": "3f0c…" }
```
* `error.code` — stable machine code. `error.i18nKey` — key the apps translate (EN/FR).
* `errors[]` — field-level details (validation and business rules on a field).
* In production no stack traces, SQL or Supabase messages are ever returned.

| Status | When |
| --- | --- |
| 200 / 201 | Success / created |
| 400 | `VALIDATION_FAILED`, `INVALID_JSON`, `WRONG_PASSWORD`, `RESET_TOKEN_INVALID`, upload type errors |
| 401 | `TOKEN_MISSING`, `TOKEN_INVALID`, `TOKEN_EXPIRED`, `SESSION_REVOKED`, `INVALID_CREDENTIALS`, `ACCOUNT_INACTIVE` |
| 403 | `FORBIDDEN` (outside scope / role), `NOT_ADMIN` · `NOT_COACH` · `NOT_PLAYER` (portal), `FIELD_NOT_EDITABLE` |
| 404 | `NOT_FOUND`, `<ENTITY>_NOT_FOUND`, `ROUTE_NOT_FOUND` (a malformed id is also 404) |
| 409 | `EMAIL_TAKEN`, `JERSEY_TAKEN`, `TEAM_NAME_TAKEN`, `DUPLICATE_ATTENDANCE`, `TEAM_HAS_MATCHES`, `COMPETITION_HAS_MATCHES`, … |
| 413 | `PAYLOAD_TOO_LARGE`, `FILE_TOO_LARGE` |
| 422 | Business rules: `SAME_TEAM`, `TEAM_BUSY`, `ELEVEN_REQUIRED`, `GOALKEEPER_REQUIRED`, `PLAYER_NOT_ON_PITCH`, `PLAYER_NOT_ON_BENCH`, `MATCH_NOT_STARTED`, `TRAINING_OVERLAP`, `SESSION_IN_FUTURE`, `SESSION_CANCELLED`, … |
| 429 | `RATE_LIMITED` |
| 500 / 502 / 503 | `INTERNAL_ERROR`, `STORAGE_UPLOAD_FAILED`, `STORAGE_NOT_CONFIGURED` |

### Pagination, search, filtering, sorting
| Parameter | Notes |
| --- | --- |
| `page`, `limit` | `limit` max **100** (`pageSize` is accepted as an alias; `pageSize=all` = 100). |
| `search` (or `q`) | Case- and accent-insensitive ("ismael" finds "Ismaël"). |
| `sortBy`, `sortOrder` | Only whitelisted columns per resource; `asc` / `desc`. (`sort` / `dir` accepted.) |
| `date_from`, `date_to` | `YYYY-MM-DD` (`from` / `to` accepted). |
| `team_id`, `competition_id`, `player_id`, `coach_id`, `status`, `position`, `event_type`, `attendance_status` | Validated per endpoint (`teamId`, `competitionId`… camelCase accepted). |

Unknown query parameters are ignored; invalid ones return 400 before any database access.

### Dates and times
Timestamps are UTC ISO-8601 (`2026-09-24T13:51:10.076Z`). Match / training days are calendar
dates `YYYY-MM-DD` and times `HH:MM` in the federation's time zone (`APP_TIMEZONE`,
default `Africa/Djibouti`), which also defines "today" for upcoming/completed.

### Rate limits
* All `/api/v1` routes: `RATE_LIMIT_MAX` requests / `RATE_LIMIT_WINDOW_MS` per IP.
* `/auth/login`, `/auth/forgot-password`, `/auth/reset-password`: `AUTH_RATE_LIMIT_MAX` per IP + email.
* Headers: `RateLimit`, `RateLimit-Policy`, `Retry-After`.

### Main objects (abridged)
```jsonc
// Team summary (embedded everywhere)
{ "id": "uuid", "name": "Djibouti FC", "short_name": "DFC", "color": 0, "logo": null }

// Match
{ "id": "uuid", "competition_id": "uuid|null", "home_team_id": "uuid", "away_team_id": "uuid",
  "date": "2026-09-24", "time": "16:30", "location": "Stade …", "referee": "…", "round": 5,
  "status": "scheduled|live|completed|postponed|cancelled", "home_score": 1, "away_score": 3, "live_minute": 63,
  "home_team": {…}, "away_team": {…}, "competition": { "id", "name", "season", "type" } | null,
  "lineups": { "home": { "formation": "4-3-3", "starting": ["uuid"×11], "substitutes": ["uuid"] }, "away": {…} } | null,
  "team_stats": { "home": { "possession": 58, "shots": 11, "shots_on_target": 5, "corners": 6, "fouls": 12, "offsides": 2,
                            "yellow_cards": 1, "red_cards": 0, "passes": 402, "completed_passes": 339 }, "away": {…} } | null }

// Match event
{ "id": "uuid", "match_id": "uuid", "team_id": "uuid", "event_type": "goal|assist|yellow_card|red_card|substitution|own_goal|penalty",
  "minute": 70, "additional_minute": null, "description": "",
  "player_id": "uuid", "related_player_id": "uuid|null",
  "player_in_id": "uuid", "player_out_id": "uuid",          // substitutions only
  "player": { "id", "name", "photo", "position", "jersey_number", "team_id" }, "related_player": {…} }
```
> **Substitutions.** The database stores `player_id` = player coming **on**, `related_player_id` =
> player going **off**. Responses give the explicit `player_in_id` / `player_out_id`; the legacy
> `player_id` / `related_player_id` pair in responses is the apps' orientation (going off / coming on).
> When recording one, send `player_in_id` + `player_out_id` (recommended) — the legacy pair is
> also accepted. For assists `related_player_id` is the scorer.

```jsonc
// Training session
{ "id": "uuid", "team_id": "uuid", "coach_id": "uuid", "title": "", "training_type": "technical|tactical|fitness|recovery|strength|match_preparation|team_session|other",
  "date": "2026-09-24", "start_time": "17:00", "end_time": "19:00", "location": "…", "description": "…",
  "description_key": "technical", "objectives": ["rondos"], "player_note": "bothKits",
  "notes": "coach-only — never sent to players", "status": "scheduled|completed|cancelled",
  "cancellation_reason": "", "team": {…}, "coach": { "id", "name", "photo", "license" } }

// Notification
{ "id": "uuid", "type": "match_reminder", "category": "match", "template": "match_live", "params": { "home": "…" },
  "title": "Match in progress", "message": "…", "reference_type": "match", "reference_id": "uuid",
  "link": "/coach/matches/uuid", "is_read": false, "read_at": null, "created_at": "…" }
```
`type` is the app-specific notification type (icons/filters), `category` the generic category
(`match, training, attendance, team, competition, system, announcement`). `link` is built for the
recipient's app.

---

## 2. Health

### `GET /health` (also `GET /api/v1/health`)
Public. Returns 200 while the process is up.
```json
{ "success": true, "message": "Sports Management API is healthy", "status": "ok", "service": "sports-management-api",
  "environment": "production", "version": "1.0.0", "uptime": 812, "database": "ok|unavailable", "timestamp": "…" }
```
The database probe is cached for 30 s, so the check stays cheap.

---

## 3. Authentication — `/auth`

| Method & path | Auth | Body | Response `data` |
| --- | --- | --- | --- |
| `POST /auth/login` | — (strict limit) | `{ email, password, remember?, portal?: "admin"\|"coach"\|"player" }` | `{ user, token, expiresAt }` |
| `POST /auth/logout` | Bearer | — | `{ ok: true }` (token revoked) |
| `GET /auth/me` | Bearer | — | `user` |
| `PUT` / `PATCH /auth/me` | Bearer | `{ name?, email?, phone?, avatar? }` | `user` |
| `POST /auth/refresh` | Bearer | — | `{ user, token, expiresAt }` (old token revoked) |
| `POST /auth/forgot-password` | — (strict limit) | `{ email }` | `{ ok: true }` — identical answer for unknown emails |
| `POST /auth/reset-password` | — (strict limit) | `{ token, password }` | `{ ok: true }` — all sessions revoked |
| `POST /auth/change-password` | Bearer | `{ currentPassword, newPassword }` | `{ ok: true }` — other sessions revoked |

`user`: `{ id, name, first_name, last_name, email, phone, role, status, avatar, language, theme, coach_id, player_id, team_ids, last_login_at, created_at }` — never the password hash.
Passwords: ≥ 8 characters with upper-case, lower-case and a digit.
Errors: 400 validation · 401 `INVALID_CREDENTIALS` · 403 portal mismatch / `ACCOUNT_INACTIVE` · 429.

Reset links are `<FRONTEND_URL>/<role>/reset-password?token=…` (valid 60 min, single use; only a
SHA-256 hash of the token is stored).

---

## 4. Own profile and settings — any role

| Method & path | Body | Notes |
| --- | --- | --- |
| `GET /profile` | — | Same as `/auth/me`. |
| `PATCH /profile` | `{ name?, email?, phone?, avatar? }` | Players cannot change their registered name (403). `avatar`: data-URL image (uploaded) or null. |
| `PATCH /profile/password` | `{ currentPassword, newPassword }` | 400 `WRONG_PASSWORD` / `SAME_PASSWORD`. |
| `GET /settings` | — | `{ language, theme, notifications: { match_reminders, training_reminders, team_announcements, attendance_updates, competition_updates, system_notifications } }` |
| `PATCH /settings` | `{ language?: "en"\|"fr", theme?: "light"\|"dark"\|"system", notifications?: {…booleans} }` | Preferences decide which automatic notifications are created. |

---

## 5. Dashboards (one request each)

| Method & path | Role | `data` |
| --- | --- | --- |
| `GET /dashboard/admin` (alias `GET /dashboard`) | admin | `counts`, `live`, `upcomingMatches`, `recentResults`, `upcomingTraining`, `playersByTeam`, `attendanceTrend`, `attendanceSummary`, `matchResults`, `topPlayers`, `performanceByTeam`, `season`, `system` |
| `GET /dashboard/coach` (alias `GET /coach/dashboard`) | coach | `coach`, `teams`, `season`, `counts`, `todaySchedule`, `nextMatch`, `recentResults`, `attendance`, `attendanceTrend`, `topPlayers`, `teamResults`, `training { completed, upcoming, cancelled, pending, next }` |
| `GET /dashboard/player` (alias `GET /player/dashboard`) | player | `player`, `season`, `stats`, `attendance`, `nextMatch`, `upcomingSessions`, `recent`, `schedule` (14 days), `series` |

---

## 6. Users — admin

| Method & path | Query / body | Notes |
| --- | --- | --- |
| `GET /users` | `page, limit, search, role, status, sortBy (name, email, role, status, created_at, last_login_at), sortOrder` | Each row has `profile: { type, id }` for coach/player accounts. |
| `GET /users/counts` | — | `{ total, admin, coach, player, active, inactive, suspended, pending }` |
| `GET /users/:id` | — | |
| `POST /users` | `{ name, email, phone?, role, status?, password? }` | Creates the matching empty coach/player profile. Without a password the user sets one via "forgot password". 409 `EMAIL_TAKEN`. |
| `PATCH` / `PUT /users/:id` | `{ name?, email?, phone?, role?, status? }` | 422 `ROLE_LOCKED` (profiled accounts), `CANNOT_DEMOTE_SELF`. Deactivation revokes sessions. |
| `PATCH /users/:id/status` | `{ status }` | `active \| inactive \| suspended \| pending` |
| `POST /users/:id/reset-password` | `{ mode: "link"\|"temporary", password? }` | |
| `DELETE /users/:id` | — | Soft delete. 422 `CANNOT_DELETE_SELF`, `LAST_ADMIN`. |

---

## 7. Players

| Method & path | Role | Query / body | Notes |
| --- | --- | --- | --- |
| `GET /players` | admin, coach | `page, limit, search, team_id (uuid \| none), position, status, sortBy (name, jersey_number, position, status, registration_date, date_of_birth, player_code, rating, goals, attendance_rate), sortOrder` | Coaches: their teams only, with `rating`, `goals`, `attendance_rate`. |
| `GET /players/options` | admin, coach | `team_id, status` | Light list for pickers. |
| `GET /players/:id` | admin, coach | — | Profile + `team`, `coach`, `statistics`, `attendance { …, recent }`, `recent_matches[]`; coaches also get `performance_trend`, `attendance.trend`. |
| `GET /players/:id/statistics` | admin, coach, player (self) | `season, competition_id, date_from, date_to, match_type` | `{ matches, starts, minutes, goals, assists, shots, shots_on_target, passes, completed_passes, pass_accuracy, fouls, yellow_cards, red_cards, average_rating }` |
| `GET /players/:id/attendance` | admin, coach | `status, date_from, date_to` | `{ summary, records[] }` |
| `POST /players` | admin | `{ name, email, phone?, photo?, date_of_birth?, gender?, nationality?, address?, position?, secondary_position?, preferred_foot?, height?, weight?, jersey_number?, team_id?, emergency_contact_name?, emergency_contact_phone?, emergency_contact_relation?, status?, registration_date?, license_number?, license_valid_until? }` | Generates `player_code` (P###) and the team membership row. 409 `EMAIL_TAKEN`, `JERSEY_TAKEN`. |
| `PATCH` / `PUT /players/:id` | admin | same fields, all optional | Changing `team_id` closes the old `team_players` spell and opens a new one; the shirt number is cleared if taken in the new team. |
| `DELETE /players/:id` | admin | — | Soft delete (match and attendance history kept). |

---

## 8. Coaches — admin

| Method & path | Query / body | Notes |
| --- | --- | --- |
| `GET /coaches` | `page, limit, search, status, team_id (uuid \| none), sortBy (name, experience, license, status, created_at, coach_code), sortOrder` | `team_id` = primary (head-coach) team; `team_ids` = all teams. |
| `GET /coaches/options` | — | |
| `GET /coaches/:id` | — | + `players_count`, `sessions_total`, `sessions_completed`, `upcoming_sessions`, `attendance`, `record`. |
| `POST /coaches` | `{ name, email, phone?, photo?, gender?, license?, experience?, specialization?, team_id?, status? }` | Generates `coach_code` (C###); `team_id` makes them head coach. |
| `PATCH` / `PUT /coaches/:id` | same, optional | Changing `team_id` moves the primary team only. |
| `DELETE /coaches/:id` | — | Soft delete; removes team assignments. |

---

## 9. Coach workspace — `/coach` (role: coach)

Everything is limited to the coach's teams; a `team_id` sent by the client is re-checked.

| Method & path | Notes |
| --- | --- |
| `GET /coach/profile` (alias `/coach/me`) | `{ id, coach_code, name, email, phone, photo, gender, license, experience, specialization, status, account_status, member_since, last_login_at, teams[] }` |
| `PATCH /coach/profile`, `PUT`/`PATCH /coach/me` | `{ name?, email?, phone?, photo? }` — licence, status and teams stay with the federation. |
| `GET /coach/dashboard` | See §5. |
| `GET /coach/teams` · `/coach/teams/options` · `/coach/teams/:id` | Team list (with `record`, `attendance_rate`, `next_match`, `next_session`) and detail (roster with statistics and attendance, `top_scorers`, `by_competition`, fixtures, sessions). |
| `GET /coach/players` · `/coach/players/options` · `/coach/players/:id` | As `/players`, scoped. |
| `GET /coach/matches` · `/coach/matches/counts` · `/coach/matches/:id` | Match detail adds `editable_sides`. |
| `PATCH /coach/matches/:id/status` · `PUT`/`PATCH /coach/matches/:id/statistics` (alias `team-stats`) · `PATCH /coach/matches/:id/lineup` · `PUT /coach/matches/:id/lineups/:side` · `POST`/`PATCH`/`DELETE /coach/matches/:id/events[/:eventId]` | Same bodies as §12. |
| `GET/POST /coach/training` (alias `/coach/training-sessions`), `GET /coach/training/options`, `GET/PUT/PATCH /coach/training/:id`, `POST …/:id/cancel`, `POST …/:id/restore`, `GET/PUT …/:id/attendance`, `POST …/:id/attendance/bulk` | Same bodies as §13. |
| `GET /coach/attendance` · `/coach/attendance/overview` · `POST /coach/attendance` · `PATCH /coach/attendance/:id` | See §14 (overview supports `granularity=day\|week\|month` and returns `pending`). |
| `GET /coach/statistics` · `/players` · `/teams` · `/trend` | See §15. |
| `GET /coach/competitions` · `/options` · `/seasons` · `/:id` | Read-only, competitions of their teams. |
| `GET /coach/calendar` · `GET /coach/search?q=` | |

---

## 10. Player space — `/player` (role: player)

No endpoint accepts a player id: the player is always the token's owner.

| Method & path | Notes |
| --- | --- |
| `GET /player/me` | `{ id, player_code, name, photo, position, jersey_number, status, team, coach }` |
| `GET /player/profile` (alias `/player/me/profile`) | Full own profile + `assistant_coach`, `license_valid`. |
| `PATCH /player/profile` (alias `/player/me/profile`) | Only `email, phone, address, photo, emergency_contact_name, emergency_contact_phone, emergency_contact_relation`. Any other field (team, jersey, status, statistics, role…) → **403 `FIELD_NOT_EDITABLE`**. |
| `GET /player/dashboard` | See §5. |
| `GET /player/team` | Own team: coaches, league position, season and all-time record, attendance, next match, recent results. |
| `GET /player/team/roster?search=&position=` | Teammates' public fields only (`id, name, photo, jersey_number, position, status, is_me, team`). |
| `GET /player/teammates/:id` | Public card + season goals/assists; 403 for players of other teams. |
| `GET /player/matches?tab=upcoming\|completed\|cancelled&search=&competition_id=&date_from=&date_to=` · `/player/matches/counts` · `/player/matches/:id` | Detail adds `lineups` with player objects (`is_me`), `my_side`, `my_selection`, `my_performance`. 403 for matches of other teams. |
| `GET /player/training?tab=&type=&date_from=&date_to=` (alias `/player/training-sessions`) · `/player/training/counts` · `/player/training/:id` | Each session has `my_attendance`; coach notes are never included. |
| `GET /player/attendance?status=&type=&date_from=&date_to=&page=&limit=` | `{ summary { present, absent, late, excused, total, rate, pending, sessions }, monthly[], trend[], history { data, total, page, pageSize, pages } }` |
| `GET /player/statistics?season=&competition_id=&match_type=&date_from=&date_to=` | `{ totals, attendance, perMatch[], monthly[] }` |
| `GET /player/competitions` · `/player/competitions/seasons` · `/player/competitions/:id` | Competitions of the player's team (`position`, `points`, `my_matches`); detail has `standings`, `fixtures`, `results`, `top_scorers` (`is_me`). |
| `GET /player/calendar?date_from=&date_to=` | Training, matches, team events and competition dates. |
| `GET /player/notifications?status=&category=matches\|training\|team\|system&page=&limit=` · `/unread-count` · `PATCH /:id` `{ is_read }` · `PATCH /:id/read` · `POST /mark-all-read` · `PATCH /read-all` · `DELETE /:id` | Own inbox only. |
| `GET` / `PATCH /player/notification-preferences` | `{ match_reminders, training_reminders, team_announcements, attendance_updates, competition_updates, system_notifications }` |
| `GET` / `PATCH /player/settings` | As `/settings`. |
| `GET /player/search?q=` | Groups: `matches, training, team, competitions, notifications`. |

---

## 11. Teams

| Method & path | Role | Query / body | Notes |
| --- | --- | --- | --- |
| `GET /teams` | all (scoped) | `page, limit, search, status, category, sortBy (name, short_name, founded, created_at, status, category), sortOrder` | Rows include `coach`, `players_count`, `active_players`, `record`, `attendance_rate`. |
| `GET /teams/options` | all (scoped) | | |
| `GET /teams/:id` | all (scoped) | | Roster with statistics, record, attendance, fixtures and sessions. |
| `GET /teams/:id/statistics` | all (scoped) | `season, competition_id, date_from, date_to` | `{ matches, wins, draws, losses, goals, goals_conceded, goal_difference, points, average_goals, form, attendance }` |
| `GET /teams/:teamId/players` · `GET /teams/:teamId/coaches` | all (scoped) | | Players get the public roster. |
| `POST /teams` | admin | `{ name, short_name, category?, age_group?, gender?, coach_id?, description?, home_ground?, city?, country?, founded?, status?, logo? }` | 409 `TEAM_NAME_TAKEN`. |
| `PATCH` / `PUT /teams/:id` | admin | same, optional | `coach_id` sets the head coach. |
| `DELETE /teams/:id` | admin | | 409 `TEAM_HAS_MATCHES` (deactivate instead). Otherwise soft delete. |
| `POST /teams/:teamId/players` | admin | `{ playerIds: [uuid] }` (or `player_ids`, `player_id`) | Moves players (membership history kept). |
| `DELETE /teams/:teamId/players/:playerId` | admin | | Closes the membership. |
| `POST /teams/:teamId/coaches` | admin | `{ coach_id, role: "head_coach"\|"assistant_coach" }` | One head coach per team; a coach can hold several teams. |
| `DELETE /teams/:teamId/coaches/:coachId` | admin | | |

---

## 12. Matches

| Method & path | Role | Query / body | Notes |
| --- | --- | --- | --- |
| `GET /matches` | all (scoped) | `page, limit, search, status, competition_id (uuid \| friendly), team_id, when (upcoming \| completed \| past), tab (players), date_from, date_to, sortBy (date, time, status, round, location, created_at), sortOrder` | |
| `GET /matches/counts` | all (scoped) | | Players: `{ upcoming, completed, cancelled }`; others by status. |
| `GET /matches/:id` | all (scoped) | | Match + `events`, `player_lines { playerId → line }`, `squads { home, away }`. |
| `POST /matches` | admin | `{ competition_id?, home_team_id, away_team_id, date, time, location?, referee?, round?, notes?, status? }` | 422 `SAME_TEAM`, `TEAM_BUSY` (a team already plays that day), `TEAM_NOT_IN_COMPETITION`. Notifies both teams. |
| `PATCH` / `PUT /matches/:id` | admin | same, optional | 422 `TEAMS_LOCKED` once events exist. Rescheduling notifies players. |
| `DELETE /matches/:id` | admin | | Soft delete; standings recalculated. |
| `PATCH /matches/:id/status` (alias `/score`) | admin, coach of a team | `{ status, home_score?, away_score?, live_minute? }` | Manual scores only while no goal events exist — otherwise events drive the score. `completed` notifies both teams and recalculates standings. |
| `PATCH /matches/:id/statistics` · `PUT …/statistics` · `PUT …/team-stats` | admin, coach of a team | `{ home?: stats, away?: stats }` or `{ team_id, ...stats }` — stats: `possession 0–100, shots, shots_on_target ≤ shots, corners, fouls, offsides, passes, completed_passes ≤ passes` | The other side's possession becomes 100 − x. Shots on target never drop below goals. 422 `MATCH_NOT_STARTED`. |
| `PATCH /matches/:id/lineup` · `PUT /matches/:id/lineups/:side` | admin, coach of that team | `{ team_id? \| side?, formation?, starting: [11 uuid], substitutes?: [≤ 9 uuid] }` | 422 `ELEVEN_REQUIRED`, `GOALKEEPER_REQUIRED`, `PLAYER_NOT_IN_TEAM`, `DUPLICATE_LINEUP_PLAYER`. Coaches can only set their own side. Notifies the team's players. |
| `POST /matches/:id/events` | admin, coach of a team | `{ event_type, team_id?, player_id, related_player_id?, player_in_id?, player_out_id?, assist_player_id?, minute 0–130, additional_minute?, description? }` | See rules below. Returns the event (201). |
| `PATCH /matches/:id/events/:eventId` | admin, coach | `{ minute?, additional_minute?, description? }` | Players / type are fixed — delete and re-add instead. |
| `DELETE /matches/:id/events/:eventId` | admin, coach | | Removing a goal also removes its assist; everything is recalculated. |

**Event rules (one transaction):** the match must be `live` or `completed`; every player must
belong to the event's team; when the side has a line-up:
* goal / penalty / own goal / assist — the player must be **on the pitch** at that minute (`PLAYER_NOT_ON_PITCH`);
* substitution — the player going off must be on the pitch and the player coming on an unused
  substitute (`PLAYER_NOT_ON_BENCH`; a squad member not yet named is added to the bench);
* cards — the player must be in the match squad.

Then: the event is stored → the score is recomputed from goal events (own goals count for the
opponent) → `player_match_statistics` are rebuilt (minutes, goals, assists, cards, rating, shots,
passes…) → `match_statistics` cards / shot consistency → competition standings → notifications.

---

## 13. Training — `/training` (alias `/training-sessions`)

| Method & path | Role | Query / body | Notes |
| --- | --- | --- | --- |
| `GET /training` | all (scoped) | `page, limit, search, team_id, type, status, when (upcoming \| completed \| cancelled), tab (players), date_from, date_to, sortOrder` | Admin/coach rows have `attendance_rate`, `attendance_recorded`; players get `my_attendance` and no notes. |
| `GET /training/options` | admin, coach | `team_id` | Past, non-cancelled sessions (last 60). |
| `GET /training/counts` | all (scoped) | | `{ upcoming, completed, cancelled }` |
| `GET /training/:id` | all (scoped) | | Admin/coach: + `register[]`, `summary`. |
| `POST /training` | admin, coach (own teams) | `{ team_id, training_type (or type), date, start_time, end_time, location?, title?, description?, objectives?[], notes? }` | 422 `TRAINING_OVERLAP`; 403 for other teams. Notifies the team's players. |
| `PATCH` / `PUT /training/:id` | admin, coach | same, optional | Changing the team clears the register; schedule changes notify players. |
| `POST /training/:id/cancel` | admin, coach | `{ reason? }` | Keeps history; notifies players. |
| `POST /training/:id/restore` | admin, coach | | |
| `DELETE /training/:id` | admin | | Soft delete. |
| `GET /training/:id/attendance` | admin, coach | | `{ register[], summary }` |
| `PUT /training/:id/attendance` | admin, coach | `{ records: [{ player_id, status: present\|absent\|late\|excused\|pending\|null, notes? }] }` | Replaces the register (lines without status are removed). 422 `SESSION_CANCELLED`, `SESSION_IN_FUTURE`, `PLAYER_NOT_IN_TEAM`. Stores `marked_by` / `marked_at`; players whose status changed are notified. |
| `POST /training/:id/attendance/bulk` | admin, coach | same body | Upserts the given lines only. |
| `GET /calendar` | all (scoped) | `date_from, date_to, type (training,match,competition,event), team_id` | Normalised events: `{ id, type, kind, title, date, start, end, start_at, end_at, referenceId, link, … }` |

---

## 14. Attendance — `/attendance` (admin, coach — players use `/player/attendance`)

| Method & path | Query / body | Notes |
| --- | --- | --- |
| `GET /attendance` | `page, limit, team_id, player_id, session_id, status, date_from, date_to` | Register lines with `session` and `player`. |
| `GET /attendance/overview` | same + `granularity` (coach) | `{ summary, byTeam[], trend[], players[] (lowest rate first), sessions[] }` (+ `pending[]` for coaches). |
| `POST /attendance` | `{ training_session_id, player_id, status, notes? }` | 409 `DUPLICATE_ATTENDANCE` (unique session + player). |
| `PATCH /attendance/:id` | `{ status?, notes? }` | |

Rate = (present + late) ÷ (present + late + absent + excused) × 100 (one decimal). `pending` lines
are not counted.

---

## 15. Statistics (admin, coach — scoped)

| Method & path | Query | `data` |
| --- | --- | --- |
| `GET /statistics/players` | `page, limit, team_id, player_id, competition_id, season, date_from, date_to, position, match_type, search, sortBy (goals, assists, minutes_played, matches_played, starts, yellow_cards, red_cards, rating, attendance_rate, shots, passes, name), sortOrder` | Rows `{ player_id, team_id, matches_played, starts, minutes_played, goals, assists, shots, …, rating, attendance_rate, player, team }`, `meta.totals`, `meta.all`. |
| `GET /statistics/teams` | `competition_id, season, date_from, date_to, team_id` | `{ team_id, played, won, drawn, lost, goals_for, goals_against, goal_difference, points, form[], team }` |
| `GET /statistics/trend` | same + `player_id` | Last 14 completed matches: `{ match_id, date, team, opponent, goals_for, goals_against, result, rating, player_goals }` |
| `GET /statistics` | as players | `{ players, totals, teams }` |

All figures come from `player_match_statistics` (rebuilt from line-ups and events) and completed
matches — never from client input.

---

## 16. Competitions

| Method & path | Role | Query / body | Notes |
| --- | --- | --- | --- |
| `GET /competitions` | all (scoped) | `page, limit, search, status, type, season, sortBy (start_date, end_date, name, season, status, created_at), sortOrder` | Players receive a plain array with `position` / `points`. |
| `GET /competitions/options` · `/seasons` | all (scoped) | | |
| `GET /competitions/:id` | all (scoped) | | `standings`, fixtures, results, `top_scorers`, `totals`. |
| `GET /competitions/:id/standings` | all (scoped) | | Played, W, D, L, GF, GA, GD, points, form, position — W 3 / D 1 / L 0, completed matches only; ties by GD then goals scored. |
| `GET /competitions/:id/teams` | all (scoped) | | Stored standings rows (`competition_teams`). |
| `POST /competitions` | admin | `{ name, type: league\|cup\|tournament, season, start_date, end_date ≥ start_date, location?, description?, status?, team_ids: [≥ 2 uuid] }` | Notifies admins and the teams. |
| `PATCH` / `PUT /competitions/:id` | admin | same, optional | 422 `TEAM_HAS_MATCHES` when removing a team that has fixtures. |
| `DELETE /competitions/:id` | admin | | 409 `COMPETITION_HAS_MATCHES`. |
| `POST /competitions/:id/teams` | admin | `{ team_id }` | 409 if already entered. |
| `DELETE /competitions/:id/teams/:teamId` | admin | | |

---

## 17. Notifications and announcements

| Method & path | Role | Notes |
| --- | --- | --- |
| `GET /notifications?status=read\|unread&type=&category=&search=&page=&limit=` | any | Own inbox, newest first. `type` accepts an app type or a category. |
| `GET /notifications/unread-count` | any | `{ count }` |
| `PATCH /notifications/:id` `{ is_read }` · `PATCH /notifications/:id/read` | any | |
| `POST /notifications/mark-all-read` · `PATCH /notifications/read-all` | any | |
| `DELETE /notifications/:id` | any | |
| `GET /announcements` | admin | |
| `POST /announcements` | admin | `{ title, message, audience: all\|coaches\|players\|team, team_id? }` — one notification per recipient. |

Automatic notifications (respecting each recipient's preferences): training created / changed /
cancelled / reinstated → team players (and coaches); match scheduled / rescheduled / live /
result / cancelled → both teams (+ admins); line-up published → team players; attendance changed
→ that player; goal recorded → the scorer; competition created / teams added → teams (+ admins);
team or coach assignment → the person concerned (+ admins); password reset requested → admins.

---

## 18. Reports (admin; coaches get their teams only)

`GET /reports/:type?date_from=&date_to=&team_id=&competition_id=&season=`

| `type` | Rows |
| --- | --- |
| `players` | Players with team and statistics. |
| `teams` (alias `team-performance`) | Teams with coach, players_count, record, attendance_rate. |
| `matches` | Matches with teams and competition. |
| `attendance` | Per-player attendance summary. |
| `competitions` | Competitions with teams_count, matches, goals. |
| `performance` (alias `player-performance`) | Players who played, sorted by rating. |

Response: `{ type, rows[], generated_at, filters }` — JSON for charts, tables and CSV export.

---

## 19. Search

`GET /search?q=` (≥ 2 characters) — result groups depend on the role:
admin `players, coaches, teams, matches, competitions` · coach `players, teams, matches, training, competitions` (own teams) ·
player `matches, training, team, competitions, notifications`. Aliases: `/coach/search`, `/player/search`.

---

## 20. Uploads and media

| Method & path | Role | Body | Notes |
| --- | --- | --- | --- |
| `POST /uploads/avatar` | any | `multipart/form-data` field `file` | Sets the caller's photo. Returns `{ url }`. |
| `POST /uploads/team-logo` | admin | `file`, optional `team_id` | Sets the team logo when `team_id` is given. |
| `GET /media/:id.:ext` | public | — | Images stored by the database fallback. |

Images only: JPEG, PNG or WebP, ≤ `UPLOAD_MAX_MB` (default 5 MB), checked by MIME type,
extension **and** file signature. Files are renamed (`<folder>/<yyyy-mm>/<uuid>.<ext>`). With
`SUPABASE_SERVICE_ROLE_KEY` set, files go to the Supabase Storage bucket `uploads`
(`players/`, `coaches/`, `teams/`, `competitions/`, `users/`); without it they are kept in the
`media` table and served by `GET /media/:id`.

JSON forms may also send an image as a `data:image/…;base64,…` value in `photo` / `avatar` /
`logo`; it is validated and stored the same way. Only URLs produced by this API are accepted
back.
