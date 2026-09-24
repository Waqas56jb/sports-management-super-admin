/* en dictionary — one module per feature namespace. */
import common from './en/common.js';
import auth from './en/auth.js';
import errorPages from './en/errorPages.js';
import dashboard from './en/dashboard.js';
import users from './en/users.js';
import players from './en/players.js';
import coaches from './en/coaches.js';
import teams from './en/teams.js';
import competitions from './en/competitions.js';
import matches from './en/matches.js';
import training from './en/training.js';
import attendance from './en/attendance.js';
import statistics from './en/statistics.js';
import reports from './en/reports.js';
import notifications from './en/notifications.js';
import settings from './en/settings.js';

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
