# SportHub — Coach Panel

This is the coach-facing frontend of the federation's sports management system. A signed-in coach works only with the teams the federation has assigned to them: squads, training plans, attendance registers, line-ups, live match events, statistics, competitions and calendar.

It's built with React 19, Vite, React Router (data router), Tailwind CSS v4, Recharts and Lucide icons. The UI is in English (default) and French, and supports light and dark mode.

> This package contains **only** the Coach frontend. It currently runs on a built-in mock data layer. The Super Admin panel (`admin/`), the Player portal and the Node.js `server/` API are separate deliverables.

---

## Quick start

```bash
cd coach
npm install
npm run dev          # http://localhost:5174/coach/login (next free port if 5174 is busy)
```

**Demo login**

| Email               | Password    | Teams                        |
| ------------------- | ----------- | ---------------------------- |
| `coach@example.com` | `Coach@123` | Djibouti FC, Young Stars FC  |

The other demo coaches (e.g. `omar.djama@sporthub.dj`) use the same password and see only their own team.

```bash
npm run build        # production build → dist/
npm run preview
```

Serve `dist/` as a single-page app: every `/coach/*` path must fall back to `index.html`.

---

## What a coach can do

| Area | Routes | Capabilities |
| --- | --- | --- |
| Dashboard | `/coach/dashboard` | KPIs, today's schedule, next match with countdown, recent results, attendance, top players, training overview, charts |
| My Teams | `/coach/teams`, `/coach/teams/:id` | Assigned teams only. Tabs: Overview, Roster, Matches, Training, Statistics |
| Players | `/coach/players`, `/coach/players/:id` | Search, filter, sort and paginate the squad. Profiles with performance and attendance trends (view only) |
| Training | `/coach/training`, `/coach/training/:id` | Create, edit, cancel and reinstate sessions. List and calendar views. Coach notes. Attendance register |
| Attendance | `/coach/attendance` | Registers still to complete, daily/weekly/monthly trends, per-player and per-session summaries, editable history |
| Matches | `/coach/matches`, `/coach/matches/:id` | Upcoming/Live/Completed/Cancelled. Match centre: Overview, Line-up (pitch editor), Events, Statistics |
| Competitions | `/coach/competitions`, `/coach/competitions/:id` | Competitions involving the coach's teams, with standings, fixtures and top scorers (read-only) |
| Statistics | `/coach/statistics` | Player and team statistics filtered by team, player, competition, season and date range |
| Calendar | `/coach/calendar` | Month/week/day views of training, matches and competition dates |
| Notifications | `/coach/notifications` | Read/unread, mark all, delete, filter by type. The badge updates live |
| Profile, Settings | `/coach/profile`, `/coach/settings` | Edit name, phone and photo. Account, password, session info, language, theme |

Coaches cannot create or delete teams, players or competitions. Those actions are for the federation (Super Admin panel).

### Access control

Every coach service calls a scope helper (`src/services/mock/scope.js`) that resolves the signed-in coach and their `team_ids`:

- Lists and search only return the coach's teams, players, matches, training and competitions.
- Opening another team's record returns **403**, shown as a "Not one of your teams" state. Opponent teams are therefore not links.
- Line-ups can only be saved for the coach's own side of a match. Events can be recorded for both sides of the coach's matches, so the score stays complete.
- A **401** (expired or invalid session) signs the coach out and shows a "session expired" message on the login page.

The real API should enforce the same rules on the server from the auth token.

---

## Business rules (mock layer; mirror them in `server/`)

- **Statistics come from match events.** Goals, assists, cards, minutes and ratings are computed from line-ups and events (`services/mock/statsEngine.js`). Recording a goal updates the timeline, the score, the scorer's goals and the assister's assists.
- **The score follows goal events.** Shots on target are kept at least equal to goals.
- **Attendance %** = present sessions ÷ recorded sessions × 100. A late arrival counts as present.
- **Cancelled training** stays in history, is struck through in lists and the calendar, can't take a register, and can be reinstated.
- A team can't have two overlapping sessions. Attendance can't be recorded before the day of the session.
- Starting XI: exactly 11 players including a goalkeeper, and at most 9 substitutes.

---

## Project structure

```text
coach/src/
├── components/
│   ├── ui/            design-system primitives (Button, Field, Modal, DataTable, FilterBar, Tabs, Skeleton…)
│   ├── layout/        Sidebar, Topbar, mobile tab bar, global search, notification bell
│   ├── dashboard/     NextMatchCard, TodaySchedule, RecentResults
│   ├── matches/       LineupEditor (pitch), TeamStats (comparison + edit)
│   ├── charts/        Recharts wrappers with legend, tooltip and table view
│   ├── calendar/      month / week / day calendar
│   └── common/        TeamLogo, MatchRow, StandingsTable, ProfileHero, DetailGuard…
├── context/           Auth, Theme, Toast, Confirm, Notification providers
├── hooks/             useAuth, useTheme, useLanguage, useTeams, usePlayers, useTraining, useAttendance,
│                      useNotifications, useQuery, useForm, useListParams, useUnsavedChanges…
├── i18n/              en.js / fr.js (one module per feature in en/*.js, fr/*.js)
├── pages/             one folder per feature
├── routes/            router.jsx (lazy routes), guards, navigation config
├── services/          API service layer + mock/ (in-browser database, scope, stats engine)
├── data/              demo seed and match simulator (development only)
└── utils/
```

## Connecting the real backend

All data access goes through `src/services/*Service.js` (`authService`, `coachService`, `profileService`, `teamService`, `playerService`, `trainingService`, `attendanceService`, `matchService`, `competitionService`, `statisticsService`, `notificationService`, `searchService`). Each method calls the REST API when `VITE_USE_MOCK_API=false`:

```env
VITE_API_BASE_URL=https://api.your-domain.dj
VITE_USE_MOCK_API=false
```

Endpoints live under `/coach/*` (e.g. `GET /coach/dashboard`, `PUT /coach/training-sessions/:id/attendance`, `PUT /coach/matches/:id/lineups/:side`). The mock implementations document the exact request and response shapes. Errors should be `{ code, fields }`, where `code` is a translation key. Auth: `POST /auth/login` with `portal: 'coach'` returns `{ user, token, expiresAt }`.

This could later be backed by Node.js with Supabase auth by replacing `authService` and `apiClient`. The UI doesn't change.

## Quality notes

- **Language:** every visible string comes from `src/i18n`. System notifications are stored as templates, so they render in the viewer's language. The chosen language is saved in `localStorage`.
- **Theme:** light and dark each have their own design tokens (`src/index.css`). The choice is saved and applied before first paint.
- **Accessibility:**
  - Dialogs trap focus and stack properly (Escape closes only the top one).
  - Keyboard support for menus, tabs and the pitch editor.
  - Every chart has a "show as table" toggle.
  - Status is never shown by colour alone.
- **Unsaved changes:** leaving a page with an unsaved attendance register or line-up asks for confirmation (router blocker and `beforeunload`).
- **Responsive:**
  - On phones: drawer, bottom tab bar, cards instead of tables, filters in a bottom sheet, touch-sized pitch positions.
  - Checked at 320, 375, 390, 768, 1024, 1366 and 1440 px with no horizontal overflow.
- **Demo data:** Settings → Demo data → Reset restores the dataset. Untouched demo data regenerates each day so fixtures stay current.
