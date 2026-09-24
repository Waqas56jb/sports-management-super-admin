import * as coachService from '../services/coachService.js';
import * as searchService from '../services/searchService.js';
import * as teamService from '../services/teamService.js';
import { created, ok, paged } from '../utils/response.js';

// ------------------------------------------------------------------ admin: coach management

export const list = async (req, res) => paged(res, await coachService.list(req.valid.query), 'Coaches retrieved successfully');
export const options = async (_req, res) => ok(res, await coachService.options(), 'Coach options retrieved');
export const get = async (req, res) => ok(res, await coachService.get(req.params.id), 'Coach retrieved');
export const create = async (req, res) => created(res, await coachService.create(req.actor, req.valid.body), 'Coach created');
export const update = async (req, res) => ok(res, await coachService.update(req.actor, req.params.id, req.valid.body), 'Coach updated');
export const remove = async (req, res) => ok(res, await coachService.remove(req.actor, req.params.id), 'Coach deleted');

// ------------------------------------------------------------------ coach workspace (identity from the token)

export const profile = async (req, res) => ok(res, await coachService.myProfile(req.actor), 'Profile retrieved');
export const updateProfile = async (req, res) => ok(res, await coachService.updateMyProfile(req.actor, req.valid.body), 'Profile updated');
export const dashboard = async (req, res) => ok(res, await coachService.dashboard(req.actor), 'Dashboard retrieved');

/** Assigned teams only (the service scopes by the coach's coach_teams rows). */
export async function teams(req, res) {
  const result = await teamService.list(req.actor, { ...req.valid.query, limit: 100 });
  ok(res, result.rows, 'Teams retrieved');
}

export const teamOptions = async (req, res) => ok(res, await teamService.options(req.actor), 'Team options retrieved');
export const team = async (req, res) => ok(res, await teamService.get(req.actor, req.params.id), 'Team retrieved');
export const search = async (req, res) => ok(res, await searchService.search(req.actor, req.query.q ?? req.query.search), 'Search results');
