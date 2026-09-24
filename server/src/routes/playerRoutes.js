/**
 * /players (admin management, coach read access) and the /player space (the signed-in player —
 * every endpoint derives the player from the token; no player id is ever read from the client).
 */
import { Router } from 'express';
import * as c from '../controllers/playerController.js';
import * as notifications from '../controllers/notificationController.js';
import { requireAuth } from '../middleware/auth.js';
import { requirePermission, requireRole } from '../middleware/roles.js';
import { idParam, validate } from '../middleware/validate.js';
import { asyncHandler as h } from '../utils/asyncHandler.js';
import * as attendanceV from '../validators/attendanceValidators.js';
import * as matchV from '../validators/matchValidators.js';
import * as profileV from '../validators/profileValidators.js';
import * as v from '../validators/playerValidators.js';
import * as trainingV from '../validators/trainingValidators.js';
import * as competitionV from '../validators/competitionValidators.js';

const r = Router();

// ------------------------------------------------------------------ /players
const readers = [requireAuth, requirePermission('players:read')];
const admin = [requireAuth, requirePermission('players:manage')];

r.get('/players', readers, validate({ query: v.query }), h(c.list));
r.get('/players/options', readers, validate({ query: v.optionsQuery }), h(c.options));
r.get('/players/:id', readers, idParam(), h(c.get));
r.get('/players/:id/statistics', requireAuth, requirePermission('statistics:read'), idParam(), validate({ query: v.statisticsQuery }), h(c.statistics));
r.get('/players/:id/attendance', requireAuth, requirePermission('attendance:read'), idParam(), validate({ query: v.attendanceQuery }), h(c.attendance));
r.post('/players', admin, validate({ body: v.create }), h(c.create));
r.patch('/players/:id', admin, idParam(), validate({ body: v.update }), h(c.update));
r.put('/players/:id', admin, idParam(), validate({ body: v.update }), h(c.update));
r.delete('/players/:id', admin, idParam(), h(c.remove));

// ------------------------------------------------------------------ /player (signed-in player)
const me = Router();
me.use(requireAuth, requireRole('player'));

me.get('/me', h(c.me));
me.get(['/profile', '/me/profile'], h(c.profile));
me.patch(['/profile', '/me/profile'], profileV.assertPlayerEditable, validate({ body: profileV.playerProfileSchema }), h(c.updateProfile));
me.get('/dashboard', h(c.dashboard));
me.get('/team', h(c.team));
me.get('/team/roster', validate({ query: v.rosterQuery }), h(c.roster));
me.get('/teammates/:id', idParam(), h(c.teammate));

me.get('/matches', validate({ query: matchV.query }), h(c.matches));
me.get('/matches/counts', h(c.matchCounts));
me.get('/matches/:id', idParam(), h(c.match));

me.get(['/training', '/training-sessions'], validate({ query: trainingV.query }), h(c.training));
me.get(['/training/counts', '/training-sessions/counts'], h(c.trainingCounts));
me.get(['/training/:id', '/training-sessions/:id'], idParam(), h(c.trainingSession));

me.get('/attendance', validate({ query: v.attendanceQuery }), h(c.myAttendance));
me.get('/statistics', validate({ query: v.statisticsQuery }), h(c.myStatistics));

me.get('/competitions', validate({ query: competitionV.query }), h(c.competitions));
me.get('/competitions/seasons', h(c.seasons));
me.get('/competitions/:id', idParam(), h(c.competition));

me.get('/calendar', validate({ query: trainingV.calendarQuery }), h(c.calendar));
me.get('/search', h(c.search));

me.get('/notifications', validate({ query: attendanceV.notificationQuery }), h(notifications.list));
me.get('/notifications/unread-count', h(notifications.unreadCount));
me.post('/notifications/mark-all-read', h(notifications.markAllRead));
me.patch('/notifications/read-all', h(notifications.markAllRead));
me.patch('/notifications/:id/read', idParam(), h(notifications.setRead));
me.patch('/notifications/:id', idParam(), validate({ body: attendanceV.notificationPatch }), h(notifications.setRead));
me.delete('/notifications/:id', idParam(), h(notifications.remove));

me.get('/notification-preferences', h(c.getPreferences));
me.patch('/notification-preferences', validate({ body: profileV.notificationPreferences }), h(c.updatePreferences));
me.get('/settings', h(c.getSettings));
me.patch('/settings', validate({ body: profileV.settings }), h(c.updateSettings));

r.use('/player', me);

export default r;
