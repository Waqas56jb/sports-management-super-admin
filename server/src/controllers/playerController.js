import * as attendanceService from '../services/attendanceService.js';
import * as competitionService from '../services/competitionService.js';
import * as matchService from '../services/matchService.js';
import * as notificationService from '../services/notificationService.js';
import * as playerService from '../services/playerService.js';
import * as searchService from '../services/searchService.js';
import * as statisticsService from '../services/statisticsService.js';
import * as teamService from '../services/teamService.js';
import * as trainingService from '../services/trainingService.js';
import * as userService from '../services/userService.js';
import { created, ok, paged } from '../utils/response.js';

// ------------------------------------------------------------------ admin / coach

export async function list(req, res) {
  paged(res, await playerService.list(req.actor, req.valid.query), 'Players retrieved successfully');
}

export async function options(req, res) {
  ok(res, await playerService.options(req.actor, req.valid.query), 'Player options retrieved');
}

export async function get(req, res) {
  ok(res, await playerService.get(req.actor, req.params.id), 'Player retrieved');
}

export async function statistics(req, res) {
  ok(res, await playerService.statistics(req.actor, req.params.id, req.valid.query), 'Player statistics retrieved');
}

export async function attendance(req, res) {
  ok(res, await playerService.attendance(req.actor, req.params.id, req.valid.query), 'Player attendance retrieved');
}

export async function create(req, res) {
  created(res, await playerService.create(req.actor, req.valid.body), 'Player created');
}

export async function update(req, res) {
  ok(res, await playerService.update(req.actor, req.params.id, req.valid.body), 'Player updated');
}

export async function remove(req, res) {
  ok(res, await playerService.remove(req.actor, req.params.id), 'Player deleted');
}

// ------------------------------------------------------------------ player space (identity from the token)

export const me = async (req, res) => ok(res, await playerService.me(req.actor), 'Player retrieved');
export const profile = async (req, res) => ok(res, await playerService.myProfile(req.actor), 'Profile retrieved');
export const updateProfile = async (req, res) => ok(res, await playerService.updateMyProfile(req.actor, req.valid.body), 'Profile updated');
export const dashboard = async (req, res) => ok(res, await playerService.dashboard(req.actor), 'Dashboard retrieved');
export const team = async (req, res) => ok(res, await teamService.myTeam(req.actor), 'Team retrieved');
export const roster = async (req, res) => ok(res, await teamService.publicRoster(req.actor, req.valid.query), 'Roster retrieved');
export const teammate = async (req, res) => ok(res, await teamService.teammate(req.actor, req.params.id), 'Teammate retrieved');
export const matches = async (req, res) => paged(res, await matchService.list(req.actor, req.valid.query), 'Matches retrieved');
export const matchCounts = async (req, res) => ok(res, await matchService.counts(req.actor), 'Match counts retrieved');
export const match = async (req, res) => ok(res, await matchService.get(req.actor, req.params.id), 'Match retrieved');
export const training = async (req, res) => paged(res, await trainingService.list(req.actor, req.valid.query), 'Training sessions retrieved');
export const trainingCounts = async (req, res) => ok(res, await trainingService.counts(req.actor), 'Training counts retrieved');
export const trainingSession = async (req, res) => ok(res, await trainingService.get(req.actor, req.params.id), 'Training session retrieved');
export const myAttendance = async (req, res) => ok(res, await attendanceService.mine(req.actor, req.valid.query), 'Attendance retrieved');
export const myStatistics = async (req, res) => ok(res, await statisticsService.myStatistics(req.actor, req.valid.query), 'Statistics retrieved');
export const competitions = async (req, res) => ok(res, await competitionService.list(req.actor, req.valid.query), 'Competitions retrieved');
export const seasons = async (req, res) => ok(res, await competitionService.seasons(req.actor), 'Seasons retrieved');
export const competition = async (req, res) => ok(res, await competitionService.get(req.actor, req.params.id), 'Competition retrieved');
export const calendar = async (req, res) => ok(res, await trainingService.calendar(req.actor, req.valid.query), 'Calendar retrieved');
export const search = async (req, res) => ok(res, await searchService.search(req.actor, req.query.q ?? req.query.search), 'Search results');
export const getPreferences = async (req, res) => ok(res, await notificationService.getPreferences(req.actor.userId), 'Notification preferences retrieved');
export const updatePreferences = async (req, res) => ok(res, await notificationService.updatePreferences(req.actor.userId, req.valid.body), 'Settings saved');
export const getSettings = async (req, res) => ok(res, await userService.getSettings(req.actor), 'Settings retrieved');
export const updateSettings = async (req, res) => ok(res, await userService.updateSettings(req.actor, req.valid.body), 'Settings saved');
