import * as authService from '../services/authService.js';
import * as userService from '../services/userService.js';
import { created, ok, paged } from '../utils/response.js';

export async function list(req, res) {
  paged(res, await userService.list(req.valid.query), 'Users retrieved successfully');
}

export async function counts(_req, res) {
  ok(res, await userService.counts(), 'User counts retrieved');
}

export async function get(req, res) {
  ok(res, await userService.get(req.params.id), 'User retrieved');
}

export async function create(req, res) {
  created(res, await userService.create(req.actor, req.valid.body), 'User created');
}

export async function update(req, res) {
  ok(res, await userService.update(req.actor, req.params.id, req.valid.body), 'User updated');
}

export async function setStatus(req, res) {
  ok(res, await userService.setStatus(req.actor, req.params.id, req.valid.body.status), 'User status updated');
}

export async function resetPassword(req, res) {
  ok(res, await authService.adminResetPassword(req.actor, req.params.id, req.valid.body), 'Password reset');
}

export async function remove(req, res) {
  ok(res, await userService.remove(req.actor, req.params.id), 'User deleted');
}
