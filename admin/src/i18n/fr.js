/* fr dictionary — one module per feature namespace. */
import common from './fr/common.js';
import auth from './fr/auth.js';
import errorPages from './fr/errorPages.js';
import dashboard from './fr/dashboard.js';
import users from './fr/users.js';
import players from './fr/players.js';
import coaches from './fr/coaches.js';
import teams from './fr/teams.js';
import competitions from './fr/competitions.js';
import matches from './fr/matches.js';
import training from './fr/training.js';
import attendance from './fr/attendance.js';
import statistics from './fr/statistics.js';
import reports from './fr/reports.js';
import notifications from './fr/notifications.js';
import settings from './fr/settings.js';

export default {
  ...common,
  auth,
  errorPages,
  dashboard,
  users,
  players,
  coaches,
  teams,
  competitions,
  matches,
  training,
  attendance,
  statistics,
  reports,
  notifications,
  settings,
};
