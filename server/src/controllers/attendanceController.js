import * as attendanceService from '../services/attendanceService.js';
import { created, ok, paged } from '../utils/response.js';

export const list = async (req, res) => paged(res, await attendanceService.records(req.actor, req.valid.query), 'Attendance records retrieved successfully');
export const overview = async (req, res) => ok(res, await attendanceService.overview(req.actor, req.valid.query), 'Attendance overview retrieved');
export const create = async (req, res) => created(res, await attendanceService.create(req.actor, req.valid.body), 'Attendance recorded');
export const update = async (req, res) => ok(res, await attendanceService.update(req.actor, req.params.id, req.valid.body), 'Attendance updated');
