/**
 * /coaches (admin management) and the /coach workspace. Coach endpoints are always limited to
 * the teams in the coach's coach_teams rows — a team id sent by the client is re-checked.
 */
import { Router } from 'express';
import * as c from '../controllers/coachController.js';
import * as attendance from '../controllers/attendanceController.js';
import * as competitions from '../controllers/competitionController.js';
import * as matches from '../controllers/matchController.js';
import * as players from '../controllers/playerController.js';
import * as statistics from '../controllers/statisticsController.js';
import * as training from '../controllers/trainingController.js';
import { requireAuth } from '../middleware/auth.js';
import { requirePermission, requireRole } from '../middleware/roles.js';
import { idParam, validate } from '../middleware/validate.js';
import { asyncHandler as h } from '../utils/asyncHandler.js';
import * as attendanceV from '../validators/attendanceValidators.js';
import * as competitionV from '../validators/competitionValidators.js';
import * as matchV from '../validators/matchValidators.js';
import * as playerV from '../validators/playerValidators.js';
import * as teamV from '../validators/teamValidators.js';
import * as trainingV from '../validators/trainingValidators.js';
import * as v from '../validators/coachValidators.js';

const r = Router();

// ------------------------------------------------------------------ /coaches (admin)
const admin = [requireAuth, requirePermission('coaches:manage')];
r.get('/coaches', admin, validate({ query: v.query }), h(c.list));
r.get('/coaches/options', admin, h(c.options));
r.get('/coaches/:id', admin, idParam(), h(c.get));
r.post('/coaches', admin, validate({ body: v.create }), h(c.create));
r.patch('/coaches/:id', admin, idParam(), validate({ body: v.update }), h(c.update));
r.put('/coaches/:id', admin, idParam(), validate({ body: v.update }), h(c.update));
r.delete('/coaches/:id', admin, idParam(), h(c.remove));

// ------------------------------------------------------------------ /coach (signed-in coach)
const me = Router();
me.use(requireAuth, requireRole('coach'));

me.get(['/profile', '/me'], h(c.profile));
me.put('/me', validate({ body: v.selfUpdate }), h(c.updateProfile));
me.patch(['/me', '/profile'], validate({ body: v.selfUpdate }), h(c.updateProfile));
me.get('/dashboard', h(c.dashboard));
me.get('/search', h(c.search));

me.get('/teams', validate({ query: teamV.query }), h(c.teams));
me.get('/teams/options', h(c.teamOptions));
me.get('/teams/:id', idParam(), h(c.team));

me.get('/players', validate({ query: playerV.query }), h(players.list));
me.get('/players/options', validate({ query: playerV.optionsQuery }), h(players.options));
me.get('/players/:id', idParam(), h(players.get));

me.get('/matches', validate({ query: matchV.query }), h(matches.list));
me.get('/matches/counts', h(matches.counts));
me.get('/matches/:id', idParam(), h(matches.get));
me.patch('/matches/:id/status', idParam(), validate({ body: matchV.status }), h(matches.updateStatus));
me.put(['/matches/:id/team-stats', '/matches/:id/statistics'], idParam(), validate({ body: matchV.teamStats }), h(matches.updateStatistics));
me.patch('/matches/:id/statistics', idParam(), validate({ body: matchV.teamStats }), h(matches.updateStatistics));
me.patch('/matches/:id/lineup', idParam(), validate({ body: matchV.lineup }), h(matches.saveLineup));
me.put('/matches/:id/lineups/:side', validate({ params: matchV.sideParams, body: matchV.lineup }), h(matches.saveLineup));
me.post('/matches/:id/events', idParam(), validate({ body: matchV.event }), h(matches.addEvent));
me.patch('/matches/:id/events/:eventId', validate({ params: matchV.eventParams, body: matchV.eventUpdate }), h(matches.updateEvent));
me.delete('/matches/:id/events/:eventId', validate({ params: matchV.eventParams }), h(matches.removeEvent));

me.get(['/training', '/training-sessions'], validate({ query: trainingV.query }), h(training.list));
me.get(['/training/options', '/training-sessions/options'], validate({ query: trainingV.query }), h(training.options));
me.get(['/training/:id', '/training-sessions/:id'], idParam(), h(training.get));
me.post(['/training', '/training-sessions'], validate({ body: trainingV.create }), h(training.create));
me.put(['/training/:id', '/training-sessions/:id'], idParam(), validate({ body: trainingV.update }), h(training.update));
me.patch(['/training/:id', '/training-sessions/:id'], idParam(), validate({ body: trainingV.update }), h(training.update));
me.post(['/training/:id/cancel', '/training-sessions/:id/cancel'], idParam(), validate({ body: trainingV.cancel }), h(training.cancel));
me.post(['/training/:id/restore', '/training-sessions/:id/restore'], idParam(), h(training.restore));
me.get(['/training/:id/attendance', '/training-sessions/:id/attendance'], idParam(), h(training.attendance));
me.put(['/training/:id/attendance', '/training-sessions/:id/attendance'], idParam(), validate({ body: trainingV.register }), h(training.saveAttendance));
me.post(['/training/:id/attendance/bulk', '/training-sessions/:id/attendance/bulk'], idParam(), validate({ body: trainingV.register }), h(training.bulkAttendance));
me.get('/calendar', validate({ query: trainingV.calendarQuery }), h(training.calendar));

me.get('/attendance', validate({ query: attendanceV.query }), h(attendance.list));
me.get('/attendance/overview', validate({ query: attendanceV.query }), h(attendance.overview));
me.post('/attendance', validate({ body: attendanceV.create }), h(attendance.create));
me.patch('/attendance/:id', idParam(), validate({ body: attendanceV.update }), h(attendance.update));

me.get('/statistics', validate({ query: attendanceV.statisticsQuery }), h(statistics.overview));
me.get('/statistics/players', validate({ query: attendanceV.statisticsQuery }), h(statistics.players));
me.get('/statistics/teams', validate({ query: attendanceV.statisticsQuery }), h(statistics.teams));
me.get('/statistics/trend', validate({ query: attendanceV.statisticsQuery }), h(statistics.trend));

me.get('/competitions', validate({ query: competitionV.query }), h(competitions.list));
me.get('/competitions/options', h(competitions.options));
me.get('/competitions/seasons', h(competitions.seasons));
me.get('/competitions/:id', idParam(), h(competitions.get));

r.use('/coach', me);

export default r;
