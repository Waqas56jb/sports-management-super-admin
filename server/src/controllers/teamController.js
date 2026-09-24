import * as teamService from '../services/teamService.js';
import { created, ok, paged } from '../utils/response.js';

export const list = async (req, res) => paged(res, await teamService.list(req.actor, req.valid.query), 'Teams retrieved successfully');
export const options = async (req, res) => ok(res, await teamService.options(req.actor), 'Team options retrieved');
export const get = async (req, res) => ok(res, await teamService.get(req.actor, req.params.id), 'Team retrieved');
export const statistics = async (req, res) => ok(res, await teamService.statistics(req.actor, req.params.id, req.valid.query), 'Team statistics retrieved');
export const create = async (req, res) => created(res, await teamService.create(req.actor, req.valid.body), 'Team created');
export const update = async (req, res) => ok(res, await teamService.update(req.actor, req.params.id, req.valid.body), 'Team updated');
export const remove = async (req, res) => ok(res, await teamService.remove(req.actor, req.params.id), 'Team deleted');

export const players = async (req, res) => ok(res, await teamService.roster(req.actor, req.params.teamId), 'Team players retrieved');
export const addPlayers = async (req, res) => ok(res, await teamService.addPlayers(req.actor, req.params.teamId, req.valid.body.playerIds), 'Players added to the team');
export const removePlayer = async (req, res) => ok(res, await teamService.removePlayer(req.actor, req.params.teamId, req.params.playerId), 'Player removed from the team');

export const coaches = async (req, res) => ok(res, await teamService.coaches(req.actor, req.params.teamId), 'Team coaches retrieved');
export const assignCoach = async (req, res) => ok(res, await teamService.assignCoach(req.actor, req.params.teamId, req.valid.body), 'Coach assigned');
export const unassignCoach = async (req, res) => ok(res, await teamService.unassignCoach(req.actor, req.params.teamId, req.params.coachId), 'Coach unassigned');
