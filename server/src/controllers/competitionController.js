import * as competitionService from '../services/competitionService.js';
import { standings as computeStandings } from '../services/statisticsService.js';
import { created, ok, paged } from '../utils/response.js';

export async function list(req, res) {
  const result = await competitionService.list(req.actor, req.valid.query);
  if (Array.isArray(result)) ok(res, result, 'Competitions retrieved successfully');
  else paged(res, result, 'Competitions retrieved successfully');
}

export const options = async (req, res) => ok(res, await competitionService.options(req.actor), 'Competition options retrieved');
export const seasons = async (req, res) => ok(res, await competitionService.seasons(req.actor), 'Seasons retrieved');
export const get = async (req, res) => ok(res, await competitionService.get(req.actor, req.params.id), 'Competition retrieved');
export const create = async (req, res) => created(res, await competitionService.create(req.actor, req.valid.body), 'Competition created');
export const update = async (req, res) => ok(res, await competitionService.update(req.actor, req.params.id, req.valid.body), 'Competition updated');
export const remove = async (req, res) => ok(res, await competitionService.remove(req.actor, req.params.id), 'Competition deleted');

export const teams = async (req, res) => ok(res, await competitionService.listTeams(req.actor, req.params.id), 'Competition teams retrieved');
export const addTeam = async (req, res) => ok(res, await competitionService.addTeam(req.actor, req.params.id, req.valid.body.team_id), 'Team added to the competition');
export const removeTeam = async (req, res) => ok(res, await competitionService.removeTeam(req.actor, req.params.id, req.params.teamId), 'Team removed from the competition');

export async function standings(req, res) {
  await competitionService.get(req.actor, req.params.id); // access check
  ok(res, await computeStandings(req.params.id), 'Standings retrieved');
}
