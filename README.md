# SportHub — Sports Management System

This is the federation sports management platform: three React apps and one Node.js API.

| Folder | Live (Railway) | Local |
| --- | --- | --- |
| [`server/`](server/README.md) — Express API, Supabase | https://terrific-smile-production-85ea.up.railway.app | http://localhost:5000 |
| [`admin/`](admin/) — Super Admin panel | https://sports-management-super-admin-production.up.railway.app/admin | http://localhost:5174/admin |
| [`coach/`](coach/README.md) — Coach workspace | https://agile-manifestation-production-900d.up.railway.app/coach | http://localhost:5175/coach |
| [`player/`](player/README.md) — Player space | https://stellar-renewal-production-8a43.up.railway.app/player | http://localhost:5176/player |

Each app is built with React, Vite and Tailwind, in English and French, with light and dark mode.

## Run everything locally

```bash
# 1. API (needs server/.env — see server/README.md)
cd server && npm install && npm run migrate && npm run seed && npm run dev

# 2. Each app, in its own terminal
cd admin  && npm install && npm run dev
cd coach  && npm install && npm run dev
cd player && npm install && npm run dev
```

The apps call the production API by default (`.env.production` / fallback in `src/services/apiClient.js`).
To use a local API, set in the app's `.env.local`:

```env
VITE_API_BASE_URL=http://localhost:5000/api/v1
```

`VITE_USE_MOCK_API=true` runs an app on its built-in demo data without any API.

Demo logins (seeded):

| App | Email | Password |
| --- | --- | --- |
| Admin | `admin@gmail.com` | set by `SEED_ADMIN_PASSWORD` |
| Coach | `coach@gmail.com` | set by `SEED_COACH_PASSWORD` |
| Player | `player@gmail.com` | set by `SEED_PLAYER_PASSWORD` |

API reference: [`server/docs/API.md`](server/docs/API.md) · Deployment (Railway + Supabase): [`server/README.md`](server/README.md#deployment-on-railway).
