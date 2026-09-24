/* fr dictionary — one module per feature namespace. */
import common from './fr/common.js';
import auth from './fr/auth.js';
import errorPages from './fr/errorPages.js';
import dashboard from './fr/dashboard.js';
import profile from './fr/profile.js';
import team from './fr/team.js';
import matches from './fr/matches.js';
import training from './fr/training.js';
import attendance from './fr/attendance.js';
import statistics from './fr/statistics.js';
import competitions from './fr/competitions.js';
import calendarPage from './fr/calendarPage.js';
import notifications from './fr/notifications.js';
import settings from './fr/settings.js';

export default {
  ...common,
  auth,
  errorPages,
  dashboard,
  profile,
  team,
  matches,
  training,
  attendance,
  statistics,
  competitions,
  calendarPage,
  notifications,
  settings,
};
