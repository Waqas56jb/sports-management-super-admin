# SportHub — Super Admin Panel

The Super Admin frontend for the federation's sports management system. It covers players, coaches, teams, competitions, matches (live match centre, events, line-ups), training and attendance, statistics, reports, notifications and settings.

It's built with React 19, Vite, React Router, Tailwind CSS v4, Recharts and Lucide icons. The UI is in English (default) and French, and supports light and dark mode.

> This package contains **only** the Super Admin frontend. It currently runs on a built-in mock data layer. The Coach and Player portals and the Node.js `server/` API are separate deliverables.

---

## Quick start

```bash
cd admin
npm install
npm run dev          # http://localhost:5173/admin/login
```

**Demo login**

| Email               | Password    |
| ------------------- | ----------- |
| `admin@example.com` | `Admin@123` |

Other build commands:

```bash
npm run build        # production build → dist/
npm run preview      # serve the production build locally
```

> Deploying `dist/` as a single-page app: configure the host to serve `index.html` for all `/admin/*` paths (history fallback).

---

## Routes

| Route | Page |
| --- | --- |
| `/admin/login`, `/admin/forgot-password` | Authentication |
| `/admin/dashboard` | Analytics dashboard (KPIs, live match, charts, lists) |
| `/admin/users` | Accounts, roles, status, password reset |
| `/admin/players`, `/admin/players/:id` | Player registry and profile |
| `/admin/coaches`, `/admin/coaches/:id` | Coaches and team assignment |
| `/admin/teams`, `/admin/teams/:id` | Teams, roster management, team statistics |
| `/admin/competitions`, `/admin/competitions/:id` | Leagues, cups, tournaments, standings |
| `/admin/matches`, `/admin/matches/:id` | Fixtures and the match centre (score, events, line-ups, player stats) |
| `/admin/training`, `/admin/training/:id` | Sessions (list and calendar) and the attendance register |
| `/admin/attendance` | Attendance analytics (by player, session and record) |
| `/admin/statistics` | Player statistics with filters |
| `/admin/reports` | Six reports with CSV and PDF export |
| `/admin/notifications` | Inbox and announcements |
| `/admin/settings` | Profile, security, language, appearance |

Every `/admin/*` route except login and forgot-password is protected. Only `super_admin` accounts can sign in. Unknown paths show a custom 404 page.

---

## Project structure

```text
admin/
├── public/                 favicon
├── src/
│   ├── components/
│   │   ├── ui/             design-system primitives (Button, Field, Modal, DataTable, FilterBar, Tabs, Badge, Skeleton…)
│   │   ├── charts/         Recharts wrappers with legend, tooltip and table view
│   │   ├── calendar/       month / week / day calendar
│   │   ├── layout/         Sidebar, Topbar, mobile tab bar, global search, notification bell
│   │   └── common/         domain components (TeamLogo, MatchRow, StandingsTable, ProfileHero…)
│   ├── context/            Auth, Theme, Toast, Confirm, Notification providers
│   ├── data/               demo seed and match simulator (development only)
│   ├── hooks/              useQuery, useForm, useListParams, useAction, useOptions…
│   ├── i18n/               en.js / fr.js built from one module per feature (en/*.js, fr/*.js)
│   ├── layouts/            AdminLayout, AuthLayout
│   ├── pages/              one folder per feature; pages keep their dialogs in use<Feature>Actions hooks
│   ├── routes/             AppRoutes (lazy-loaded), guards, navigation config, error boundary
│   ├── services/           API service layer (see below) + mock/ backend
│   └── utils/              formatting, validation, constants, CSV/PDF export
└── vite.config.js
```

---

## Connecting the real backend

All data access goes through `src/services/*Service.js`. Every method has two branches:

```js
async list(params) {
  if (!USE_MOCK) return api.get('/players', params);   // real REST call
  // …mock implementation against the in-browser database
}
```

To switch to the Node.js API:

1. Copy `.env.example` to `.env` and set:
   ```env
   VITE_API_BASE_URL=https://api.your-domain.dj
   VITE_USE_MOCK_API=false
   ```
2. Implement the endpoints the services call (`GET /players`, `POST /matches/:id/events`, `PUT /training-sessions/:id/attendance`, …). The mock layer in `src/services/mock/` shows the exact request and response shapes, including the list envelope `{ data, total, page, pageSize, pages }`.
3. Errors should return `{ code, fields }`. `code` is a translation key (e.g. `errors.emailTaken`), and `fields` maps form fields to translation keys. The UI shows both automatically.
4. Auth: `POST /auth/login` returns `{ user, token, expiresAt }`. The token is sent as `Authorization: Bearer …`. A `401` clears the session and returns the user to the login page.

The UI does not need to change.

### Business rules implemented in the mock layer (to mirror server-side)

- **Statistics are derived, not typed in.** Matches played, minutes, goals, assists, cards and rating are calculated from line-ups and match events (`services/mock/statsEngine.js`). Recording a goal updates the scorer's statistics and the score.
- **The score follows goal events.** Once goals are recorded as events, the score can only change through events.
- **Attendance rate** = (present + late) ÷ recorded check-ins.
- **One head coach per team.** Assigning a coach keeps `teams.coach_id` and `coaches.team_id` in sync.
- Teams and competitions that have fixtures can't be deleted. Deactivate them instead.
- Jersey numbers are unique within a team, and emails are unique across accounts.

---

## Internationalisation

- `src/i18n/en/*.js` and `src/i18n/fr/*.js` hold one namespace per feature. Components never hard-code UI text; they call `t('players.form.name')`.
- Plurals use `{ one, other }` (and optional `zero`) objects with `Intl.PluralRules`.
- Dates and numbers are formatted with `Intl` in the selected locale (`en-GB` / `fr-FR`).
- System notifications are stored as template and parameters, so they render in the viewer's language. CSV and PDF exports follow the selected language.
- The selected language is saved in `localStorage` (`shf.lang`). To add a language, add a folder under `i18n/`, register it in `I18nProvider.jsx` and add it to `LANGUAGES`.

## Theming

Design tokens are CSS variables in `src/index.css` (`--surface`, `--ink`, `--line`, chart colours, …). Dark mode has its own chosen values; it isn't an inverted light theme. The theme is saved in `localStorage` (`shf.theme`) and applied before first paint to avoid a flash. Chart colours use a colour-blind-checked categorical palette, and each team always keeps the same colour.

## Accessibility and responsiveness

- Keyboard support throughout: focus-trapped dialogs, Escape to close, arrow keys in menus and tabs, skip link, `Ctrl/⌘ + K` search.
- Every chart has a "show as table" toggle.
- Status is never shown by colour alone.
- On phones: drawer navigation, a one-handed bottom tab bar, tables that turn into cards, filters in a bottom sheet, dialogs as bottom sheets, and touch targets of at least 44 px.
- Checked at 320, 375, 390, 414, 768, 1024, 1280, 1440 and 1920 px with no horizontal overflow.

## Demo data

`src/data/seed.js` generates a consistent dataset relative to today:

- 4 teams: Djibouti FC, City Sports Club, Young Stars FC, Horizon United
- 64 players and 5 coaches
- 4 competitions (active league, upcoming cup, completed tournament, previous season)
- 44 matches (completed, one live, scheduled, one cancelled) with full event timelines
- 108 training sessions with attendance records

Changes are stored in your browser. **Settings → Demo data → Reset** restores the original dataset. Untouched demo data regenerates each day so fixtures stay current.
