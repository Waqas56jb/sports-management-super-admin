import * as trainingService from '../services/trainingService.js';
import { created, ok, paged } from '../utils/response.js';

export const list = async (req, res) => paged(res, await trainingService.list(req.actor, req.valid.query), 'Training sessions retrieved successfully');
export const options = async (req, res) => ok(res, await trainingService.options(req.actor, req.valid.query), 'Training options retrieved');
export const counts = async (req, res) => ok(res, await trainingService.counts(req.actor), 'Training counts retrieved');
export const get = async (req, res) => ok(res, await trainingService.get(req.actor, req.params.id), 'Training session retrieved');
export const create = async (req, res) => created(res, await trainingService.create(req.actor, req.valid.body), 'Training session created');
export const update = async (req, res) => ok(res, await trainingService.update(req.actor, req.params.id, req.valid.body), 'Training session updated');
export const cancel = async (req, res) => ok(res, await trainingService.cancel(req.actor, req.params.id, req.valid.body.reason), 'Training session cancelled');
export const restore = async (req, res) => ok(res, await trainingService.restore(req.actor, req.params.id), 'Training session reinstated');
export const remove = async (req, res) => ok(res, await trainingService.remove(req.actor, req.params.id), 'Training session deleted');

export const attendance = async (req, res) => ok(res, await trainingService.attendanceFor(req.actor, req.params.id), 'Register retrieved');
/** PUT — replaces the whole register. */
export const saveAttendance = async (req, res) => ok(res, await trainingService.saveRegister(req.actor, req.params.id, req.valid.body.records, { replace: true }), 'Attendance saved');
/** POST …/bulk — upserts the given lines, leaving the others untouched. */
export const bulkAttendance = async (req, res) => ok(res, await trainingService.saveRegister(req.actor, req.params.id, req.valid.body.records, { replace: false }), 'Attendance saved');

export const calendar = async (req, res) => ok(res, await trainingService.calendar(req.actor, req.valid.query), 'Calendar retrieved');
