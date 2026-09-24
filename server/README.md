# SportHub — Sports Management API (`server/`)

**Live:** API `https://terrific-smile-production-85ea.up.railway.app` (health: `/health`, API: `/api/v1`) ·
[Admin](https://sports-management-super-admin-production.up.railway.app/admin/dashboard) ·
[Coach](https://agile-manifestation-production-900d.up.railway.app/) ·
[Player](https://stellar-renewal-production-8a43.up.railway.app/)

This is the single backend for the federation's three React apps:

* **Admin panel** (`admin/`): users, players, coaches, teams, competitions, matches, training, attendance, reports and announcements.
* **Coach workspace** (`coach/`): assigned teams, training, attendance registers, line-ups, live match events and statistics.
* **Player space** (`player/`): the player's own profile, team, matches, training, attendance, statistics, competitions, calendar, notifications and settings.

Stack: **Node.js 20+ · Express 5 · Supabase PostgreSQL · Supabase Storage · JWT · Zod · bcrypt · Helmet · CORS · express-rate-limit · Pino**. It is deployed on **Railway**.

The full endpoint reference is in [`docs/API.md`](docs/API.md).

---

## Architecture

```text
 Admin React   Coach React   Player React        (independent deployments)
      │             │              │
      └──────── HTTPS / JSON ──────┘   Authorization: Bearer <JWT>
                    │
          ┌─────────▼──────────┐
          │  Node.js / Express │  Railway
          │  /api/v1  /health  │
          └───┬────────────┬───┘
              │            │
   ┌──────────▼───┐  ┌─────▼───────────┐
   │  Supabase    │  │ Supabase Storage │
   │  PostgreSQL  │  │ bucket "uploads" │
   └──────────────┘  └──────────────────┘
```

```text
server/
├── src/
│   ├── config/        env.js (validated config) · database.js (the single pg pool, transactions)
│   │                  supabase.js (the single Storage client) · constants.js (enums, rules)
│   ├── routes/        URL → middleware (auth, role/permission, validation) → controller
│   ├── controllers/   HTTP in/out only
│   ├── services/      business logic and SQL (one per domain) + statistics engine
│   ├── validators/    Zod schemas for every body / query
│   ├── middleware/    auth · roles · validate · errorHandler · notFound · rateLimiter · requestLogger
│   ├── utils/         response envelope, pagination, safe SQL builder, permissions, statistics, logger…
│   ├── db/            migrations/ (001–016) · seeds/ · schema.sql (generated) · migrate.js
│   ├── app.js         Express app (imported by tests)
│   └── server.js      process entry point (listens on process.env.PORT)
├── tests/             node:test + supertest against the real database
├── docs/API.md
├── railway.json · .env.example · package.json
```

Key design points:

* **Server-side authorisation.** Every request resolves the actor from the JWT session: role, the coach's teams, the player's team. Services then limit every query to that scope. A team, player or match id sent by the client is always re-checked, so coaches get **403** outside their teams and players outside their own data.
* **Transactions.** Multi-step writes run inside one PostgreSQL transaction, for example: goal event → score → player statistics → team statistics → standings → notifications.
* **Statistics are derived, never typed in.** `player_match_statistics` is rebuilt from line-ups and events whenever they change. Standings are recalculated from completed matches (W 3 / D 1 / L 0).
* **Database constraints back the API rules.** Examples:
  * unique email, player code, coach code, shirt number per team and attendance line;
  * one head coach per team, and one active team per player;
  * a team cannot play itself;
  * line-ups, events and stats must belong to one of the two teams;
  * match teams must be entered in the competition.
* **Soft deletion.** Users, players, coaches, teams, matches, training and competitions use `deleted_at`, so historical results, attendance and statistics are never lost.
* **Auditing.** Records carry `created_by` and `updated_by`. The `audit_logs` table records who changed attendance, events, line-ups, training, player records and team assignments.
* **Row Level Security.** RLS is enabled on every table, with no policies for `anon` or `authenticated`. The public Supabase key therefore reads nothing through Supabase's REST API; only this server (the database owner) has access.

---

## Requirements

* Node.js **20.11+** (tested on 24) and npm.
* A Supabase project (PostgreSQL 15+; tested on 17).

## Installation

```bash
cd server
npm install
cp .env.example .env      # then fill in the values (see below)
npm run migrate           # create / update all tables
npm run seed              # demo data (optional, development)
npm run dev               # http://localhost:5000  —  health: http://localhost:5000/health
```

| Command | What it does |
| --- | --- |
| `npm run dev` | Starts with auto-reload (nodemon). |
| `npm start` | Production start. |
| `npm run migrate` | Applies pending migrations in order, each in a transaction (tracked in `schema_migrations`, with checksums). |
| `npm run migrate:status` | Lists applied and pending migrations. |
| `npm run seed` | Inserts the demo dataset. It is idempotent: running it again creates no duplicates. |
| `npm run seed:reset` | Wipes all application data and re-seeds, with dates relative to today. Refused when `NODE_ENV=production` unless `--force` is added. |
| `npm run db:setup` | `migrate` + `seed`. |
| `npm run schema:build` | Regenerates `src/db/schema.sql` from the migrations. |
| `npm test` | Runs the test suite against the database in `DATABASE_URL`. Run `npm run seed` first. |

---

## Environment

| Variable | Required | Description |
| --- | --- | --- |
| `NODE_ENV` | yes | `development`, `test` or `production`. |
| `PORT` | Railway sets it | Listening port (default 5000). |
| `APP_TIMEZONE` | – | Federation time zone that defines "today" (default `Africa/Djibouti`). |
| `DATABASE_URL` | **yes** | Supabase Postgres connection string: the **Transaction pooler** (port 6543). URL-encode special characters in the password (`!` → `%21`). |
| `DATABASE_POOL_MAX` | – | Pool size (default 10). |
| `DATABASE_CA_CERT` | – | Supabase CA certificate (PEM, `\n` for newlines). When set, TLS is fully verified. |
| `SUPABASE_URL` | yes | `https://<project-ref>.supabase.co` |
| `SUPABASE_ANON_KEY` | – | Publishable key. Only for reference; the server does not need it. |
| `SUPABASE_SERVICE_ROLE_KEY` | for Storage | Server-only **secret** key (Dashboard → Project Settings → API Keys → *secret* / `service_role`). It enables Supabase Storage uploads. Without it, images are kept in the database (`media` table) and served by the API. |
| `JWT_SECRET` | **yes** | At least 32 random characters. |
| `JWT_EXPIRES_IN` / `JWT_REMEMBER_EXPIRES_IN` | – | Default `7d` / `30d`. |
| `BCRYPT_ROUNDS` | – | Default 11. |
| `CORS_ORIGINS` | **yes in production** | Comma-separated frontend origins. `*` is never used in production. |
| `ADMIN_FRONTEND_URL`, `COACH_FRONTEND_URL`, `PLAYER_FRONTEND_URL` | – | Added to CORS automatically and used in password-reset links. |
| `PUBLIC_API_URL` | – | Public URL of this API, for database-stored image links. On Railway, `RAILWAY_PUBLIC_DOMAIN` is used when this is unset. |
| `STORAGE_BUCKET` / `UPLOAD_MAX_MB` | – | Default `uploads` / `5`. |
| `RATE_LIMIT_WINDOW_MS`, `RATE_LIMIT_MAX`, `AUTH_RATE_LIMIT_MAX` | – | General and login / password-reset limits. |
| `TRUST_PROXY` | – | Proxy hops to trust (default 1, correct behind Railway). |
| `SEED_ADMIN_PASSWORD`, `SEED_COACH_PASSWORD`, `SEED_PLAYER_PASSWORD` | – | Passwords given to seeded demo accounts. |

**Never commit `.env`.** `SUPABASE_SERVICE_ROLE_KEY` and `JWT_SECRET` stay on the server; the React apps only know the API URL.

---

## Supabase setup

1. Create a project in the region closest to your users. Deploy Railway in the **same region** to keep database round-trips short.
2. Go to **Connect → Connection string → Transaction pooler** and copy it into `DATABASE_URL`, with the password URL-encoded. Use the pooler rather than the direct `db.<ref>.supabase.co` host, which is IPv6-only.
3. Go to **Project Settings → API Keys**: copy the **secret / service_role** key into `SUPABASE_SERVICE_ROLE_KEY`, and set `SUPABASE_URL`.
4. Run `npm run migrate`. This:
   * creates every table, constraint, index, trigger and view;
   * enables RLS everywhere;
   * creates the public-read Storage bucket **`uploads`** (images only, 5 MB).
5. Optionally run `npm run seed` for the demo dataset.

### Demo accounts (development seed only — change or remove in production)

| Role | Email | Default password |
| --- | --- | --- |
| Admin | `admin@gmail.com` | `SEED_ADMIN_PASSWORD` |
| Coach (Djibouti FC + Young Stars FC) | `coach@gmail.com` | `SEED_COACH_PASSWORD` |
| Player (Ahmed Hassan, #9) | `player@gmail.com` | `SEED_PLAYER_PASSWORD` |

The seed contains:

* 2 admins, 5 coaches and 64 players in 4 teams (Djibouti FC, City Sports Club, Young Stars FC, Horizon United);
* 4 competitions (current league, upcoming cup, completed tournament, previous season);
* 44 matches (completed, one live, scheduled, cancelled) with line-ups, events and statistics;
* 108 training sessions with 1,100+ attendance lines;
* team events and notifications for every role.

---

## Authentication and roles

* `POST /api/v1/auth/login` → `{ user, token, expiresAt }`. The apps send `portal` (`admin`, `coach` or `player`) so an account cannot sign in to the wrong panel.
* Send the token as `Authorization: Bearer <token>`. Sessions are stored server-side, so `logout`, `refresh`, password changes and deactivation revoke tokens immediately.
* Roles: `admin`, `coach`, `player`. The permission matrix lives in `src/utils/permissions.js`; data scoping lives in each service. See [`docs/API.md`](docs/API.md) §1 for the details.

## Connecting the frontends

Each app reads two variables, in `admin/.env.local`, `coach/.env.local` and `player/.env.local`, or in the host's build settings:

```env
VITE_API_BASE_URL=https://<your-api-domain>/api/v1
VITE_USE_MOCK_API=false
```

With `VITE_USE_MOCK_API=true`, or with the variable unset, the apps use their built-in demo data instead.

---

## Deployment on Railway

```text
GitHub repository ──► Railway service (root directory: server/) ──► npm run migrate (pre-deploy) ──► npm start
                                     │                                      │
                                     └──── Supabase PostgreSQL + Storage ◄──┘
Admin / Coach / Player frontends (Vercel, Netlify, Railway static…) ──► https://<api>.up.railway.app/api/v1
```

1. Push the repository to GitHub.
2. In Railway, click **New Project → Deploy from GitHub repo**, then set **Root Directory** to `server`.
3. Under **Variables**, add:
   * `NODE_ENV=production`
   * `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
   * `JWT_SECRET` (long random string), `JWT_EXPIRES_IN=7d`
   * `CORS_ORIGINS=https://admin.example.dj,https://coach.example.dj,https://player.example.dj`, or the three `*_FRONTEND_URL` variables
   * `STORAGE_BUCKET=uploads`

   Do **not** set `PORT`; Railway provides it.
4. Deploy. `railway.json` configures the build:
   * builder: Railpack;
   * pre-deploy: `npm run migrate`, so the schema is always current before the new version starts;
   * start: `npm start`;
   * health check: `GET /health`;
   * restart on failure.
5. Under **Settings → Networking**, generate a domain, then point each frontend's `VITE_API_BASE_URL` to `https://<domain>/api/v1` and redeploy the frontends.
6. Optional: run the demo seed once from your machine against the production database with `npm run seed`. Change the demo passwords, or remove the demo accounts, afterwards.

No code change is needed between local and production; everything comes from environment variables.

### Health check

`GET /health` is public, cheap, and returns 200 while the app is running:

```json
{ "success": true, "message": "Sports Management API is healthy", "status": "ok", "service": "sports-management-api",
  "environment": "production", "database": "ok", "timestamp": "2026-09-24T13:51:10.076Z" }
```

The `database` probe is cached for 30 s. The response never contains secrets or infrastructure details.

---

## Security summary

| Area | What is in place |
| --- | --- |
| Passwords | bcrypt with a configurable cost. Hashes are never returned. Login time is the same for unknown emails. |
| Tokens | Minimal claims (`sub`, `role`, `jti`) with server-side sessions: revocation on logout, refresh rotation, password change and deactivation. |
| Authorisation | Role and permission middleware on every route, plus per-record scoping in the services. Players cannot edit club-managed fields (403). |
| Input | Zod validation on every body and query. Unknown fields are stripped. Prototype-pollution keys are removed. SQL is always parameterised. Sort columns come from allow-lists. |
| HTTP | Helmet headers, CORS allow-list, 8 MB JSON limit, request ids. |
| Abuse | Global rate limit, plus a strict limit on login and password-reset endpoints keyed by IP and email. |
| Errors | One central handler. In production there are no stacks or SQL/Supabase messages; details are logged server-side with the request id. |
| Logging | Structured JSON (Pino): method, route, status, duration, user id and error code. Authorization headers, passwords, tokens and keys are redacted. |
| Database | RLS enabled on every table (the public key sees nothing), constraints and triggers mirror the business rules, and all multi-step writes run in transactions. |
| Uploads | Images only, checked by MIME type, extension and file signature, with a size limit and generated file names. |

---

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| `Invalid environment configuration` at start | A required variable is missing; the message lists which one. `JWT_SECRET` needs 32+ characters. |
| `ENOTFOUND db.<ref>.supabase.co` or IPv6 errors | Use the **pooler** connection string (`aws-0-<region>.pooler.supabase.com:6543`), not the direct host. |
| `password authentication failed` | The database password in `DATABASE_URL` must be URL-encoded (`!` → `%21`, `@` → `%40`). |
| Browser shows a CORS error | Add the exact frontend origin (scheme + host + port, no trailing slash) to `CORS_ORIGINS`, then restart. |
| Every request returns 401 after deploying | `JWT_SECRET` changed; users must sign in again. Check the browser sends `Authorization: Bearer …`. |
| Photo upload returns `STORAGE_UPLOAD_FAILED` | Check `SUPABASE_SERVICE_ROLE_KEY` and that migration 013 created the `uploads` bucket. |
| Slow responses locally | The database is in another region, and every query pays the round-trip time. Deploy the API in the same region as Supabase. |
| `Migration … changed after it was applied` | Never edit an applied migration; add a new numbered file instead. |
| Tests fail on login | Run `npm run seed` (or `npm run seed:reset`) and make sure the demo passwords were not changed. |
| `429 Too Many Requests` | Wait for the window to pass, or raise `AUTH_RATE_LIMIT_MAX` / `RATE_LIMIT_MAX`. |
