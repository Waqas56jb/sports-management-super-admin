/* en dictionary — one module per feature namespace. */
import common from './en/common.js';
import auth from './en/auth.js';
import errorPages from './en/errorPages.js';
import dashboard from './en/dashboard.js';
import profile from './en/profile.js';
import team from './en/team.js';
import matches from './en/matches.js';
import training from './en/training.js';
import attendance from './en/attendance.js';
import statistics from './en/statistics.js';
import competitions from './en/competitions.js';
import calendarPage from './en/calendarPage.js';
import notifications from './en/notifications.js';
import settings from './en/settings.js';

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
