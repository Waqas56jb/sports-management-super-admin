import * as authService from '../services/authService.js';
import * as userService from '../services/userService.js';
import { ok } from '../utils/response.js';

export async function get(req, res) {
  ok(res, await userService.profile(req.actor), 'Profile retrieved');
}

export async function update(req, res) {
  ok(res, await userService.updateProfile(req.actor, req.valid.body), 'Profile updated');
}

export async function changePassword(req, res) {
  ok(res, await authService.changePassword(req.actor, req.valid.body), 'Password updated');
}

export async function getSettings(req, res) {
  ok(res, await userService.getSettings(req.actor), 'Settings retrieved');
}

export async function updateSettings(req, res) {
  ok(res, await userService.updateSettings(req.actor, req.valid.body), 'Settings saved');
}
