# SportHub — Player Panel

This is the player-facing frontend of the federation's sports management system. A signed-in player sees their own season: profile, team, matches, training, attendance, statistics, competitions, calendar and notifications.

Everything is **view-only**, with two exceptions. The player can edit their own contact details (email, phone, address, photo, emergency contact) and their account settings.

It's built with React 19, Vite, React Router (data router), Tailwind CSS v4, Recharts and Lucide icons. The UI is in English (default) and French, with light, dark and system themes.

> This package contains **only** the Player frontend and runs on a built-in mock data layer. The Super Admin panel (`admin/`), the Coach panel (`coach/`) and the backend API are separate deliverables.

---

## Quick start

```bash
cd player
npm install
npm run dev          # http://localhost:5176/player/login
```

**Sign-in:** a player account created on the server (e.g. `player@gmail.com` — Ahmed Hassan, #9, Djibouti FC). Accounts and passwords are managed by the API (`server/`), not by this app.

The app calls the production API (`https://terrific-smile-production-85ea.up.railway.app/api/v1`) unless `VITE_API_BASE_URL` is set; `VITE_USE_MOCK_API=true` switches to the built-in demo data.

```bash
npm run build        # production build → dist/
npm run preview
```

Serve `dist/` as a single-page app: every `/player/*` path must fall back to `index.html`.

---

## What a player can do

| Area | Routes | Capabilities |
| --- | --- | --- |
| Dashboard | `/player/dashboard` | Personal hero, season KPIs, next match with countdown/live state, upcoming training, 14-day schedule, recent matches with own performance, charts |
| My Profile | `/player/profile` | Personal, sporting and licence information. Edit contact details, photo and emergency contact. Club-managed fields are locked |
| My Team | `/player/team` | Team overview, coaches, league position, record, next match and form. Roster with **public** teammate info only |
| Matches | `/player/matches`, `/player/matches/:id` | Upcoming/Completed/Cancelled tabs, search and filters. Match centre: Overview, Line-up (own position highlighted), Events, Statistics, "My performance" |
| Training | `/player/training`, `/player/training/:id` | List and calendar views, objectives, coach note to players, own attendance status. Cancelled sessions show their reason |
| Attendance | `/player/attendance` | Rate, present/late/absent/excused counts, monthly chart, trend, filterable history |
| Statistics | `/player/statistics` | Goals, assists, minutes, shots, passes, discipline, rating. Filter by season, competition, match type and dates |
| Competitions | `/player/competitions`, `/player/competitions/:id` | Competitions the team takes part in: standings, fixtures, results, top scorers |
| Calendar | `/player/calendar` | Month/week/day views of matches, training and team events |
| Notifications | `/player/notifications` | Categories (matches, training, team, system), read/unread, mark all read, delete with confirmation. The badge updates live |
| Settings | `/player/settings` | Account (email/phone), password change, session info, theme (light/dark/system), language, notification preferences |

The header also has the global search (Ctrl/⌘ + K), the language switch, the theme toggle, notifications and the profile menu. Log out always asks for confirmation.

### Privacy and access control

Every service resolves the signed-in player through `src/services/mock/scope.js`:

- Lists, the calendar and search only include the player's own team, matches, training, competitions and notifications.
- Teammates are shown with public fields only: name, photo, number, position, status and season goals/assists. They never include contact details, dates of birth or emergency contacts.
- Opening another team's match or training session returns **403**, shown as "Not available in your player space".
- Coach-only training notes are removed before data reaches the page.
- A **401** (expired session) signs the player out and shows a "session expired" message on the login page. After signing in again, the player returns to the page they had requested.

The real API must enforce the same rules on the server from the auth token.

---

## Business rules (mock layer; mirror them in the API)

- **Statistics come from match events.** Goals, assists, cards and minutes are computed from line-ups and events (`services/mock/statsEngine.js`).
- **Detail stats are derived deterministically.** Shots, passes and fouls come from each line (`data/statisticsData.js`), keeping goals ≤ shots on target ≤ shots.
- **Attendance rate** = (present + late) ÷ recorded sessions. A past session without a register yet is shown as *Pending*.
- **Profile updates** only accept `email, phone, address, photo, emergency_contact_*`. Any other field is ignored.

---

## Project structure

```text
player/src/
├── pages/             Dashboard, MyProfile, MyTeam, Matches, MatchDetails, Training, TrainingDetails,
│                      Attendance, Statistics, Competitions, CompetitionDetails, Calendar,
│                      Notifications, Settings, NotFound, Unauthorized, auth/Login, auth/ForgotPassword
├── layouts/           PlayerLayout (sidebar / collapsible rail / drawer + tab bar), AuthLayout
├── routes/            AppRoutes.jsx (lazy routes), guards, navigation config
├── components/
│   ├── ui/            design-system primitives (Button, Field, Modal, Tabs, DataTable, FilterBar, Skeleton…)
│   ├── layout/        Sidebar, Topbar, MobileTabBar, GlobalSearch, notification bell
│   ├── dashboard/ matches/ training/ team/ profile/ attendance/ statistics/ calendar/ charts/
│   └── common/        TeamLogo, MatchRow, StandingsTable, NotificationIcon, DetailGuard…
├── context/           AuthContext, ThemeContext, LanguageContext, Toast, Confirm, Notification providers
├── hooks/             useAuth, useTheme, useLanguage, usePlayer, useTeam, useMatches, useTraining,
│                      useAttendance, useStatistics, useNotifications, useQuery, useForm, useListParams…
├── services/          one service per domain + apiClient + mock/ (in-browser database, scope, stats engine)
├── data/              playerData, teamData, matchData, trainingData, attendanceData, statisticsData,
│                      competitionData, notificationData, seed (demo only)
├── i18n/              en/*.js and fr/*.js, one module per feature
└── utils/             formatters, validators, constants
```

## Connecting the real backend

All data access goes through `src/services/*Service.js`: `authService`, `playerService`, `profileService`, `teamService`, `matchService`, `trainingService`, `attendanceService`, `statisticsService`, `competitionService`, `notificationService` and `searchService`. When the mock is switched off, each method calls the REST API:

```env
VITE_API_BASE_URL=https://api.your-domain.dj
VITE_USE_MOCK_API=false
```

| Method | Endpoint |
| --- | --- |
| POST | `/auth/login` (`portal: 'player'`) → `{ user, token, expiresAt }`, `/auth/logout`, `/auth/forgot-password`, `/auth/change-password` |
| GET | `/player/me`, `/player/me/profile`, `/player/dashboard` |
| PATCH | `/player/me/profile` |
| GET | `/player/team`, `/player/team/roster`, `/player/teammates/:id` |
| GET | `/player/matches`, `/player/matches/counts`, `/player/matches/:id` |
| GET | `/player/training-sessions`, `/player/training-sessions/counts`, `/player/training-sessions/:id`, `/player/calendar` |
| GET | `/player/attendance`, `/player/statistics` |
| GET | `/player/competitions`, `/player/competitions/seasons`, `/player/competitions/:id` |
| GET / PATCH / DELETE | `/player/notifications`, `/player/notifications/unread-count`, `/player/notifications/:id`, `POST /player/notifications/mark-all-read` |
| GET / PATCH | `/player/notification-preferences` |
| GET | `/player/search?q=` |

The mock implementations document the exact request and response shapes. Errors should be `{ code, fields }`, where `code` is a translation key.

## Quality notes

- **Language:** every visible string comes from `src/i18n`. System notifications and training content are stored as keys/templates, so they render in the viewer's language. The language is switchable from the header or Settings and is saved in `localStorage`.
- **Theme:** light, dark or system (follows the device). Each has its own design tokens in `src/index.css`, and the theme is applied before first paint.
- **Responsive:**
  - Desktop: full sidebar.
  - Tablet: collapsible icon rail.
  - Mobile: drawer plus a bottom tab bar, with cards instead of tables.
  - Checked at 320, 375, 390, 414, 480, 768, 1024, 1280, 1440 and 1920 px in both languages and themes, with no horizontal overflow and no console errors.
- **Accessibility:**
  - Dialogs trap focus and stack (Escape closes only the top one).
  - Menus and search work from the keyboard.
  - Charts have a table view.
  - Status is never shown by colour alone.
- **Demo data:** Settings → Demo data → Reset restores the dataset. Untouched demo data regenerates daily so fixtures stay current.
