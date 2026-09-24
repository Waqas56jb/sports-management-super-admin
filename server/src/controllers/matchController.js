import * as matchService from '../services/matchService.js';
import { created, ok, paged } from '../utils/response.js';

export const list = async (req, res) => paged(res, await matchService.list(req.actor, req.valid.query), 'Matches retrieved successfully');
export const counts = async (req, res) => ok(res, await matchService.counts(req.actor), 'Match counts retrieved');
export const get = async (req, res) => ok(res, await matchService.get(req.actor, req.params.id), 'Match retrieved');
export const create = async (req, res) => created(res, await matchService.create(req.actor, req.valid.body), 'Match created');
export const update = async (req, res) => ok(res, await matchService.update(req.actor, req.params.id, req.valid.body), 'Match updated');
export const remove = async (req, res) => ok(res, await matchService.remove(req.actor, req.params.id), 'Match deleted');

export const updateStatus = async (req, res) => ok(res, await matchService.updateStatus(req.actor, req.params.id, req.valid.body), 'Match status updated');
export const updateStatistics = async (req, res) => ok(res, await matchService.updateTeamStats(req.actor, req.params.id, req.valid.body), 'Match statistics updated');

/** PATCH /matches/:id/lineup (body: team_id | side) and PUT /matches/:id/lineups/:side. */
export async function saveLineup(req, res) {
  const body = { ...req.valid.body, side: req.params.side ?? req.valid.body.side };
  ok(res, await matchService.saveLineup(req.actor, req.params.id, body), 'Line-up saved');
}

export const addEvent = async (req, res) => created(res, await matchService.addEvent(req.actor, req.params.id, req.valid.body), 'Event recorded');
export const updateEvent = async (req, res) => ok(res, await matchService.updateEvent(req.actor, req.params.id, req.params.eventId, req.valid.body), 'Event updated');
export const removeEvent = async (req, res) => ok(res, await matchService.removeEvent(req.actor, req.params.id, req.params.eventId), 'Event deleted');
